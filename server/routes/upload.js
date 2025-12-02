const express = require('express');
const multer = require('multer');
const fs = require('fs/promises');
const bcrypt = require('bcryptjs');
const FileModel = require('../models/File');
const UserModel = require('../models/User');
const { valkeyClient } = require('../config/valkeyClient');
const auth = require('../middleware/auth');
const SystemConfig = require('../models/SystemConfig');

const router = express.Router();

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const MAX_MULTER_LIMIT = 100 * 1024 * 1024 * 1024; // 100GB Safety Cap

/**
 * Multer configuration for file uploads.
 * Sets storage destination and filename generation strategy.
 * Enforces a safety cap on file size at the middleware level.
 */
const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_MULTER_LIMIT
    }
}).single('file');

/**
 * @route   POST /api/upload
 * @desc    Upload a file with optional password and expiration
 * @access  Private
 */
router.post('/', auth, (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ msg: 'An unknown error occurred during upload.' });
        }

        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded.' });
        }

        if (req.file.size === 0) {
            await fs.unlink(req.file.path);
            return res.status(400).json({ msg: 'Cannot upload empty files.' });
        }

        try {
            const config = await SystemConfig.getConfig();

            // 1. Enforce Dynamic Max File Size
            // Checks if the uploaded file exceeds the globally configured max file size.
            // If so, deletes the file and returns an error.
            if (req.file.size > config.maxFileSize) {
                await fs.unlink(req.file.path);
                const limitMB = Math.round(config.maxFileSize / (1024 * 1024));
                return res.status(400).json({ msg: `File is too large. Maximum size is ${limitMB}MB.` });
            }

            const user = await UserModel.findById(req.user.id);
            if (!user) {
                await fs.unlink(req.file.path);
                return res.status(404).json({ msg: 'User not found.' });
            }

            // 2. Enforce Dynamic Storage Quota (Atomic Check-and-Set)
            // We attempt to increment storageUsed ONLY IF the new total is <= quota.
            // If the update fails (returns null), it means the quota would be exceeded.
            const USER_QUOTA_BYTES = user.storageQuota !== null ? user.storageQuota : config.defaultStorageQuota;

            // Optimistic check to fail early if obviously over quota
            if (user.storageUsed + req.file.size > USER_QUOTA_BYTES) {
                await fs.unlink(req.file.path);
                const quotaMB = Math.round(USER_QUOTA_BYTES / (1024 * 1024));
                return res.status(400).json({ msg: `Storage quota exceeded. Your quota is ${quotaMB}MB.` });
            }

            const { expiration, password, oneTimeDownload } = req.body;
            let secondsUntilExpiry;

            switch (expiration) {
                case 'permanent': secondsUntilExpiry = null; break;
                case '1h': secondsUntilExpiry = 3600; break;
                case '7d': secondsUntilExpiry = 7 * 24 * 3600; break;
                case '1m': secondsUntilExpiry = 60; break;
                default: secondsUntilExpiry = 24 * 3600;
            }

            const expiresAt = secondsUntilExpiry ? new Date(Date.now() + secondsUntilExpiry * 1000) : null;

            const fileData = new FileModel({
                originalName: req.file.originalname,
                path: req.file.path,
                size: req.file.size,
                user: req.user.id,
                expiresAt: expiresAt,
                oneTimeDownload: oneTimeDownload === 'true'
            });

            if (password) {
                const salt = await bcrypt.genSalt(10);
                fileData.password = await bcrypt.hash(password, salt);
            }

            // ATOMIC OPERATION: Increment storageUsed only if it doesn't exceed quota
            const updatedUser = await UserModel.findOneAndUpdate(
                {
                    _id: req.user.id,
                    $expr: { $lte: [{ $add: ["$storageUsed", req.file.size] }, USER_QUOTA_BYTES] }
                },
                { $inc: { storageUsed: req.file.size } },
                { new: true }
            );

            if (!updatedUser) {
                // Race condition caught or quota exceeded during processing
                await fs.unlink(req.file.path);
                const quotaMB = Math.round(USER_QUOTA_BYTES / (1024 * 1024));
                return res.status(400).json({ msg: `Storage quota exceeded. Your quota is ${quotaMB}MB.` });
            }

            const savedFile = await fileData.save();

            if (secondsUntilExpiry) {
                await valkeyClient.set(savedFile.uuid, savedFile.path, {
                    EX: secondsUntilExpiry,
                });
            } else {
                // Permanent file: Store in Valkey without expiry
                await valkeyClient.set(savedFile.uuid, savedFile.path);
            }

            return res.status(200).json({ uuid: savedFile.uuid });

        } catch (dbErr) {
            if (req.file && req.file.path) {
                await fs.unlink(req.file.path);
            }
            console.error(dbErr);
            return res.status(500).json({ msg: 'Error processing file.' });
        }
    });
});

module.exports = router;