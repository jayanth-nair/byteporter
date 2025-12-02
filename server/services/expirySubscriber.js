// server/services/expirySubscriber.js
const { subscriber } = require('../config/valkeyClient');
const FileModel = require('../models/File');
const UserModel = require('../models/User');
const fs = require('fs/promises');
const path = require('path');

const startExpirySubscriber = async () => {
    try {
        if (!subscriber.isOpen) {
            await subscriber.connect();
        }

        await subscriber.subscribe('__keyevent@0__:expired', async (expiredKey) => {
            try {
                console.log(`Key expired: ${expiredKey}. Initiating cleanup.`);

                const fileUuid = expiredKey;

                const fileRecord = await FileModel.findOne({ uuid: fileUuid });
                if (!fileRecord) {
                    console.log(`No record found in DB for expired key: ${fileUuid}`);
                    return;
                }

                if (fileRecord.user && fileRecord.size > 0) {
                    await UserModel.findByIdAndUpdate(fileRecord.user, {
                        $inc: { storageUsed: -fileRecord.size }
                    });
                    console.log(`Storage quota updated for user: ${fileRecord.user}`);
                }

                try {
                    const filePath = path.join(__dirname, '..', fileRecord.path);
                    await fs.unlink(filePath);
                    console.log(`Successfully deleted file: ${fileRecord.originalName}`);
                } catch (fileErr) {
                    console.error(`Error deleting file from disk: ${fileRecord.originalName}`, fileErr);
                }

                await FileModel.deleteOne({ uuid: fileUuid });
                console.log(`Successfully deleted DB record for: ${fileRecord.originalName}`);
            } catch (err) {
                console.error(`Error processing expiry for key ${expiredKey}:`, err);
            }
        });

        console.log('Valkey subscriber listening for key expiration events...');

    } catch (err) {
        console.error('Valkey subscriber error:', err);
    }
};

module.exports = { startExpirySubscriber };