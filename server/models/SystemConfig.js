const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
    defaultStorageQuota: {
        type: Number,
        default: (parseInt(process.env.STORAGE_QUOTA_MB) || 1024) * 1024 * 1024 // Default from env or 1GB
    },
    maxFileSize: {
        type: Number,
        default: (parseInt(process.env.MAX_FILE_SIZE_MB) || 950) * 1024 * 1024 // Default from env or 950MB
    },
    isMaxFileSizeLinked: {
        type: Boolean,
        default: true
    },
    allowRegistration: {
        type: Boolean,
        default: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure only one config document exists
SystemConfigSchema.statics.getConfig = async function () {
    let config = await this.findOne();
    if (!config) {
        config = await this.create({});
    }
    return config;
};

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
