const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const FileModel = require('../models/File');
const SystemConfig = require('../models/SystemConfig');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { valkeyClient } = require('../config/valkeyClient');
const fs = require('fs/promises');
const path = require('path');

/**
 * @route   GET /api/admin/check
 * @desc    Check if an admin account exists
 * @access  Public
 */
router.get('/check', async (req, res) => {
    try {
        const adminExists = await User.exists({ role: 'admin' });
        res.json({ exists: !!adminExists });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * @route   POST /api/admin/setup
 * @desc    Create the initial admin account
 * @access  Public (Only if no admin exists)
 */
router.post('/setup', async (req, res) => {
    const { username, password } = req.body;

    try {
        const adminExists = await User.exists({ role: 'admin' });
        if (adminExists) {
            return res.status(403).json({ msg: 'Admin account already exists.' });
        }

        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        user = new User({
            username,
            password,
            role: 'admin'
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 24 * 60 * 60 * 1000 // 24 hours
                });
                res.json({ msg: 'Admin setup complete' });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * @route   GET /api/admin/users
 * @desc    List all users
 * @access  Private (Admin)
 */
router.get('/users', auth, admin, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user
 * @access  Private (Admin)
 */
router.delete('/users/:id', auth, admin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (user.id === req.user.id) {
            return res.status(400).json({ msg: 'Cannot delete your own admin account.' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'User removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * @route   PATCH /api/admin/users/:id/quota
 * @desc    Update a user's storage quota
 * @access  Private (Admin)
 */
router.patch('/users/:id/quota', auth, admin, async (req, res) => {
    const { quotaInMB } = req.body;

    try {
        let quotaBytes = null;
        if (quotaInMB !== null && quotaInMB !== '') {
            quotaBytes = parseInt(quotaInMB) * 1024 * 1024;
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { storageQuota: quotaBytes },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * @route   GET /api/admin/config
 * @desc    Get system configuration
 * @access  Private (Admin)
 */
router.get('/config', auth, admin, async (req, res) => {
    try {
        const config = await SystemConfig.getConfig();
        res.json(config);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * @route   PUT /api/admin/config
 * @desc    Update system configuration
 * @access  Private (Admin)
 */
router.put('/config', auth, admin, async (req, res) => {
    const { defaultStorageQuotaMB, maxFileSizeMB, allowRegistration, isMaxFileSizeLinked } = req.body;

    try {
        let updateFields = { updatedAt: Date.now() };

        // 1. Handle isMaxFileSizeLinked update
        if (isMaxFileSizeLinked !== undefined) {
            updateFields.isMaxFileSizeLinked = isMaxFileSizeLinked;
        }

        // Fetch current config to know state if not provided
        const currentConfig = await SystemConfig.getConfig();
        const linkedState = isMaxFileSizeLinked !== undefined ? isMaxFileSizeLinked : currentConfig.isMaxFileSizeLinked;

        // 2. Handle Default Storage Quota Update
        let newQuotaBytes = currentConfig.defaultStorageQuota;
        if (defaultStorageQuotaMB !== undefined) {
            newQuotaBytes = parseInt(defaultStorageQuotaMB) * 1024 * 1024;
            updateFields.defaultStorageQuota = newQuotaBytes;
        }

        // 3. Handle Max File Size Logic
        if (linkedState) {
            // If linked, Max File Size is ALWAYS 95% of Quota
            updateFields.maxFileSize = Math.floor(newQuotaBytes * 0.95);
        } else {
            // If unlinked, user can set Max File Size, BUT it must not exceed 95% of Quota
            if (maxFileSizeMB !== undefined) {
                const requestedMaxBytes = parseInt(maxFileSizeMB) * 1024 * 1024;
                const limitBytes = Math.floor(newQuotaBytes * 0.95);

                if (requestedMaxBytes > limitBytes) {
                    return res.status(400).json({
                        msg: `Max file size cannot exceed 95% of the default quota (${Math.floor(limitBytes / (1024 * 1024))} MB).`
                    });
                }
                updateFields.maxFileSize = requestedMaxBytes;
            } else {
                // If quota changed but maxFileSize not provided, ensure current max doesn't violate new limit
                const limitBytes = Math.floor(newQuotaBytes * 0.95);
                if (currentConfig.maxFileSize > limitBytes) {
                    updateFields.maxFileSize = limitBytes;
                }
            }
        }

        if (allowRegistration !== undefined) {
            updateFields.allowRegistration = allowRegistration;
        }

        const config = await SystemConfig.findOneAndUpdate(
            {},
            { $set: updateFields },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json(config);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * @route   POST /api/admin/reset
 * @desc    Factory Reset (Wipe DB & Files)
 * @access  Private (Admin)
 */
router.post('/reset', auth, admin, async (req, res) => {
    try {
        // 1. Delete all data from MongoDB
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            try {
                await collection.drop();
            } catch (error) {
                // Ignore if collection doesn't exist
                if (error.code !== 26) {
                    console.error(`Error dropping collection ${collection.collectionName}:`, error);
                }
            }
        }

        // 2. Clear Redis
        await valkeyClient.flushAll();

        // 3. Delete all files in uploads folder
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        try {
            const files = await fs.readdir(uploadsDir);
            for (const file of files) {
                if (file !== '.gitkeep') { // Preserve .gitkeep if it exists
                    await fs.unlink(path.join(uploadsDir, file));
                }
            }
        } catch (fsErr) {
            if (fsErr.code !== 'ENOENT') {
                console.error('Error clearing uploads directory:', fsErr);
            }
            // Continue even if FS fails, as DB is wiped
        }

        res.json({ msg: 'System reset successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
