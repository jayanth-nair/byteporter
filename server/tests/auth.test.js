const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');

let mongoServer;

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

describe('Auth Endpoints', () => {
    beforeEach(async () => {
        await User.deleteMany({});
    });

    it('should register a new user', async () => {
        const res = await request(app)
            .post('/api/users/register')
            .send({
                username: 'testuser',
                password: 'password123'
            });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('msg', 'User registered successfully');
    });

    it('should login an existing user', async () => {
        await request(app)
            .post('/api/users/register')
            .send({
                username: 'loginuser',
                password: 'password123'
            });

        const res = await request(app)
            .post('/api/users/login')
            .send({
                username: 'loginuser',
                password: 'password123'
            });
        expect(res.statusCode).toEqual(200);
        expect(res.headers['set-cookie']).toBeDefined();
        expect(res.body).toHaveProperty('msg', 'Logged in successfully');
    });

    it('should fail login with wrong password', async () => {
        await request(app)
            .post('/api/users/register')
            .send({
                username: 'failuser',
                password: 'password123'
            });

        const res = await request(app)
            .post('/api/users/login')
            .send({
                username: 'failuser',
                password: 'wrongpassword'
            });
        expect(res.statusCode).toEqual(400);
    });
});
