// ============================================================
// FILE: server.js - รองรับหลายบอท!
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');

// ============================================================
// โหลด Token จาก .env (แยกด้วยเครื่องหมาย ,)
// ============================================================
const TOKENS = process.env.TOKENS ? process.env.TOKENS.split(',') : [];
const PORT = process.env.PORT || 3000;

// ============================================================
// สร้างเว็บเซิร์ฟเวอร์
// ============================================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static('public'));

// ============================================================
// เก็บข้อมูลบอททั้งหมด
// ============================================================
let bots = {};

function createBot(token, id) {
    if (bots[id]) return;

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    bots[id] = {
        client: client,
        status: 'stopped',
        tag: 'ไม่ได้ออนไลน์',
        guilds: 0,
        commands: 0
    };

    client.once('ready', () => {
        bots[id].status = 'online';
        bots[id].tag = client.user.tag;
        bots[id].guilds = client.guilds.cache.size;
        console.log(`✅ บอท ${id} (${client.user.tag}) ออนไลน์แล้ว!`);
        io.emit('botStatus', bots);
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;
        bots[id].commands++;
        io.emit('botStatus', bots);

        if (interaction.commandName === 'hello') {
            await interaction.reply(`สวัสดี ${interaction.user.username}!`);
        }
    });

    client.login(token).catch(err => {
        console.error(`❌ บอท ${id} ล็อกอินล้มเหลว:`, err.message);
        bots[id].status = 'error';
    });
}

function startBot(id) {
    const token = TOKENS[parseInt(id) - 1];
    if (!token) return { status: 'error', message: 'ไม่พบ Token' };
    if (bots[id] && bots[id].status === 'online') {
        return { status: 'already_running' };
    }
    createBot(token, id);
    return { status: 'started' };
}

function stopBot(id) {
    if (bots[id] && bots[id].client) {
        bots[id].client.destroy();
        bots[id].status = 'stopped';
        bots[id].tag = 'ออฟไลน์';
        io.emit('botStatus', bots);
        return { status: 'stopped' };
    }
    return { status: 'not_running' };
}

// ============================================================
// API Routes
// ============================================================
app.get('/api/status', (req, res) => {
    res.json(bots);
});

app.post('/api/bot/:id/start', (req, res) => {
    const result = startBot(req.params.id);
    res.json(result);
});

app.post('/api/bot/:id/stop', (req, res) => {
    const result = stopBot(req.params.id);
    res.json(result);
});

// ============================================================
// WebSocket
// ============================================================
io.on('connection', (socket) => {
    console.log('🟢 มีคนเข้ามาดูเว็บ');
    socket.emit('botStatus', bots);
});

// ============================================================
// เริ่มเซิร์ฟเวอร์
// ============================================================
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 เปิดเว็บที่: http://localhost:${PORT}`);
    console.log(`📁 เปิดใน Codespaces: https://${process.env.CODESPACE_NAME}-${PORT}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`);
    console.log(`🤖 พบ ${TOKENS.length} บอท`);

    // เริ่มบอททั้งหมดอัตโนมัติ (ถ้าอยาก)
    // TOKENS.forEach((token, i) => createBot(token, String(i + 1)));
});
