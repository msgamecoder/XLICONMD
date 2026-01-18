const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, generateWAMessageFromContent, fetchLatestWaWebVersion, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const http = require('http');
const QRCode = require('qrcode');
const { Boom } = require('@hapi/boom');
const sqlite3 = require('sqlite3').verbose();
const { sendButtons, sendInteractiveMessage } = require('gifted-btns');
const serializeMessage = require('./handler.js');
global.generateWAMessageFromContent = generateWAMessageFromContent;
global.proto = proto;

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

// NEW: Load config/session
let config = {};
try {
    config = require('./config.js');
} catch (e) {
    // If config.js doesn't exist, try .env or environment variables
    config = {
        sessionid: process.env.SESSION_ID || null
    };
}

// NEW: Use session from config if available
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
let pairingCodes = new Map();
let presenceInterval = null;
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

function saveAuthFilesToDB() {
    try {
        if (!fs.existsSync(AUTH_FOLDER)) return;
        fs.readdirSync(AUTH_FOLDER).forEach(file => {
            const filePath = path.join(AUTH_FOLDER, file);
            const content = fs.readFileSync(filePath, 'utf8');
            db.run("INSERT OR REPLACE INTO sessions (filename, content) VALUES (?, ?)", [file, content], (err) => {
                if (err) console.error(`Failed to save ${file}:`, err);
            });
        });
    } catch (error) {
        console.error('Error saving auth files to DB:', error);
    }
}

async function startBot() {
    console.log(' Starting WhatsApp Bot...');
    isConnecting = true;
    
    try {
        await restoreAuthFiles();
        
        // Check if we have a session
        const credsPath = path.join(AUTH_FOLDER, 'creds.json');
        if (!fs.existsSync(credsPath)) {
            console.log('⚠️ No session found. Please add session to config.js or .env');
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
                console.log('Generating QR code for web...');
                QRCode.toDataURL(qr, (err, url) => { 
                    if (!err) {
                        latestQR = url;
                        console.log('QR code generated for web');
                    }
                });
            }

            if (connection === 'close') {
                botStatus = 'disconnected';
                isConnecting = false;
                if (presenceInterval) clearInterval(presenceInterval);

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

                presenceInterval = setInterval(() => {
                    if (sock?.ws?.readyState === 1) sock.sendPresenceUpdate('available');
                }, 10000);

                try { 
                    await sock.sendMessage(sock.user.id, { 
                        text: `✅ Bot linked successfully!\nCurrent prefix: ${global.BOT_PREFIX}\n\nTo update session:\n1. Get new session from pairing site\n2. Update config.js or .env file\n3. Restart bot` 
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
            saveAuthFilesToDB();
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
                        console.log(`📱 Status detected from: ${rawMsg.key.participant}`);
                        await sock.readMessages([rawMsg.key]);
                        console.log('✅ Status marked as viewed');
                        continue;
                    } catch (err) {
                        console.log('❌ Status viewer error:', err.message);
                    }
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
                    catch (err) { console.error(`Plugin error (${commandName}):`, err); await m.reply('Error running command.'); }
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

// SIMPLE HTML SERVER
const server = http.createServer((req, res) => {
    const url = req.url;
    
    if (url === '/' || url === '/qr') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
<html>
<head><title>WhatsApp Bot</title></head>
<body>
<center>
<h1>WhatsApp Bot</h1>
<h3>Status: ${botStatus}</h3>

${botStatus === 'waiting_for_session' ? `
<div style="background: #ffeb3b; padding: 20px; border-radius: 10px; margin: 20px;">
<h2>⚠️ No Session Found!</h2>
<p><strong>Add session to config.js or .env:</strong></p>
<pre style="background: #000; color: #0f0; padding: 10px; text-align: left;">
// config.js
module.exports = {
    sessionid: '{"noiseKey":{"private":{"type":"Buffer","data":"..."},...}'
}

// OR .env file
SESSION_ID={"noiseKey":{"private":{"type":"Buffer","data":"..."},...}
</pre>
</div>
` : ''}

${latestQR ? `
<h4>Scan QR Code</h4>
<img src="${latestQR}" width="300"><br><br>
` : ''}

<br><br>
<hr>
<p>Prefix: ${global.BOT_PREFIX} | Port: ${PORT}</p>
</center>

<script>
if("${botStatus}" !== "connected") {
    setTimeout(() => location.reload(), 5000);
}
</script>
</body>
</html>
        `);
    } 
    
    else if (url === '/reset') {
        // Clean session
        if (fs.existsSync(AUTH_FOLDER)) {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        }
        db.run("DELETE FROM sessions", () => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
<center>
<h2>Session Reset</h2>
<p>All session data cleared. Bot will restart.</p>
<a href="/">Home</a>
</center>
<script>
setTimeout(() => location.href = "/", 3000);
</script>
            `);
            setTimeout(() => process.exit(0), 2000);
        });
    }
    
    else if (url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: botStatus,
            hasQR: !!latestQR,
            qr: latestQR,
            prefix: global.BOT_PREFIX
        }));
    }
    
    else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<center><h1>404</h1><a href="/">Home</a></center>');
    }
});

server.listen(PORT, () => {
    console.log(`✅ Bot running at http://localhost:${PORT}`);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
