const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// Muat variabel .env sederhana tanpa dependensi tambahan.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    envLines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const separator = trimmed.indexOf('=');
        if (separator === -1) return;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim();
        if (key && process.env[key] == null) {
            process.env[key] = value;
        }
    });
}

// --- Inisialisasi Server (Express + WebSocket) ---
const app = express();
const server = http.createServer(app);

// WebSocket server untuk pure WebSocket tunneling
const wss = new WebSocket.Server({ server });

const port = Number(process.env.PORT) || 3001;
const localIp = process.env.LOCAL_IP || '127.0.0.1';

// Storage untuk tracking connected clients
const allConnections = new Map(); // Map<connClientKey, { type: 'device'|'dashboard', ws, deviceName?, userId? }>

// Middleware
app.use(cors());
app.use(express.json());

// Serve file statis HTML/JS dari root folder
app.use(express.static(__dirname));

// Arahkan GET / ke index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- KONEKSI DATABASE SQLITE ---
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err);
        return;
    }
    console.log('Successfully connected to database.sqlite! 🔌');

    // Inisialisasi tabel jika belum ada
    db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS devices (
        device_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_name TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        public_slug TEXT UNIQUE,
        FOREIGN KEY(user_id) REFERENCES users(user_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS widgets (
        widget_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_id INTEGER NOT NULL,
        sensor_type TEXT NOT NULL,
        widget_type TEXT NOT NULL,
        data_type TEXT NOT NULL,
        current_value TEXT,
        FOREIGN KEY(user_id) REFERENCES users(user_id),
        FOREIGN KEY(device_id) REFERENCES devices(device_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
        data_id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        sensor_type TEXT NOT NULL,
        value TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(device_id) REFERENCES devices(device_id)
    )`);
});

// --- KUNCI JWT ---
const JWT_SECRET = 'INI_ADAH_KUNCI_RAHASIA_SAYA_UNTUK_SKRIPSI_2025'; // Ganti dengan kunci rahasia Anda sendiri

// --- MIDDLEWARE OTORISASI ---
const autentikasiToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        next();
    });
};

// (Ini untuk Socket.IO) Daftar user yang sedang online
const userSockets = {}; // { userId: socketId }

// --- ENDPOINT AUTENTIKASI ---

// 1. REGISTER
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ status: 'error', message: 'Username, email, dan password wajib diisi' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
        db.run(query, [username, email, hashedPassword], function(err) {
            if (err) {
                if (err.message && err.message.includes('UNIQUE')) {
                    return res.status(409).json({ status: 'error', message: 'Username atau Email sudah terdaftar' });
                }
                console.error('Error saat registrasi:', err);
                return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
            }
            res.status(201).json({ status: 'success', message: 'User berhasil terdaftar!' });
        });
    } catch (error) {
        console.error('Error saat hashing password:', error);
        res.status(500).json({ status: 'error', message: 'Server error saat memproses password' });
    }
});

// 2. LOGIN
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username dan Password wajib diisi' });
    }
    const query = 'SELECT * FROM users WHERE username = ?';
    db.get(query, [username], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Username atau Password salah' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Username atau Password salah' });
        }
        const token = jwt.sign(
            { userId: user.user_id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ message: 'Login berhasil!', token: token });
    });
});

// --- ENDPOINT DEVICES ---

// Hanya untuk mendapatkan list device (dari database)
app.get('/api/devices', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    const query = 'SELECT device_id, device_name FROM devices WHERE user_id = ?';

    db.all(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching devices:', err);
            return res.status(500).json({ message: 'Gagal mengambil data device' });
        }
        res.json(results);
    });
});

// Menambah device (hanya input nama, tanpa API Key)
app.post('/api/devices', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    const { device_name } = req.body;
    if (!device_name) {
        return res.status(400).json({ message: 'Nama perangkat wajib diisi' });
    }
    const query = 'INSERT INTO devices (user_id, device_name, api_key) VALUES (?, ?, ?)';
    db.run(query, [userId, device_name, ''], function(err) {
        if (err) {
            console.error('Error registering device:', err);
            return res.status(500).json({ message: 'Gagal mendaftarkan device' });
        }
        res.status(201).json({ message: 'Device berhasil terdaftar', device_id: this.lastID, device_name: device_name });
    });
});

// Menghapus perangkat
app.delete('/api/devices/:id', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    const deviceId = req.params.id;
    const query = 'DELETE FROM devices WHERE device_id = ? AND user_id = ?';
    db.run(query, [deviceId, userId], function(err) {
        if (err) {
            console.error('Error deleting device:', err);
            return res.status(500).json({ message: 'Gagal menghapus perangkat' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Perangkat tidak ditemukan' });
        }
        res.status(200).json({ message: 'Perangkat (dan semua data terkait) berhasil dihapus' });
    });
});


// --- ENDPOINT DATA SENSOR ---
// DIHAPUS: POST /api/data (Semua data sekarang melalui WebSocket)

// 2. Mengambil data (UNTUK DASHBOARD - 24 jam terakhir) - Tetap via HTTP untuk efisiensi
app.get('/api/data', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
        const query = `
            SELECT sd.sensor_type, sd.value, sd.timestamp, d.device_id
            FROM sensor_data AS sd
            JOIN devices AS d ON sd.device_id = d.device_id
            WHERE d.user_id = ? AND sd.timestamp >= datetime('now', '-1 day')
            ORDER BY sd.timestamp ASC;
        `;
    db.all(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ message: 'Gagal mengambil data' });
        }
        res.json(results);
    });
});

// 2. Mengambil data (UNTUK DASHBOARD - 24 jam terakhir)
app.get('/api/data', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
        const query = `
            SELECT sd.sensor_type, sd.value, sd.timestamp, d.device_id
            FROM sensor_data AS sd
            JOIN devices AS d ON sd.device_id = d.device_id
            WHERE d.user_id = ? AND sd.timestamp >= datetime('now', '-1 day')
            ORDER BY sd.timestamp ASC;
        `;
    db.all(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ message: 'Gagal mengambil data' });
        }
        res.json(results);
    });
});

// 3. Mengambil data 2 kolom untuk CSV (Sesuai permintaan terakhir Anda)
app.get('/api/data/device/:id', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    const deviceId = req.params.id;

    const query = `
        SELECT sd.timestamp, sd.sensor_type, sd.value
        FROM sensor_data AS sd
        JOIN devices AS d ON sd.device_id = d.device_id
        WHERE sd.device_id = ? AND d.user_id = ?
        ORDER BY sd.timestamp DESC;
    `;
    db.all(query, [deviceId, userId], (err, results) => {
        if (err) {
            console.error('Error fetching device data for CSV:', err);
            return res.status(500).json({ message: 'Gagal mengambil data' });
        }
        res.json(results);
    });
});


// --- ENDPOINT WIDGETS ---

// 1. Membuat widget baru (termasuk toggle)
app.post('/api/widgets', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    const { device_id, sensor_type, widget_type, data_type } = req.body;

    if (!device_id || !sensor_type || !widget_type || !data_type) {
        return res.status(400).json({ message: 'Semua field wajib diisi' });
    }

    // --- PERUBAHAN DI SINI ---
    // Tentukan nilai awal: Toggle='false', Slider='0', Lainnya=''
    let defaultValue = '';
    if (widget_type === 'toggle') defaultValue = 'false';
    if (widget_type === 'slider') defaultValue = '0'; 
    // --------------------------

    const query = 'INSERT INTO widgets (user_id, device_id, sensor_type, widget_type, data_type, current_value) VALUES (?, ?, ?, ?, ?, ?)';
    
    db.run(query, [userId, device_id, sensor_type, widget_type, data_type, defaultValue], function(err) {
        if (err) {
            console.error('Error creating widget:', err);
            return res.status(500).json({ message: 'Gagal membuat widget' });
        }
        res.status(201).json({ message: 'Widget berhasil dibuat!', widgetId: this.lastID });
    });
});

// 2. Mengambil semua widget (termasuk current_value)
app.get('/api/widgets', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    const query = `
      SELECT w.widget_id, w.device_id, w.sensor_type, w.widget_type,
             w.data_type, w.current_value, d.device_name
      FROM widgets AS w
      JOIN devices AS d ON w.device_id = d.device_id
      WHERE w.user_id = ?;
    `;
    db.all(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching widgets:', err);
            return res.status(500).json({ message: 'Gagal mengambil widgets' });
        }
        res.json(results);
    });
});

// 3. Menghapus widget
app.delete('/api/widgets/:id', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    const widgetId = req.params.id;
    const query = 'DELETE FROM widgets WHERE widget_id = ? AND user_id = ?';
    db.run(query, [widgetId, userId], function(err) {
        if (err) {
            console.error('Error deleting widget:', err);
            return res.status(500).json({ message: 'Gagal menghapus widget' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Widget tidak ditemukan' });
        }
        res.status(200).json({ message: 'Widget berhasil dihapus' });
    });
});


// --- LOGIKA REAL-TIME WEBSOCKET TUNNELING (BROKER) ---
// Pure WebSocket: Gaada API Key, hanya query parameter device identifier

wss.on('connection', (ws, req) => {
    const parsedUrl = url.parse(req.url, true);
    const query = parsedUrl.query;
    const token = query.token;      // Dashboard: JWT token
    const deviceName = query.device; // Device: device identifier (nama)
    
    let clientType = null;      // 'device' atau 'dashboard'
    let userId = null;          // Jika dashboard
    let connClientKey = null;   // Unique identifier untuk koneksi ini
    
    console.log(`[WebSocket] Koneksi baru - Device: ${deviceName}, Token: ${token ? 'ada' : 'tidak'}`);
    
    // --- CASE 1: Device Connect (Open Connection, tidak perlu auth khusus) ---
    if (deviceName && !token) {
        clientType = 'device';
        connClientKey = `device:${deviceName}`;
        
        // Hapus koneksi device lama dengan nama yang sama jika ada
        const oldKey = Array.from(allConnections.entries()).find(
            ([key, val]) => key.startsWith('device:') && val.deviceName === deviceName
        );
        if (oldKey) {
            allConnections.get(oldKey[0]).ws.close();
            allConnections.delete(oldKey[0]);
        }
        
        allConnections.set(connClientKey, { type: 'device', ws, deviceName });
        console.log(`[✓ Device] Terhubung - "${deviceName}"`);
    }
    
    // --- CASE 2: Dashboard Connect (Perlu JWT Token) ---
    else if (token && !deviceName) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.log(`[WebSocket] Dashboard ditolak - Token tidak valid`);
                ws.close(1008, 'Token tidak valid');
                return;
            }
            
            clientType = 'dashboard';
            userId = user.userId;
            connClientKey = `dashboard:${user.userId}:${Date.now()}:${Math.random()}`;
            
            allConnections.set(connClientKey, { type: 'dashboard', ws, userId, username: user.username });
            
            console.log(`[✓ Dashboard] Terhubung - User: ${user.username} (ID: ${userId})`);
        });
    }
    
    else {
        console.log(`[✗ Koneksi Ditolak] Butuh ?device=xxx (device) atau ?token=xxx (dashboard)`);
        ws.close(1008, 'Argument tidak valid');
        return;
    }
    
    // --- MESSAGE HANDLER ---
    ws.on('message', (rawMessage) => {
        if (!clientType || !connClientKey) return;
        
        try {
            const data = JSON.parse(rawMessage.toString());
            
            // --- DEVICE SENDS SENSOR DATA ---
            if (clientType === 'device') {
                const { sensor_type, value } = data;
                if (!sensor_type || value === undefined) {
                    console.error('[Device] Pesan tidak valid - butuh sensor_type & value');
                    return;
                }
                
                console.log(`[Device "${deviceName}"] Kirim data:`, { sensor_type, value });
                
                // Broadcast ke semua dashboard
                broadcastToAllDashboards({
                    device: deviceName,
                    sensor_type: sensor_type,
                    value: value,
                    timestamp: new Date().toISOString()
                });
            }
            
            // --- DASHBOARD SENDS COMMAND TO DEVICE ---
            else if (clientType === 'dashboard') {
                const { device, sensor_type, value } = data;
                if (!device || !sensor_type || value === undefined) {
                    console.error('[Dashboard] Pesan tidak valid - butuh device, sensor_type & value');
                    return;
                }
                
                console.log(`[Dashboard User ${userId}] Command ke "${device}":`, { sensor_type, value });
                
                // Cari device connection
                const deviceKey = Array.from(allConnections.entries()).find(
                    ([key, val]) => val.type === 'device' && val.deviceName === device
                );
                
                if (deviceKey && deviceKey[1].ws.readyState === WebSocket.OPEN) {
                    const command = { sensor_type, value };
                    deviceKey[1].ws.send(JSON.stringify(command));
                    console.log(`[✓ Command] Sent to "${device}"`);
                } else {
                    console.log(`[✗ Device] "${device}" tidak terhubung`);
                }
            }
            
        } catch (parseErr) {
            console.error('[WebSocket] Parse error:', parseErr.message);
        }
    });
    
    // --- CLOSE HANDLER ---
    ws.on('close', () => {
        if (connClientKey) {
            allConnections.delete(connClientKey);
            
            if (clientType === 'device') {
                console.log(`[Device] Terputus - "${deviceName}"`);
            } else if (clientType === 'dashboard') {
                console.log(`[Dashboard] Terputus - User ID ${userId}`);
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('[WebSocket Error]', error.message);
    });
});

// --- Helper: Broadcast ke semua dashboard ---
function broadcastToAllDashboards(data) {
    const payload = JSON.stringify(data);
    
    allConnections.forEach((conn, key) => {
        if (conn.type === 'dashboard' && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(payload);
        }
    });
}


app.get('/api/public/data', (req, res) => {
    const { username, device_name } = req.query;

    if (!username || !device_name) {
        return res.status(400).json({ message: 'Username dan device_name wajib diisi' });
    }

    // 1. Cari device_id berdasarkan username & device_name
    // Kita perlu JOIN tabel users dan devices
    const queryDevice = `
        SELECT d.device_id, d.device_name
        FROM devices d
        JOIN users u ON d.user_id = u.user_id
        WHERE u.username = ? AND d.device_name = ?
    `;

    db.all(queryDevice, [username, device_name], (err, devices) => {
        if (err) {
            console.error('Error public device lookup:', err);
            return res.status(500).json({ message: 'Server error' });
        }
        if (devices.length === 0) {
            return res.status(404).json({ message: 'Perangkat tidak ditemukan atau user salah' });
        }

        const deviceId = devices[0].device_id;

        // 2. Ambil Widget (untuk tahu tipe grafik apa yang harus ditampilkan)
        const queryWidgets = `
            SELECT sensor_type, widget_type, data_type, current_value 
            FROM widgets 
            WHERE device_id = ?
        `;

        // 3. Ambil Data Sensor (24 jam terakhir)
        const queryData = `
            SELECT sensor_type, value, timestamp 
            FROM sensor_data 
            WHERE device_id = ? AND timestamp >= datetime('now', '-1 day') 
            ORDER BY timestamp ASC
        `;

        // Eksekusi query widget & data secara paralel (sederhana)
        db.all(queryWidgets, [deviceId], (errW, widgets) => {
            if (errW) return res.status(500).json({ message: 'Error fetching widgets' });

            db.all(queryData, [deviceId], (errD, sensorData) => {
                if (errD) return res.status(500).json({ message: 'Error fetching data' });

                // Kirim paket lengkap untuk publik
                res.json({
                    device_info: devices[0],
                    widgets: widgets,
                    data: sensorData
                });
            });
        });
    });
});


// --- FITUR SHARE / PUBLIC VIEW ---

// 1. Serve File HTML Public saat URL '/nama_custom' diakses
// Ini membuat URL terlihat profesional: http://ip:3001/kebunku
app.get('/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-view.html'));
});

// 2. API untuk menyimpan Custom URL (Slug)
app.post('/api/devices/share', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    const { device_id, custom_slug } = req.body;

    // Validasi format slug (hanya huruf, angka, strip)
    const slugRegex = /^[a-zA-Z0-9-_]+$/;
    if (!slugRegex.test(custom_slug)) {
        return res.status(400).json({ message: 'Nama URL hanya boleh huruf, angka, dan tanda strip (-).' });
    }

    // Update database
    const query = 'UPDATE devices SET public_slug = ? WHERE device_id = ? AND user_id = ?';
    db.run(query, [custom_slug, device_id, userId], function(err) {
        if (err) {
            if (err.message && err.message.includes('UNIQUE')) {
                return res.status(409).json({ message: 'Nama URL ini sudah dipakai orang lain. Pilih nama lain.' });
            }
            return res.status(500).json({ message: 'Gagal menyimpan URL.' });
        }
        res.json({ message: 'URL publik berhasil dibuat!', url: `/${custom_slug}` });
    });
});

// 3. API Publik untuk mengambil data berdasarkan Slug
app.get('/api/public/view/:slug', (req, res) => {
    const slug = req.params.slug;

    // Cari device berdasarkan slug
    const queryDevice = 'SELECT device_id, device_name FROM devices WHERE public_slug = ?';

    db.get(queryDevice, [slug], (err, device) => {
        if (err || !device) {
            return res.status(404).json({ message: 'Halaman tidak ditemukan.' });
        }

        const deviceId = device.device_id;
        const deviceName = device.device_name;

        // Ambil Widgets
        const queryWidgets = "SELECT sensor_type, widget_type, data_type, current_value FROM widgets WHERE device_id = ?";
        const queryData = "SELECT sensor_type, value, timestamp FROM sensor_data WHERE device_id = ? AND timestamp >= datetime('now', '-1 day') ORDER BY timestamp ASC";

        db.all(queryWidgets, [deviceId], (errW, widgets) => {
            if (errW) return res.status(500).json({ message: 'Error widgets' });

            db.all(queryData, [deviceId], (errD, sensorData) => {
                if (errD) return res.status(500).json({ message: 'Error data' });

                res.json({
                    device_id: deviceId,
                    device_name: deviceName,
                    widgets: widgets,
                    data: sensorData
                });
            });
        });
    });
});

// --- Jalankan Server ---
server.listen(port, '0.0.0.0', () => {
    console.log(`Server (Express + WebSocket) berjalan di http://localhost:${port}`);
    console.log(`Akses dari jaringan lokal: http://${localIp}:${port}`);
});
