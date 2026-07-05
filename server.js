// ============================================================
// FILE: server.js (ไฟล์เดียวจบ - รัน Dashboard + Bot)
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');

// ============================================================
// CONFIG
// ============================================================
const TOKEN = process.env.TOKEN || 'ใส่_TOKEN_ของคุณตรงนี้';
const PORT = process.env.PORT || 3000;

// ============================================================
// EXPRESS SERVER
// ============================================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// ============================================================
// DISCORD BOT
// ============================================================
let botClient = null;
let botStatus = {
    running: false,
    tag: 'ไม่ได้ออนไลน์',
    guilds: 0,
    commands_used: 0,
    uptime: '0s',
    startTime: null
};

let commandsData = [];

function startBot() {
    if (botClient) {
        return { status: 'already_running' };
    }

    try {
        botClient = new Client({ 
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ] 
        });

        // ============================================================
        // เมื่อบอทพร้อม
        // ============================================================
        botClient.once('ready', async () => {
            botStatus.running = true;
            botStatus.tag = botClient.user.tag;
            botStatus.guilds = botClient.guilds.cache.size;
            botStatus.startTime = Date.now();
            
            console.log(`✅ บอท ${botClient.user.tag} ออนไลน์แล้ว!`);
            
            // ลงทะเบียน Slash Commands
            try {
                const commands = [
                    {
                        name: 'chat1',
                        description: 'ส่งข้อความสาธารณะซ้ำๆ',
                        options: [
                            {
                                name: 'message',
                                description: 'พิมพ์ข้อความที่ต้องการ',
                                type: 3,
                                required: true
                            },
                            {
                                name: 'amount',
                                description: 'จำนวนครั้ง (สูงสุด 20)',
                                type: 4,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'hello',
                        description: 'ทักทาย!',
                        options: []
                    },
                    {
                        name: 'status',
                        description: 'ดูสถานะบอท',
                        options: []
                    }
                ];
                
                const rest = new REST({ version: '10' }).setToken(TOKEN);
                await rest.put(
                    Routes.applicationCommands(botClient.user.id),
                    { body: commands }
                );
                
                console.log('✅ ลงทะเบียน Slash Commands สำเร็จ!');
            } catch (err) {
                console.error('❌ ลงทะเบียนล้มเหลว:', err.message);
            }
            
            io.emit('botStatus', botStatus);
        });

        // ============================================================
        // คำสั่ง Slash Commands
        // ============================================================
        botClient.on('interactionCreate', async interaction => {
            if (!interaction.isChatInputCommand()) return;
            
            botStatus.commands_used++;
            io.emit('botStatus', botStatus);
            
            try {
                if (interaction.commandName === 'hello') {
                    await interaction.reply(`👋 สวัสดี ${interaction.user.username}!`);
                }
                else if (interaction.commandName === 'status') {
                    const uptime = formatUptime(botStatus.startTime);
                    await interaction.reply({
                        embeds: [{
                            title: '📊 สถานะบอท',
                            color: 0x9466ff,
                            fields: [
                                { name: '🟢 สถานะ', value: 'ออนไลน์', inline: true },
                                { name: '📁 เซิร์ฟเวอร์', value: String(botStatus.guilds), inline: true },
                                { name: '📝 คำสั่งที่ใช้', value: String(botStatus.commands_used), inline: true },
                                { name: '⏱ อัปไทม์', value: uptime, inline: true }
                            ],
                            footer: { text: `บอท ${botClient.user.tag}` }
                        }]
                    });
                }
                else if (interaction.commandName === 'chat1') {
                    const message = interaction.options.getString('message');
                    const amount = Math.min(interaction.options.getInteger('amount') || 1, 20);
                    
                    const hiddenText = `กูไม่รับผิดชอบ ไอ่ควาย\nอยากรู้ว่าพวกกูเป็นใคร คลิกดิไอ่ควาย คลิกที่นี่\n\nhttps://discord.gg/tWndbkvXeQ`;
                    
                    await interaction.reply({
                        content: hiddenText,
                        ephemeral: true
                    });
                    
                    for (let i = 0; i < amount; i++) {
                        await interaction.followUp({
                            content: message,
                            ephemeral: false
                        });
                        if (amount > 1) {
                            await new Promise(resolve => setTimeout(resolve, 150));
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error:', error);
            }
        });

        // ============================================================
        // เข้าสู่ระบบ
        // ============================================================
        botClient.login(TOKEN);
        
        return { status: 'started' };
    } catch (error) {
        console.error('❌ เริ่มบอทล้มเหลว:', error);
        return { status: 'error', message: error.message };
    }
}

function stopBot() {
    if (botClient) {
        try {
            botClient.destroy();
            botClient = null;
            botStatus.running = false;
            botStatus.tag = 'ออฟไลน์';
            botStatus.startTime = null;
            io.emit('botStatus', botStatus);
            return { status: 'stopped' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
    return { status: 'not_running' };
}

function restartBot() {
    stopBot();
    setTimeout(() => {
        startBot();
    }, 1000);
    return { status: 'restarting' };
}

function formatUptime(startTime) {
    if (!startTime) return '0s';
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function getBotLogs() {
    // ใช้ log จริง
    return [
        { time: new Date().toLocaleTimeString(), message: '🟢 ระบบพร้อมใช้งาน' },
        { time: new Date().toLocaleTimeString(), message: `📊 สถานะ: ${botStatus.running ? 'ออนไลน์' : 'ออฟไลน์'}` },
        { time: new Date().toLocaleTimeString(), message: `📁 เซิร์ฟเวอร์: ${botStatus.guilds} ตัว` },
        { time: new Date().toLocaleTimeString(), message: `📝 คำสั่งที่ใช้: ${botStatus.commands_used} ครั้ง` },
    ];
}

// ============================================================
// API ROUTES
// ============================================================
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    const uptime = formatUptime(botStatus.startTime);
    res.json({ ...botStatus, uptime });
});

app.get('/api/logs', (req, res) => {
    res.json(getBotLogs());
});

app.post('/api/bot/start', (req, res) => {
    const result = startBot();
    res.json(result);
});

app.post('/api/bot/stop', (req, res) => {
    const result = stopBot();
    res.json(result);
});

app.post('/api/bot/restart', (req, res) => {
    const result = restartBot();
    res.json(result);
});

app.get('/api/bot/commands', (req, res) => {
    res.json([
        { name: '/chat1', description: 'ส่งข้อความซ้ำๆ' },
        { name: '/hello', description: 'ทักทาย' },
        { name: '/status', description: 'ดูสถานะบอท' }
    ]);
});

// ============================================================
// SOCKET.IO
// ============================================================
io.on('connection', (socket) => {
    console.log('🟢 Client connected');
    
    const uptime = formatUptime(botStatus.startTime);
    socket.emit('botStatus', { ...botStatus, uptime });
    socket.emit('logs', getBotLogs());
    
    socket.on('disconnect', () => {
        console.log('🔴 Client disconnected');
    });
});

// ============================================================
// START SERVER
// ============================================================
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`📁 เปิดใน Codespaces: https://${process.env.CODESPACE_NAME}-${PORT}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`);
    
    // เริ่มบอทอัตโนมัติ
    startBot();
});
