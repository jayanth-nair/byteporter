// server/routes/config.js
const express = require('express');
const router = express.Router();

const SystemConfig = require('../models/SystemConfig');

router.get('/', async (req, res) => {
    try {
        const config = await SystemConfig.getConfig();
        res.json({
            maxFileSizeMB: Math.round(config.maxFileSize / (1024 * 1024)),
            defaultStorageQuotaMB: Math.round(config.defaultStorageQuota / (1024 * 1024))
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;