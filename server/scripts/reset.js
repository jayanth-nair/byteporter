require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('redis');

const resetSystem = async () => {
    try {
        console.log('Connecting to MongoDB...');
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/byteporter';

        try {
            await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
        } catch (initialErr) {
            if (mongoUri.includes('mongo:')) {
                console.log('   Docker hostname failed. Retrying with localhost...');
                await mongoose.connect('mongodb://localhost:27017/byteporter', { serverSelectionTimeoutMS: 2000 });
            } else {
                throw initialErr;
            }
        }
        console.log('MongoDB Connected');

        console.log('Connecting to Valkey...');
        let valkeyUrl = process.env.VALKEY_URL || 'redis://localhost:6379';

        const tryConnect = async (url) => {
            const client = createClient({ url });
            client.on('error', (err) => { /* Suppress default error listener to avoid crash */ });
            await client.connect();
            return client;
        };

        let valkeyClient;
        try {
            valkeyClient = await tryConnect(valkeyUrl);
        } catch (initialErr) {
            if (valkeyUrl.includes('valkey:') || valkeyUrl.includes('redis:')) {
                console.log('   Docker hostname failed. Retrying with localhost...');
                valkeyClient = await tryConnect('redis://localhost:6379');
            } else {
                throw initialErr;
            }
        }
        console.log('Clearing Valkey...');
        await valkeyClient.flushAll();
        await valkeyClient.quit();
        console.log('Dropping MongoDB collections...');
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            try {
                await collection.drop();
                console.log(`   - Dropped ${collection.collectionName}`);
            } catch (error) {
                if (error.code === 26) {
                    console.log(`   - Skipped ${collection.collectionName} (Namespace not found)`);
                } else {
                    console.error(`   - Error dropping ${collection.collectionName}:`, error.message);
                }
            }
        }

        console.log('Clearing uploads directory...');
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        try {
            const files = await fs.readdir(uploadsDir);
            for (const file of files) {
                if (file !== '.gitkeep') {
                    await fs.unlink(path.join(uploadsDir, file));
                }
            }
            console.log(`   - Deleted ${files.length} files from uploads/`);
        } catch (err) {
            console.error('   - Error clearing uploads:', err.message);
        }

        console.log('System Reset Complete!');
        process.exit(0);

    } catch (err) {
        console.error('Error during reset:', err);
        process.exit(1);
    }
};

resetSystem();
