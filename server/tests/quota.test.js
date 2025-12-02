const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

let mongoServer;
let adminToken;
let userToken;
let userId;

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

describe('Dynamic Storage Quotas', () => {
    beforeEach(async () => {
        await User.deleteMany({});

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

        const user = await User.findOne({ username: 'user' });
        userId = user._id;
    });

    it('should allow upload within default quota', async () => {
        const filePath = path.join(__dirname, 'small.txt');
        fs.writeFileSync(filePath, 'Small file content');

        const res = await request(app)
            .post('/api/upload')
            .set('Cookie', userToken)
            .attach('file', filePath)
            .field('expiration', '1d');

        fs.unlinkSync(filePath);
        expect(res.statusCode).toEqual(200);
    });

    it('should update user quota via admin API', async () => {
        const res = await request(app)
            .patch(`/api/admin/users/${userId}/quota`)
            .set('Cookie', adminToken)
            .send({ quotaInMB: 10 });

        expect(res.statusCode).toEqual(200);
        expect(res.body.storageQuota).toEqual(10 * 1024 * 1024);
    });

    it('should enforce custom user quota', async () => {
        await request(app)
            .patch(`/api/admin/users/${userId}/quota`)
            .set('Cookie', adminToken)
            .send({ quotaInMB: 1 });

        const filePath = path.join(__dirname, 'large.txt');
        const buffer = Buffer.alloc(2 * 1024 * 1024);
        fs.writeFileSync(filePath, buffer);

        const res = await request(app)
            .post('/api/upload')
            .set('Cookie', userToken)
            .attach('file', filePath)
            .field('expiration', '1d');

        fs.unlinkSync(filePath);

        expect(res.statusCode).toEqual(400);
        expect(res.body.msg).toContain('Storage quota exceeded');
    });
});
