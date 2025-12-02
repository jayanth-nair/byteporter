// server/models/File.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const fileSchema = new mongoose.Schema({
    originalName: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
    uuid: { type: String, default: () => crypto.randomUUID(), required: true },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: { type: Date, default: Date.now },
    expiresAt: {
        type: Date,
        required: false
    },
    password: {
        type: String,
        required: false
    },
    oneTimeDownload: {
        type: Boolean,
        default: false
    }
});

fileSchema.index({ uuid: 1 });
fileSchema.index({ user: 1 });
fileSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('File', fileSchema);