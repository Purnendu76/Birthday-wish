const express = require('express');
const cors = require('cors');
const schedule = require('node-schedule');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files (index.html, template.html, etc.)
app.use(express.static(__dirname));

// Initialize WhatsApp Web Client
const client = new Client({
    authStrategy: new LocalAuth(), // Saves session so you don't rescan QR every time
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let isWhatsAppReady = false;

client.on('qr', (qr) => {
    console.log('==================================================');
    console.log('SCAN THIS QR CODE WITH WHATSAPP LINKED DEVICES:');
    qrcode.generate(qr, { small: true });
    console.log('==================================================');
});

client.on('ready', () => {
    isWhatsAppReady = true;
    console.log('✅ WhatsApp Client is READY! Messages will be sent automatically.');
});

client.initialize();

// Database initialization
const dbPath = path.join(__dirname, 'db.json');
let db = {};
if (fs.existsSync(dbPath)) {
    db = JSON.parse(fs.readFileSync(dbPath));
}

function saveDb() {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// Endpoint to create a surprise
app.post('/api/schedule', (req, res) => {
    const { name, mobile, scheduledDate, photos } = req.body;
    
    if (!name || !mobile || !scheduledDate || !photos) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const surpriseId = crypto.randomUUID();
    
    // Save to our basic JSON DB
    db[surpriseId] = { name, scheduledDate, photos };
    saveDb();

    // Schedule the WhatsApp Message
    const sendTime = new Date(scheduledDate);
    
    // Generate the unique link for the recipient (auto-detects local vs production URL)
    const hostUrl = req.headers.origin || `http://localhost:${port}`;
    const surpriseLink = `${hostUrl}/template.html?id=${surpriseId}`;
    
    const messageText = `Happy Birthday ${name}! 🎉 I've prepared a special surprise for you.\n\nOpen this link to see your gift: ${surpriseLink}`;
    
    // Format the number for WhatsApp API
    let cleanNumber = mobile.replace(/\D/g, '');
    if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber; // Auto-append Indian country code
    }
    const targetNumber = cleanNumber + '@c.us';

    if (sendTime > new Date()) {
        console.log(`🕑 Scheduling message for ${name} at ${sendTime}...`);
        schedule.scheduleJob(sendTime, () => {
            if (!isWhatsAppReady) {
                console.log(`❌ WhatsApp is not ready! You MUST scan the QR code in the terminal first. Attempted to send to ${targetNumber}.`);
                return;
            }
            console.log(`🚀 Sending scheduled message to ${targetNumber} now!`);
            client.sendMessage(targetNumber, messageText).then(() => {
                console.log(`✅ Message sent successfully!`);
            }).catch(err => {
                console.error(`❌ Failed to send message: ${err}`);
            });
        });
    } else {
        // Send immediately if time is in the past
        if (!isWhatsAppReady) {
            console.log(`❌ WhatsApp is not ready! You MUST scan the QR code in the terminal first. Attempted to send to ${targetNumber}.`);
            return;
        }
        console.log(`🚀 Sending immediate message to ${targetNumber}`);
        client.sendMessage(targetNumber, messageText).then(() => {
            console.log(`✅ Message sent successfully!`);
        }).catch(console.error);
    }

    res.json({ success: true, surpriseId, message: "Surprise scheduled successfully!" });
});

// Endpoint to fetch surprise data
app.get('/api/surprise/:id', (req, res) => {
    const surprise = db[req.params.id];
    if (surprise) {
        res.json(surprise);
    } else {
        res.status(404).json({ error: 'Surprise not found' });
    }
});

app.listen(port, () => {
    console.log(`🌐 Server running at http://localhost:${port}`);
    console.log(`⏳ Waiting for WhatsApp authentication...`);
});
