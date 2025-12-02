// server/config/valkeyClient.js
const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

const valkeyUrl = process.env.NODE_ENV === 'test'
    ? 'redis://localhost:6379'
    : (process.env.VALKEY_URL || 'redis://localhost:6379');

const valkeyClient = createClient({
    url: valkeyUrl
});

valkeyClient.on('error', (err) => console.log('Valkey Client Error', err));
valkeyClient.on('connect', () => console.log('Valkey Connected...'));

const connectValkey = async () => {
    if (!valkeyClient.isOpen) {
        await valkeyClient.connect();

        // Auto-configure keyspace events (essential for expiry listeners)
        try {
            const config = await valkeyClient.configGet('notify-keyspace-events');
            if (!config['notify-keyspace-events'].includes('E') || !config['notify-keyspace-events'].includes('x')) {
                await valkeyClient.configSet('notify-keyspace-events', 'Ex');
            }
        } catch (err) {
            // Ignore error if command is restricted (e.g. managed cloud instances)
            console.warn('Note: Could not auto-configure Valkey keyspace events:', err.message);
        }
    }
};

const subscriber = valkeyClient.duplicate();

module.exports = { valkeyClient, subscriber, connectValkey };