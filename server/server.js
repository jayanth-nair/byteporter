require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const uploadRoute = require('./routes/upload');
const downloadRoute = require('./routes/download');
const usersRoute = require('./routes/users');
const configRoute = require('./routes/config');
const { connectValkey } = require('./config/valkeyClient');
const { startExpirySubscriber } = require('./services/expirySubscriber');

const fs = require('fs');
const path = require('path');

// Connect to Services
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}
connectValkey();
startExpirySubscriber();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// Trust the first proxy (required for rate limiting behind proxies/load balancers)
app.set('trust proxy', 1);

// Middleware
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const { xss } = require('express-xss-sanitizer');
const compression = require('compression');

app.use(compression());

app.use(helmet());
const cookieParser = require('cookie-parser');
app.use(cookieParser());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: '10kb' }));


// Data Sanitization against NoSQL Query Injection
app.use(mongoSanitize());

// Data Sanitization against XSS
app.use(xss());

const PORT = process.env.PORT || 5000;

// Routes
app.get('/', (req, res) => {
    res.send('<h1>BytePorter Backend is Running!</h1>');
});

app.use('/api/upload', uploadRoute);
app.use('/api/files', downloadRoute);
app.use('/api/config', configRoute);
app.use('/api/users', usersRoute);
app.use('/api/admin', require('./routes/admin'));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        const clientPort = 3000; // Client is exposed on port 3000 in Docker
        console.log(`\n🚀 BytePorter is running!`);
        console.log(`   Local:   http://localhost:${clientPort}`);
        console.log(`   Network: To access from other devices, run 'ip addr' to find your LAN IP`);
        console.log(`            Then visit: http://<YOUR_LAN_IP>:${clientPort}\n`);
    });
}

module.exports = app;