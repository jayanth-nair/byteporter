const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const FileModel = require('../models/File');
const path = require('path');
const fs = require('fs');

let mongoServer;
let adminToken;

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

describe('Admin Reset Functionality', () => {
    beforeEach(async () => {
        await User.deleteMany({});
        await FileModel.deleteMany({});

        // Setup Admin
        await request(app).post('/api/admin/setup').send({
            username: 'admin',
            password: 'adminpassword'
        });
        const loginRes = await request(app).post('/api/users/login').send({
            username: 'admin',
            password: 'adminpassword'
        });
        adminToken = loginRes.headers['set-cookie'][0].split(';')[0];
    });

    it('should reset the system (wipe DB and uploads)', async () => {
        // 1. Create some data
        const user = new User({ username: 'victim', password: 'password' });
        await user.save();

        const filePath = path.join(__dirname, '..', 'uploads', 'todelete.txt');
        fs.writeFileSync(filePath, 'Goodbye World');

        // 2. Call Reset
        const res = await request(app)
            .post('/api/admin/reset')
            .set('Cookie', adminToken);

        expect(res.statusCode).toEqual(200);
        expect(res.body.msg).toEqual('System reset successfully');

        // 3. Verify Data Gone
        const users = await User.find();
        expect(users.length).toEqual(0); // Even admin should be gone (or maybe not? Logic says drop collections)

        // 4. Verify Files Gone
        expect(fs.existsSync(filePath)).toBeFalsy();
    });
});
