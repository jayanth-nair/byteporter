const mongoose = require('mongoose');
const { createClient } = require('redis');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const verifyConnections = async () => {
    console.log('----------------------------------------');

    let mongoConnected = false;
    let valkeyConnected = false;

    // 2. Verify MongoDB
    try {
        console.log('Connecting to MongoDB...');
        // Try env var first, then localhost
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/byteporter';
        console.log(`   Target: ${mongoUri}`);

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
        console.log('MongoDB Connection Successful!');
        mongoConnected = true;
    } catch (err) {
        console.error('MongoDB Connection Failed:', err.message);
    } finally {
        if (mongoConnected) await mongoose.disconnect();
    }

    console.log('----------------------------------------');

    // 3. Verify Valkey
    try {
        console.log('Connecting to Valkey...');
        let valkeyUrl = process.env.VALKEY_URL || 'redis://localhost:6379';
        console.log(`   Target: ${valkeyUrl}`);

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

        console.log('Valkey Connection Successful!');

        // Test Write/Read
        await valkeyClient.set('verify_test_key', 'working');
        const value = await valkeyClient.get('verify_test_key');
        if (value === 'working') {
            console.log('Valkey Read/Write Test Passed!');
        } else {
            console.error('Valkey Read/Write Test Failed.');
        }
        await valkeyClient.del('verify_test_key');

        valkeyConnected = true;
        await valkeyClient.quit();
    } catch (err) {
        console.error('Valkey Connection Failed:', err.message);
    }

    console.log('----------------------------------------');

    if (mongoConnected && valkeyConnected) {
        console.log('ALL SYSTEMS GO! Local environment is correctly configured.');
    } else {
        console.log('Some checks failed. Please review the errors above.');
    }
    process.exit(mongoConnected && valkeyConnected ? 0 : 1);
};

verifyConnections();
