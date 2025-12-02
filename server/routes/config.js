// server/routes/config.js
const express = require('express');
const router = express.Router();

const SystemConfig = require('../models/SystemConfig');

const os = require('os');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (localhost) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

router.get('/', async (req, res) => {
    try {
        const config = await SystemConfig.getConfig();

        // Auto-detect IP if CLIENT_URL is not set
        let clientUrl = process.env.CLIENT_URL;
        if (!clientUrl) {
            const ip = getLocalIp();
            clientUrl = `http://${ip}:${process.env.PORT || 5000}`;
        }

        res.json({
            maxFileSizeMB: Math.round(config.maxFileSize / (1024 * 1024)),
            defaultStorageQuotaMB: Math.round(config.defaultStorageQuota / (1024 * 1024)),
            clientUrl: clientUrl
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;