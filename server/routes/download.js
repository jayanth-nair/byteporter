const express = require('express');
const FileModel = require('../models/File');
const router = express.Router();
const path = require('path');
const auth = require('../middleware/auth');
const fs = require('fs/promises');
const UserModel = require('../models/User');
const { valkeyClient } = require('../config/valkeyClient');
const bcrypt = require('bcryptjs');

/**
 * @route   GET /api/files/my-files
 * @desc    Get all files uploaded by the current user
 * @access  Private
 */
router.get('/my-files', auth, async (req, res) => {
    try {
        const files = await FileModel.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(files);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * @route   GET /api/files/:uuid
 * @desc    Get file metadata (name, size, protection status)
 * @access  Public
 */
router.get('/:uuid', async (req, res) => {
    try {
        const file = await FileModel.findOne({ uuid: req.params.uuid });
        if (!file) {
            return res.status(404).json({ msg: 'File not found.' });
        }
        return res.status(200).json({
            name: file.originalName,
            size: file.size,
            uuid: file.uuid,
            hasPassword: !!file.password,
            oneTimeDownload: file.oneTimeDownload
        });
    } catch (err) {
        return res.status(500).json({ msg: 'Server error.' });
    }
});

/**
 * @route   POST /api/files/download/:uuid
 * @desc    Download a file (with password check & one-time logic)
 * @access  Public
 */
router.post('/download/:uuid', async (req, res) => {
    try {
        const file = await FileModel.findOne({ uuid: req.params.uuid });
        if (!file) {
            return res.status(404).json({ msg: 'Link expired or file not found.' });
        }

        // ... password check ...
        if (file.password) {
            if (!req.body.password) {
                return res.status(401).json({ msg: 'Password required.' });
            }
            const isMatch = await bcrypt.compare(req.body.password, file.password);
            if (!isMatch) {
                return res.status(401).json({ msg: 'Incorrect password.' });
            }
        }

        const uploadsDir = path.resolve(__dirname, '..', 'uploads');
        const filePath = path.resolve(__dirname, '..', file.path);

        if (!filePath.startsWith(uploadsDir)) {
            console.error(`Security Alert: Path traversal attempt detected. Path: ${filePath}`);
            return res.status(403).json({ msg: 'Access denied.' });
        }

        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({ msg: 'File not found on server.' });
        }

        // ATOMIC LOCK: If one-time download, delete DB record IMMEDIATELY to prevent concurrent access
        if (file.oneTimeDownload) {
            const deletedFile = await FileModel.findOneAndDelete({ _id: file._id });
            if (!deletedFile) {
                // Race condition: Another request just claimed it
                return res.status(404).json({ msg: 'Link expired or file not found.' });
            }

            // Remove from Redis expiry immediately
            await valkeyClient.del(file.uuid);
        }

        res.download(filePath, file.originalName, async (err) => {
            // Cleanup logic
            if (file.oneTimeDownload) {
                try {
                    console.log(`One-time download accessed. Deleting file: ${file.originalName}`);

                    // Update quota (using file.user from the loaded doc)
                    await UserModel.findByIdAndUpdate(
                        file.user,
                        { $inc: { storageUsed: -file.size } }
                    );

                    // Delete physical file
                    // Note: If download failed mid-stream, file is still deleted (Burn on Access)
                    await fs.unlink(file.path).catch(e => console.error("Error deleting file:", e));

                } catch (cleanupErr) {
                    console.error('Error during one-time download cleanup:', cleanupErr);
                }
            }
        });
    } catch (err) {
        if (!res.headersSent) {
            return res.status(500).json({ msg: 'Server error.' });
        }
    }
});

/**
 * @route   POST /api/files/preview/:uuid
 * @desc    Preview a file (image/text) in the browser
 * @access  Public
 */
router.post('/preview/:uuid', async (req, res) => {
    try {
        const file = await FileModel.findOne({ uuid: req.params.uuid });
        if (!file) {
            return res.status(404).json({ msg: 'Link expired or file not found.' });
        }

        if (file.oneTimeDownload) {
            return res.status(403).json({ msg: 'Preview is disabled for one-time downloads.' });
        }

        if (file.password) {
            if (!req.body.password) {
                return res.status(401).json({ msg: 'Password required.' });
            }
            const isMatch = await bcrypt.compare(req.body.password, file.password);
            if (!isMatch) {
                return res.status(401).json({ msg: 'Incorrect password.' });
            }
        }

        const uploadsDir = path.resolve(__dirname, '..', 'uploads');
        const filePath = path.resolve(__dirname, '..', file.path);

        if (!filePath.startsWith(uploadsDir)) {
            console.error(`Security Alert: Path traversal attempt detected. Path: ${filePath}`);
            return res.status(403).json({ msg: 'Access denied.' });
        }

        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({ msg: 'File not found on server.' });
        }

        // Prevent XSS via malicious file uploads (e.g., HTML/SVG)
        res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
        res.set('X-Content-Type-Options', 'nosniff');

        res.sendFile(filePath);
    } catch (err) {
        return res.status(500).json({ msg: 'Server error.' });
    }
});

/**
 * @route   DELETE /api/files/:uuid
 * @desc    Delete a file
 * @access  Private (Owner only)
 */
router.delete('/:uuid', auth, async (req, res) => {
    try {
        const file = await FileModel.findOne({ uuid: req.params.uuid });
        if (!file) {
            return res.status(404).json({ msg: 'File not found.' });
        }
        if (file.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized to delete this file.' });
        }

        const updatedUser = await UserModel.findByIdAndUpdate(
            req.user.id,
            { $inc: { storageUsed: -file.size } },
            { new: true }
        );

        await fs.unlink(file.path);
        await FileModel.deleteOne({ _id: file._id });
        await valkeyClient.del(file.uuid);

        res.json({ msg: 'File deleted successfully.' });

    } catch (err) {
        console.error("Error during file deletion:", err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;