const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server'); // Assuming server.js exports app, if not we might need to refactor or use a different approach
const User = require('../models/User');
const FileModel = require('../models/File');
const { valkeyClient, connectValkey } = require('../config/valkeyClient');
const fs = require('fs/promises');
const path = require('path');

let mongoServer;

beforeAll(async () => {
    console.log('TEST: Starting beforeAll...');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    console.log('TEST: Connected to MongoMemoryServer');

    // Ensure Valkey is connected
    if (!valkeyClient.isOpen) {
        console.log('TEST: Connecting to Valkey...');
        await valkeyClient.connect();
        console.log('TEST: Connected to Valkey');
    } else {
        console.log('TEST: Valkey already open');
    }
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    if (valkeyClient.isOpen) {
        await valkeyClient.quit();
    }
});

beforeEach(async () => {
    await User.deleteMany({});
    await FileModel.deleteMany({});
    await valkeyClient.flushAll();
});

describe('Full System Integration Test', () => {
    let token;
    let fileUuid;

    it('should complete a full lifecycle: Register -> Upload -> Verify Valkey -> Download -> Delete', async () => {
        // 1. Register User
        const registerRes = await request(app)
            .post('/api/users/register')
            .send({
                username: 'testuser',
                password: 'password123'
            });
        expect(registerRes.statusCode).toBe(201);

        // 1b. Login to get token
        const loginRes = await request(app)
            .post('/api/users/login')
            .send({
                username: 'testuser',
                password: 'password123'
            });
        expect(loginRes.statusCode).toBe(200);
        const cookies = loginRes.headers['set-cookie'][0];
        expect(cookies).toBeDefined();
        token = cookies.split(';')[0]; // Extract 'token=...' only

        // 2. Upload File
        // Create a dummy file
        const testFilePath = path.join(__dirname, 'testfile.txt');
        await fs.writeFile(testFilePath, 'This is a test file content.');

        const uploadRes = await request(app)
            .post('/api/upload')
            .set('Cookie', token)
            .attach('file', testFilePath)
            .field('expiration', '1h'); // 1 hour expiry

        expect(uploadRes.statusCode).toBe(200);
        expect(uploadRes.body).toHaveProperty('uuid');
        fileUuid = uploadRes.body.uuid;

        // Cleanup dummy file
        await fs.unlink(testFilePath);

        // 3. Verify Valkey Key Exists
        const valkeyKey = await valkeyClient.get(fileUuid);
        expect(valkeyKey).toBeTruthy(); // Key should exist

        // Verify TTL is set (approx 3600s)
        const ttl = await valkeyClient.ttl(fileUuid);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(3600);

        // 4. Download File (Metadata Check)
        const metaRes = await request(app)
            .get(`/api/files/${fileUuid}`);
        expect(metaRes.statusCode).toBe(200);
        expect(metaRes.body.uuid).toBe(fileUuid);

        // 5. Delete File
        const deleteRes = await request(app)
            .delete(`/api/files/${fileUuid}`)
            .set('Cookie', token);
        expect(deleteRes.statusCode).toBe(200);

        // 6. Verify Valkey Key Removed
        const valkeyKeyAfterDelete = await valkeyClient.get(fileUuid);
        expect(valkeyKeyAfterDelete).toBeNull();
    });

    it('should handle One-Time Download correctly (Burn on Access)', async () => {
        // 1. Register & Login (reuse logic or new user)
        const registerRes = await request(app)
            .post('/api/users/register')
            .send({ username: 'otd_user', password: 'password123' });

        expect(registerRes.statusCode).toBe(201);

        const loginRes = await request(app)
            .post('/api/users/login')
            .send({ username: 'otd_user', password: 'password123' });
        expect(loginRes.statusCode).toBe(200);
        const otdTokenHeader = loginRes.headers['set-cookie'][0];
        const otdToken = otdTokenHeader.split(';')[0];
        console.log('TEST: OTD Token:', otdToken);

        // 2. Upload with One-Time Download
        const testFilePath = path.join(__dirname, 'otd_test.txt');
        await fs.writeFile(testFilePath, 'Burn after reading.');

        const uploadRes = await request(app)
            .post('/api/upload')
            .set('Cookie', otdToken)
            .attach('file', testFilePath)
            .field('expiration', '1h')
            .field('oneTimeDownload', 'true');

        if (uploadRes.statusCode !== 200) {
            console.log('UPLOAD ERROR:', uploadRes.body);
        }
        expect(uploadRes.statusCode).toBe(200);
        const otdUuid = uploadRes.body.uuid;
        await fs.unlink(testFilePath);

        // 3. Verify Valkey Key Exists
        const valkeyKey = await valkeyClient.get(otdUuid);
        expect(valkeyKey).toBeTruthy();

        // 4. Download (Simulate)
        // Note: Actual download might be tricky to fully simulate with supertest if it streams, 
        // but we can trigger the endpoint.
        // We need to mock fs.access or ensure the file exists in uploads/ (which it should from the upload step)

        const downloadRes = await request(app)
            .post(`/api/files/download/${otdUuid}`)
            .send({}); // No password

        expect(downloadRes.statusCode).toBe(200);

        // 5. Verify Deletion (Immediate)
        // Check DB
        const fileRecord = await FileModel.findOne({ uuid: otdUuid });
        expect(fileRecord).toBeNull();

        // Check Valkey
        const valkeyKeyAfter = await valkeyClient.get(otdUuid);
        expect(valkeyKeyAfter).toBeNull();
    });
});
