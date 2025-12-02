const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

let mongoServer;
let token;

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

describe('File Endpoints', () => {
    beforeEach(async () => {
        await User.deleteMany({});
        await request(app)
            .post('/api/users/register')
            .send({
                username: 'filesuser',
                password: 'password123'
            });

        const res = await request(app)
            .post('/api/users/login')
            .send({
                username: 'filesuser',
                password: 'password123'
            });
        token = res.headers['set-cookie'][0].split(';')[0];
    });

    it('should upload a file', async () => {
        const filePath = path.join(__dirname, 'testfile.txt');
        fs.writeFileSync(filePath, 'Hello World');

        const res = await request(app)
            .post('/api/upload')
            .set('Cookie', token)
            .attach('file', filePath)
            .field('expiration', '1d');

        fs.unlinkSync(filePath);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('uuid');
    });

    it('should list user files', async () => {
        const res = await request(app)
            .get('/api/files/my-files')
            .set('Cookie', token);

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBeTruthy();
    });
    it('should upload a file with password and verify download protection', async () => {
        const filePath = path.join(__dirname, 'secret.txt');
        fs.writeFileSync(filePath, 'Top Secret Data');

        const uploadRes = await request(app)
            .post('/api/upload')
            .set('Cookie', token)
            .attach('file', filePath)
            .field('expiration', '1d')
            .field('password', 'supersecret');

        fs.unlinkSync(filePath);
        expect(uploadRes.statusCode).toEqual(200);
        const uuid = uploadRes.body.uuid;

        const failRes1 = await request(app)
            .post(`/api/files/download/${uuid}`)
            .send({});
        expect(failRes1.statusCode).toEqual(401);
        expect(failRes1.body.msg).toBeDefined();

        const failRes2 = await request(app)
            .post(`/api/files/download/${uuid}`)
            .send({ password: 'wrongpassword' });
        expect(failRes2.statusCode).toEqual(401);
        expect(failRes2.body.msg).toBeDefined();

        const successRes = await request(app)
            .post(`/api/files/download/${uuid}`)
            .send({ password: 'supersecret' });
        expect(successRes.statusCode).toEqual(200);
    });

    it('should delete file after one-time download', async () => {
        const filePath = path.join(__dirname, 'burn.txt');
        fs.writeFileSync(filePath, 'Burn after reading');

        const uploadRes = await request(app)
            .post('/api/upload')
            .set('Cookie', token)
            .attach('file', filePath)
            .field('expiration', '1d')
            .field('oneTimeDownload', 'true');

        fs.unlinkSync(filePath);
        expect(uploadRes.statusCode).toEqual(200);
        const uuid = uploadRes.body.uuid;

        const downloadRes1 = await request(app)
            .post(`/api/files/download/${uuid}`)
            .send({});
        expect(downloadRes1.statusCode).toEqual(200);

        const downloadRes2 = await request(app)
            .post(`/api/files/download/${uuid}`)
            .send({});
        expect(downloadRes2.statusCode).toEqual(404);
        expect(downloadRes2.body.msg).toBeDefined();
    });
    it('should preview an image file', async () => {
        const filePath = path.join(__dirname, 'test.png');
        fs.writeFileSync(filePath, 'fake-image-content');

        const uploadRes = await request(app)
            .post('/api/upload')
            .set('Cookie', token)
            .attach('file', filePath)
            .field('expiration', '1d');

        fs.unlinkSync(filePath);
        const uuid = uploadRes.body.uuid;

        const previewRes = await request(app)
            .post(`/api/files/preview/${uuid}`)
            .send({});

        expect(previewRes.statusCode).toEqual(200);
    });

    it('should block preview for one-time download files', async () => {
        const filePath = path.join(__dirname, 'secret.txt');
        fs.writeFileSync(filePath, 'secret');

        const uploadRes = await request(app)
            .post('/api/upload')
            .set('Cookie', token)
            .attach('file', filePath)
            .field('expiration', '1d')
            .field('oneTimeDownload', 'true');

        fs.unlinkSync(filePath);
        expect(uploadRes.statusCode).toEqual(200);
        const uuid = uploadRes.body.uuid;

        const previewRes = await request(app)
            .post(`/api/files/preview/${uuid}`)
            .send({});

        expect(previewRes.statusCode).toEqual(403);
        expect(previewRes.body.msg).toBeDefined();
    });
});
