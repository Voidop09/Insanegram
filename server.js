const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// ========================================
// SUPABASE CONFIGURATION
// ========================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key-here';

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
// HELPER FUNCTION: Extract IP Address
// ========================================
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const remoteIP = req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (forwarded) {
        return forwarded.split(',')[0].trim().replace('::ffff:', '');
    }
    if (realIP) {
        return realIP.replace('::ffff:', '');
    }
    return (remoteIP || 'Unknown').replace('::ffff:', '');
}

// ========================================
// HELPER FUNCTION: Parse User Agent
// ========================================
function parseUserAgent(userAgent) {
    const ua = userAgent || '';
    
    // Detect device type
    let deviceType = 'Desktop';
    if (/mobile/i.test(ua)) deviceType = 'Mobile';
    if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';
    
    // Detect browser
    let browserName = 'Unknown';
    let browserVersion = '';
    
    if (ua.includes('Firefox/')) {
        browserName = 'Firefox';
        browserVersion = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] || '';
    } else if (ua.includes('Edg/')) {
        browserName = 'Edge';
        browserVersion = ua.match(/Edg\/(\d+\.\d+)/)?.[1] || '';
    } else if (ua.includes('Chrome/')) {
        browserName = 'Chrome';
        browserVersion = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] || '';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
        browserName = 'Safari';
        browserVersion = ua.match(/Version\/(\d+\.\d+)/)?.[1] || '';
    } else if (ua.includes('Opera') || ua.includes('OPR/')) {
        browserName = 'Opera';
        browserVersion = ua.match(/OPR\/(\d+\.\d+)/)?.[1] || '';
    }
    
    // Detect OS
    let osName = 'Unknown';
    let osVersion = '';
    
    if (ua.includes('Windows NT 10.0')) {
        osName = 'Windows';
        osVersion = '10';
    } else if (ua.includes('Windows NT 6.3')) {
        osName = 'Windows';
        osVersion = '8.1';
    } else if (ua.includes('Windows NT 6.2')) {
        osName = 'Windows';
        osVersion = '8';
    } else if (ua.includes('Windows NT 6.1')) {
        osName = 'Windows';
        osVersion = '7';
    } else if (ua.includes('Mac OS X')) {
        osName = 'macOS';
        osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
    } else if (ua.includes('Android')) {
        osName = 'Android';
        osVersion = ua.match(/Android (\d+\.\d+)/)?.[1] || '';
    } else if (ua.includes('iPhone') || ua.includes('iPad')) {
        osName = 'iOS';
        osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
    } else if (ua.includes('Linux')) {
        osName = 'Linux';
    }
    
    return {
        deviceType,
        browserName,
        browserVersion,
        osName,
        osVersion
    };
}

// ========================================
// VISITOR TRACKING ENDPOINT
// ========================================
app.post('/api/track-visitor', async (req, res) => {
    try {
        const ip = getClientIP(req);
        const userAgent = req.headers['user-agent'] || '';
        const {
            screenResolution,
            language,
            referrer,
            pageUrl
        } = req.body;
        
        const timestamp = new Date().toISOString();
        const { deviceType, browserName, browserVersion, osName, osVersion } = parseUserAgent(userAgent);
        
        console.log(`👁️ Visitor tracked: ${ip} | ${deviceType} | ${browserName} on ${osName}`);
        
        // Save to Supabase
        const { data, error } = await supabase
            .from('visitor_logs')
            .insert([
                {
                    ip_address: ip,
                    visit_timestamp: timestamp,
                    user_agent: userAgent,
                    device_type: deviceType,
                    browser_name: browserName,
                    browser_version: browserVersion,
                    os_name: osName,
                    os_version: osVersion,
                    screen_resolution: screenResolution,
                    language: language,
                    referrer: referrer,
                    page_url: pageUrl
                }
            ]);
        
        if (error) {
            console.error('❌ Supabase visitor tracking error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        console.log('✓ Visitor logged to Supabase');
        res.json({ success: true, message: 'Visitor tracked successfully' });
        
    } catch (err) {
        console.error('❌ Error tracking visitor:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

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
    const ip = getClientIP(req);
    
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
            .from('login_credentials')
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
    console.log(`👁️ Visitor tracking enabled`);
});
