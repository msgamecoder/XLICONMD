const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const http = require('http');
const QRCode = require('qrcode');
const { Boom } = require('@hapi/boom');
const sqlite3 = require('sqlite3').verbose();
const serializeMessage = require('./handler.js');

// ===== CONFIGURATION ===== //
global.BOT_PREFIX = '.';
const AUTH_FOLDER = './auth_info_multi';
const PLUGIN_FOLDER = './plugins';
const PORT = process.env.PORT || 3000;

const owners = [
    '25770239992037@lid',
    '233533763772@s.whatsapp.net'
];
global.owners = owners;

// Load config/session
let config = {};
try {
    config = require('./config.js');
} catch (e) {
    config = {
        sessionid: process.env.SESSION_ID || null
    };
}

// Use session from config if available
if (config.sessionid || process.env.SESSION_ID) {
    const sessionid = config.sessionid || process.env.SESSION_ID;
    try {
        const sessionData = JSON.parse(sessionid);
        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        }
        fs.writeFileSync(path.join(AUTH_FOLDER, 'creds.json'), JSON.stringify(sessionData, null, 2));
        console.log('✅ Session loaded from config');
    } catch (err) {
        console.error('❌ Failed to parse session from config:', err.message);
    }
}
// ========================= //

let latestQR = '';
let botStatus = 'disconnected';
let sock = null;
let isConnecting = false;
const db = new sqlite3.Database('./session.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        filename TEXT PRIMARY KEY,
        content TEXT
    );`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );`);
    db.get("SELECT value FROM settings WHERE key = 'prefix'", (err, row) => {
        if (!err && row) {
            global.BOT_PREFIX = row.value;
            console.log(` Loaded prefix: ${global.BOT_PREFIX}`);
        }
        startBot();
    });
});

function restoreAuthFiles() {
    return new Promise((resolve) => {
        db.all("SELECT * FROM sessions", (err, rows) => {
            if (err) return console.error("DB restore error:", err);
            if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER);
            rows.forEach(row => {
                fs.writeFileSync(path.join(AUTH_FOLDER, row.filename), row.content, 'utf8');
            });
            resolve();
        });
    });
}

async function startBot() {
    console.log(' Starting WhatsApp Bot...');
    isConnecting = true;
    
    try {
        await restoreAuthFiles();
        
        const credsPath = path.join(AUTH_FOLDER, 'creds.json');
        if (!fs.existsSync(credsPath)) {
            console.log('⚠️ No session found. Please add session to config.js:');
            console.log('   1. Get session from pairing website');
            console.log('   2. Copy the session JSON from WhatsApp');
            console.log('   3. Paste into config.js as sessionid');
            console.log('   4. Restart bot');
            botStatus = 'waiting_for_session';
            return;
        }
        
        const { version, isLatest } = await fetchLatestWaWebVersion();
        console.log(` Using WA v${version.join(".")}, isLatest: ${isLatest}`);

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        sock = makeWASocket({
            version, 
            logger: pino({ level: 'info' }),
            auth: state,
            printQRInTerminal: false,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            syncFullHistory: false
        });
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('Generating QR code...');
                QRCode.toDataURL(qr, (err, url) => { 
                    if (!err) latestQR = url;
                });
            }

            if (connection === 'close') {
                botStatus = 'disconnected';
                isConnecting = false;

                const statusCode = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output.statusCode
                    : 0;

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(
                    "Connection closed due to",
                    lastDisconnect?.error?.message,
                    ", reconnecting:",
                    shouldReconnect
                );

                if (shouldReconnect) {
                    console.log('Reconnecting in 10 seconds...');
                    setTimeout(() => startBot(), 10000);
                } else {
                    console.log('Logged out. Cleaning up...');
                    if (fs.existsSync(AUTH_FOLDER)) fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                    db.run("DELETE FROM sessions", (err) => { if (err) console.error('DB clear failed:', err); });
                    setTimeout(() => startBot(), 3000);
                }
            } else if (connection === 'open') {
                botStatus = 'connected';
                isConnecting = false;
                console.log('Bot is connected ✅');

                try { 
                    await sock.sendMessage(sock.user.id, { 
                        text: `✅ Xlicon Bot linked successfully!\nPrefix: ${global.BOT_PREFIX}` 
                    }); 
                } catch (err) { 
                    console.error('Could not send message:', err); 
                }
            } else if (connection === 'connecting') {
                botStatus = 'connecting';
                isConnecting = true;
                console.log('Bot is connecting...');
            }
        });

        sock.ev.on('creds.update', async () => {
            await saveCreds();
            // Save to DB
            try {
                if (fs.existsSync(AUTH_FOLDER)) {
                    fs.readdirSync(AUTH_FOLDER).forEach(file => {
                        const filePath = path.join(AUTH_FOLDER, file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        db.run("INSERT OR REPLACE INTO sessions (filename, content) VALUES (?, ?)", [file, content]);
                    });
                }
            } catch (error) {
                console.error('Error saving auth files to DB:', error);
            }
        });

        const plugins = new Map();
        const pluginPath = path.join(__dirname, PLUGIN_FOLDER);
        try {
            if (fs.existsSync(pluginPath)) {
                fs.readdirSync(pluginPath).forEach(file => {
                    if (file.endsWith('.js')) {
                        try {
                            const plugin = require(path.join(pluginPath, file));
                            if (plugin.name && typeof plugin.execute === 'function') {
                                plugins.set(plugin.name.toLowerCase(), plugin);
                                if (Array.isArray(plugin.aliases)) plugin.aliases.forEach(alias => plugins.set(alias.toLowerCase(), plugin));
                                console.log(`✅ Loaded plugin: ${plugin.name}`);
                            } else console.warn(`Invalid plugin structure in ${file}`);
                        } catch (error) {
                            console.error(`Failed to load plugin ${file}:`, error.message);
                        }
                    }
                });
                console.log(`📦 Loaded ${plugins.size} plugins`);
            }
        } catch (error) { console.error('Error loading plugins:', error); }
       
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            
            for (const rawMsg of messages) {
                if (rawMsg.key.remoteJid === 'status@broadcast' && rawMsg.key.participant) {
                    try {
                        await sock.readMessages([rawMsg.key]);
                        continue;
                    } catch (err) {}
                }
            }

            const rawMsg = messages[0];
            if (!rawMsg.message) return;

            const m = await serializeMessage(sock, rawMsg);

            if (m.body.startsWith(global.BOT_PREFIX)) {
                const args = m.body.slice(global.BOT_PREFIX.length).trim().split(/\s+/);
                const commandName = args.shift().toLowerCase();
                
                const plugin = plugins.get(commandName);
                if (plugin) {
                    try { await plugin.execute(sock, m, args); }
                    catch (err) { console.error(`Plugin error (${commandName}):`, err); }
                }
            }
            
            for (const plugin of plugins.values()) {
                if (typeof plugin.onMessage === 'function') {
                    try { await plugin.onMessage(sock, m); }
                    catch (err) { console.error(`onMessage error (${plugin.name}):`, err); }
                }
            }
        });

    } catch (error) {
        console.error('Bot startup error:', error);
        isConnecting = false;
        setTimeout(() => startBot(), 10000);
    }
}

// SIMPLE HTTP SERVER - ONLY STATUS API
const server = http.createServer((req, res) => {
    const url = req.url;
    
    if (url === '/api/status' || url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: botStatus,
            hasQR: !!latestQR,
            prefix: global.BOT_PREFIX,
            hasSession: fs.existsSync(path.join(AUTH_FOLDER, 'creds.json'))
        }));
    }
    
    else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'running',
            message: 'Xlicon WhatsApp Bot',
            endpoints: ['/api/status', '/status']
        }));
    }
});

server.listen(PORT, () => {
    console.log(`✅ Bot running on port ${PORT}`);
    console.log(`📊 Status API: http://localhost:${PORT}/api/status`);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
