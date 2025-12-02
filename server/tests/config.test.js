const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const path = require('path');
const fs = require('fs');

let mongoServer;
let adminToken;
let userToken;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.disconnect();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Global Configuration', () => {
    beforeEach(async () => {
        await User.deleteMany({});
        await SystemConfig.deleteMany({});

        await request(app).post('/api/admin/setup').send({
            username: 'admin',
            password: 'adminpassword'
        });
        const adminLogin = await request(app).post('/api/users/login').send({
            username: 'admin',
            password: 'adminpassword'
        });
        const adminCookies = adminLogin.headers['set-cookie'][0];
        adminToken = adminCookies.split(';')[0];

        await request(app).post('/api/users/register').send({
            username: 'user',
            password: 'userpassword'
        });
        const userLogin = await request(app).post('/api/users/login').send({
            username: 'user',
            password: 'userpassword'
        });
        const userCookies = userLogin.headers['set-cookie'][0];
        userToken = userCookies.split(';')[0];
    });

    it('should update global config via admin API', async () => {
        const res = await request(app)
            .put('/api/admin/config')
            .set('Cookie', adminToken)
            .send({
                maxFileSizeMB: 10,
                defaultStorageQuotaMB: 100,
                isMaxFileSizeLinked: false
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.maxFileSize).toEqual(10 * 1024 * 1024);
        expect(res.body.defaultStorageQuota).toEqual(100 * 1024 * 1024);
    });

    it('should enforce global max file size', async () => {
        await request(app)
            .put('/api/admin/config')
            .set('Cookie', adminToken)
            .send({ maxFileSizeMB: 1, isMaxFileSizeLinked: false });

        const filePath = path.join(__dirname, 'large_global.txt');
        const buffer = Buffer.alloc(2 * 1024 * 1024);
        fs.writeFileSync(filePath, buffer);

        const res = await request(app)
            .post('/api/upload')
            .set('Cookie', userToken)
            .attach('file', filePath)
            .field('expiration', '1d');

        fs.unlinkSync(filePath);

        expect(res.statusCode).toEqual(400);
        expect(res.body.msg).toContain('File is too large');
    });

    it('should enforce global default quota', async () => {
        // Set quota to 5MB, Max File Size to 4MB (valid)
        const updateRes = await request(app)
            .put('/api/admin/config')
            .set('Cookie', adminToken)
            .send({
                defaultStorageQuotaMB: 5,
                maxFileSizeMB: 4,
                isMaxFileSizeLinked: false
            });
        expect(updateRes.statusCode).toEqual(200);

        const filePath = path.join(__dirname, 'quota_global.txt');
        const buffer = Buffer.alloc(3 * 1024 * 1024); // 3MB file
        fs.writeFileSync(filePath, buffer);

        // Register user AFTER config update
        const newUserLogin = await request(app).post('/api/users/register').send({
            username: 'quotauser',
            password: 'password123'
        });
        await request(app).post('/api/users/login').send({
            username: 'quotauser',
            password: 'password123'
        }).then(res => {
            const cookies = res.headers['set-cookie'][0];
            userToken = cookies.split(';')[0];
        });

        // 1. Upload 3MB file (Should succeed)
        const res1 = await request(app)
            .post('/api/upload')
            .set('Cookie', userToken)
            .attach('file', filePath)
            .field('expiration', '1d');
        expect(res1.statusCode).toEqual(200);

        // 2. Upload another 3MB file (Should fail: 3+3=6 > 5)
        const res2 = await request(app)
            .post('/api/upload')
            .set('Cookie', userToken)
            .attach('file', filePath)
            .field('expiration', '1d');

        fs.unlinkSync(filePath);

        expect(res2.statusCode).toEqual(400);
        expect(res2.body.msg).toContain('Storage quota exceeded');
    });

    it('should auto-adjust max file size when quota is lowered', async () => {
        await request(app)
            .put('/api/admin/config')
            .set('Cookie', adminToken)
            .send({
                defaultStorageQuotaMB: 1000,
                maxFileSizeMB: 950
            });

        const res = await request(app)
            .put('/api/admin/config')
            .set('Cookie', adminToken)
            .send({
                defaultStorageQuotaMB: 500
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.defaultStorageQuota).toEqual(500 * 1024 * 1024);
        expect(res.body.maxFileSize).toEqual(475 * 1024 * 1024);
    });

    it('should respect manual override of max file size', async () => {
        const res = await request(app)
            .put('/api/admin/config')
            .set('Cookie', adminToken)
            .send({
                defaultStorageQuotaMB: 500,
                maxFileSizeMB: 475,
                isMaxFileSizeLinked: false
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.defaultStorageQuota).toEqual(500 * 1024 * 1024);
        expect(res.body.maxFileSize).toEqual(475 * 1024 * 1024);
    });
});
