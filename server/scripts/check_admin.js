require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const checkAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const admin = await User.findOne({ role: 'admin' });
        if (admin) {
            console.log('✅ Admin user FOUND:', admin.username);
        } else {
            console.log('❌ Admin user NOT FOUND');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error checking admin:', err);
        process.exit(1);
    }
};

checkAdmin();
