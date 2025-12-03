// server/routes/config.js
const express = require('express');
const router = express.Router();

const SystemConfig = require('../models/SystemConfig');

const os = require('os');

router.get('/', async (req, res) => {
    try {
        const config = await SystemConfig.getConfig();

        res.json({
            maxFileSizeMB: Math.round(config.maxFileSize / (1024 * 1024)),
            defaultStorageQuotaMB: Math.round(config.defaultStorageQuota / (1024 * 1024)),
            // Only send clientUrl if it's set AND NOT localhost (to allow client-side auto-discovery)
            clientUrl: (process.env.CLIENT_URL && !process.env.CLIENT_URL.includes('localhost') && !process.env.CLIENT_URL.includes('127.0.0.1'))
                ? process.env.CLIENT_URL
                : undefined
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;