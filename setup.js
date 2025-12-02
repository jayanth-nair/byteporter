const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    red: "\x1b[31m"
};

const log = (msg, color = COLORS.reset) => console.log(`${color}${msg}${COLORS.reset}`);

const runCommand = (command, cwd) => {
    try {
        execSync(command, { stdio: 'inherit', cwd });
    } catch (error) {
        log(`❌ Error executing command: ${command}`, COLORS.red);
        process.exit(1);
    }
};

const setup = async () => {
    log('\n🚀 Starting BytePorter Setup...\n', COLORS.bright + COLORS.cyan);

    // 1. Check Node Version
    const nodeVersion = process.version;
    log(`📦 Node.js Version: ${nodeVersion}`, COLORS.cyan);
    if (parseInt(nodeVersion.slice(1).split('.')[0]) < 18) {
        log('❌ Node.js v18+ is required.', COLORS.red);
        process.exit(1);
    }

    // 1.5 Check Docker Availability (Optional but recommended)
    try {
        execSync('docker --version', { stdio: 'ignore' });
        log('🐳 Docker is installed.', COLORS.cyan);
    } catch (e) {
        log('⚠️  Docker not found. You can run locally, but "npm start" (Docker) will fail.', COLORS.yellow);
    }

    // 2. Install Root Dependencies (concurrently)
    log('\n📦 Installing Root Dependencies...', COLORS.yellow);
    runCommand('npm install', __dirname);

    // 3. Install Server Dependencies
    log('\n📦 Installing Server Dependencies...', COLORS.yellow);
    runCommand('npm install', path.join(__dirname, 'server'));

    // 4. Install Client Dependencies
    log('\n📦 Installing Client Dependencies...', COLORS.yellow);
    runCommand('npm install', path.join(__dirname, 'client'));

    // 5. Setup Environment Variables
    log('\n🔐 Configuring Environment...', COLORS.yellow);
    const serverEnvPath = path.join(__dirname, 'server', '.env');
    const serverEnvExamplePath = path.join(__dirname, 'server', '.env.example');

    if (!fs.existsSync(serverEnvPath)) {
        if (fs.existsSync(serverEnvExamplePath)) {
            let envContent = fs.readFileSync(serverEnvExamplePath, 'utf8');

            // Generate Secure JWT Secret
            const randomSecret = crypto.randomBytes(64).toString('hex');
            envContent = envContent.replace('your_super_secret_jwt_key', randomSecret);

            fs.writeFileSync(serverEnvPath, envContent);
            log('✅ Created server/.env with a secure JWT_SECRET.', COLORS.green);
        } else {
            log('⚠️  server/.env.example not found. Skipping .env creation.', COLORS.red);
        }
    } else {
        log('ℹ️  server/.env already exists. Skipping creation.', COLORS.cyan);
    }

    log('\n✨ Setup Complete! You can now run:', COLORS.bright + COLORS.green);
    log('   npm run dev    (Run locally)', COLORS.cyan);
    log('   npm start      (Run with Docker)', COLORS.cyan);
    log('   npm run verify (Verify connections)', COLORS.cyan);
    log('\n');
};

setup();
