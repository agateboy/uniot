const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const { generateSecretKey } = require('./lib/secretKeyGenerator');

const DB_TYPE = process.env.DB_TYPE || 'mysql';  // 'mysql' atau 'sqlite'

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

// MESSAGE QUEUE SYSTEM: Async processing untuk mencegah message bottleneck
class MessageQueue {
    constructor(maxConcurrent = 50) {
        this.queue = [];
        this.processing = 0;
        this.maxConcurrent = maxConcurrent;
        this.priorityQueues = new Map(); // Separate queues per priority level
        this.activeByPriority = new Map();
    }

    // Tambah message ke queue dengan priority (command = priority 1, data = priority 0)
    enqueue(message, priority = 0) {
        if (!this.priorityQueues.has(priority)) {
            this.priorityQueues.set(priority, []);
            this.activeByPriority.set(priority, 0);
        }
        this.priorityQueues.get(priority).push(message);
        this.process();
    }

    async process() {
        if (this.processing >= this.maxConcurrent) return;

        // Process high priority first (priority 1 = commands)
        for (const priority of [1, 0]) {
            const queue = this.priorityQueues.get(priority);
            if (!queue || queue.length === 0) continue;
            
            const activeCount = this.activeByPriority.get(priority) || 0;
            if (activeCount >= Math.ceil(this.maxConcurrent / 2)) continue; // Reserve slots for commands
            
            this.processing++;
            this.activeByPriority.set(priority, activeCount + 1);
            const message = queue.shift();
            
            try {
                await message();
            } catch (error) {
                console.error('[Queue] Error processing priority', priority, ':', error);
            }
            
            this.activeByPriority.set(priority, activeCount);
            this.processing--;
            this.process();
            return;
        }
    }
}

const messageQueue = new MessageQueue(50); // Max 50 concurrent - ditingkatkan dari 15

// Storage untuk tracking connected clients
const allConnections = new Map(); // Map<connClientKey, { type: 'device'|'dashboard', ws, deviceName?, userId? }>
const secretKeyRegistry = new Map(); // Map<secretKey, { device_id, device_name, user_id }>

// SENSOR DATA BUFFER: Batch insert untuk mencegah database lock pada sensor data tinggi
class SensorDataBuffer {
    constructor(flushInterval = 2000, maxBuffer = 100) {
        this.buffer = [];
        this.flushInterval = flushInterval;
        this.maxBuffer = maxBuffer;
        this.timer = null;
        this.lastFlush = Date.now();
    }

    add(deviceId, sensorType, value) {
        this.buffer.push({ deviceId, sensorType, value, timestamp: new Date() });
        if (this.buffer.length >= this.maxBuffer) {
            this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.flushInterval);
        }
    }

    flush() {
        if (this.buffer.length === 0) {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            return;
        }

        const batch = this.buffer.splice(0);
        console.log(`[SensorBuffer] Flushing ${batch.length} sensor data to database...`);

        // Batch insert sebagai single transaction
        // MySQL: START TRANSACTION, SQLite: BEGIN
        const startCmd = getDatabaseType() === 'mysql' ? 'START TRANSACTION' : 'BEGIN';
        const endCmd = 'COMMIT';
        
        db.run(startCmd, (beginErr) => {
            if (beginErr) {
                console.error('[SensorBuffer] Transaction error:', beginErr);
                return;
            }

            let completed = 0;
            batch.forEach(({ deviceId, sensorType, value, timestamp }) => {
                // Convert ISO timestamp to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
                let formattedTimestamp = timestamp.toISOString();
                if (getDatabaseType() === 'mysql') {
                    formattedTimestamp = timestamp.toISOString().slice(0, 19).replace('T', ' ');
                }
                
                db.run(
                    'INSERT INTO sensor_data (device_id, sensor_type, value, timestamp) VALUES (?, ?, ?, ?)',
                    [deviceId, sensorType, value, formattedTimestamp],
                    (err) => {
                        completed++;
                        if (err) console.error('[SensorBuffer] Insert error:', err);
                        if (completed === batch.length) {
                            db.run(endCmd, (commitErr) => {
                                if (commitErr) {
                                    console.error('[SensorBuffer] Commit error:', commitErr);
                                } else {
                                    console.log(`[✓ SensorBuffer] ${batch.length} data points saved`);
                                }
                                this.timer = null;
                            });
                        }
                    }
                );
            });
        });
    }
}

const sensorDataBuffer = new SensorDataBuffer(2000, 100);

// Middleware
app.use(cors());
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});
app.use(express.json());

// Serve file statis HTML/JS dari public folder
app.use(express.static(path.join(__dirname, 'public')));

// Arahkan GET / ke index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin Panel Route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- DATABASE CONNECTION ---
const { initializeDatabase, getDatabase, getDatabaseType, getLastNDaysSQL } = require('./lib/database-adapter');

// Initialize database (MySQL dengan fallback ke SQLite)
initializeDatabase((err, dbInstance) => {
    if (err) {
        console.error('❌ Failed to initialize database:', err);
        process.exit(1);
    }
    
    db = dbInstance;
    const dbType = getDatabaseType();

    // Inisialisasi tabel jika belum ada
    db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS devices (
        device_id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        device_name VARCHAR(100) NOT NULL,
        api_key VARCHAR(255) UNIQUE NOT NULL,
        secret_key VARCHAR(255) UNIQUE NOT NULL,
        public_slug VARCHAR(100) UNIQUE,
        FOREIGN KEY(user_id) REFERENCES users(user_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS widgets (
        widget_id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        device_id INTEGER NOT NULL,
        sensor_type VARCHAR(100) NOT NULL,
        widget_type VARCHAR(50) NOT NULL,
        data_type VARCHAR(50) NOT NULL,
        current_value VARCHAR(255),
        FOREIGN KEY(user_id) REFERENCES users(user_id),
        FOREIGN KEY(device_id) REFERENCES devices(device_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
        data_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        device_id INTEGER NOT NULL,
        sensor_type VARCHAR(100) NOT NULL,
        value VARCHAR(255) NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(device_id) REFERENCES devices(device_id)
    )`);

    // Load device registry setelah tabel siap
    setTimeout(() => {
        loadSecretKeyRegistry();
    }, 1000);
});

// === HELPER: Load secret key registry ===
function loadSecretKeyRegistry() {
    db.all('SELECT device_id, device_name, user_id, secret_key FROM devices', (err, devices) => {
        if (err) {
            console.error('Error loading secret key registry:', err);
            return;
        }
        
        if (!devices) {
            console.log('✓ No devices registered yet');
            return;
        }

        devices.forEach(dev => {
            if (dev.secret_key) {
                secretKeyRegistry.set(dev.secret_key, {
                    device_id: dev.device_id,
                    device_name: dev.device_name,
                    user_id: dev.user_id
                });
            }
        });
        console.log(`✓ Secret key registry loaded: ${secretKeyRegistry.size} devices`);
    });
}

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

// --- ADMIN AUTHENTICATION ---
const ADMIN_PASSWORD = '12345678';
const ADMIN_JWT_SECRET = 'ADMIN_SECRET_KEY_UNTUK_UNIOT_2025';

const autentikasiAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, ADMIN_JWT_SECRET, (err, admin) => {
        if (err) return res.sendStatus(403);
        req.admin = admin;
        next();
    });
};

// --- WEBSOCKET LOGS STORAGE ---
const wsLogs = []; // Menyimpan JSON logs dari WebSocket communication
const MAX_LOGS = 500; // Maksimal logs yang disimpan

function addWsLog(type, data) {
    // Ensure we never store legacy timing keys in logs
    const cleaned = JSON.parse(JSON.stringify(data || {}));
    if (cleaned) {
        if (Object.prototype.hasOwnProperty.call(cleaned, 'response_time_ms')) delete cleaned.response_time_ms;
        if (Object.prototype.hasOwnProperty.call(cleaned, 'processing_ms')) delete cleaned.processing_ms;
    }
    wsLogs.push({
        type: type, // 'sent', 'received', 'error'
        data: cleaned,
        timestamp: new Date().toISOString()
    });
    if (wsLogs.length > MAX_LOGS) {
        wsLogs.shift(); // Remove oldest log
    }
}

function addWsLogWithTiming(type, data, timing) {
    const payload = { ...data };
    // Only include device-to-server timing if present.
    if (timing && typeof timing === 'object') {
        if (typeof timing.deviceToServerMs === 'number' && Number.isFinite(timing.deviceToServerMs)) {
            payload.device_to_server_ms = timing.deviceToServerMs;
        }
    }
    addWsLog(type, payload);
}

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
    const query = 'SELECT device_id, device_name, secret_key FROM devices WHERE user_id = ?';

    db.all(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching devices:', err);
            return res.status(500).json({ message: 'Gagal mengambil data device' });
        }
        res.json(results);
    });
});

// Menambah device (generate secret key untuk ESP32)
app.post('/api/devices', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    const { device_name } = req.body;
    if (!device_name) {
        return res.status(400).json({ message: 'Nama perangkat wajib diisi' });
    }
    
    const apiKey = generateSecretKey();
    const secretKey = generateSecretKey();
    const query = 'INSERT INTO devices (user_id, device_name, api_key, secret_key) VALUES (?, ?, ?, ?)';
    db.run(query, [userId, device_name, apiKey, secretKey], function(err) {
        if (err) {
            console.error('Error registering device:', err);
            return res.status(500).json({ message: 'Gagal mendaftarkan device' });
        }
        
        // Adicionar nova secret_key ao registry em memória
        secretKeyRegistry.set(secretKey, {
            device_id: this.lastID,
            device_name: device_name,
            user_id: userId
        });
        console.log(`✓ Device criado: "${device_name}" com api_key: ${apiKey} secret_key: ${secretKey}`);
        
        res.status(201).json({ 
            message: 'Device berhasil terdaftar', 
            device_id: this.lastID, 
            device_name: device_name,
            api_key: apiKey,
            secret_key: secretKey 
        });
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
        
        // Hapus secret key dari registry
        const keysToDelete = [];
        secretKeyRegistry.forEach((info, key) => {
            if (info.device_id == deviceId) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => {
            secretKeyRegistry.delete(key);
            console.log(`[✓] Secret key dihapus dari registry: ${key}`);
        });
        
        // Tutup koneksi device jika masih terhubung
        const connectionsToClose = [];
        allConnections.forEach((conn, connKey) => {
            if (conn.type === 'device' && conn.deviceId == deviceId && conn.ws.readyState === WebSocket.OPEN) {
                connectionsToClose.push(connKey);
            }
        });
        connectionsToClose.forEach(connKey => {
            allConnections.get(connKey).ws.close(1000, 'Perangkat telah dihapus');
            allConnections.delete(connKey);
            console.log(`[✓] Koneksi device ${deviceId} ditutup`);
        });
        
        res.status(200).json({ message: 'Perangkat (dan semua data terkait) berhasil dihapus' });
    });
});


// --- ENDPOINT DATA SENSOR ---
// DIHAPUS: POST /api/data (Semua data sekarang melalui WebSocket)

// 2. Mengambil data (UNTUK DASHBOARD - 24 jam terakhir)
app.get('/api/data', autentikasiToken, (req, res) => {
    const userId = req.user.userId;
    console.log(`[API] GET /api/data untuk user ID ${userId}`);
    const query = `
        SELECT sd.sensor_type, sd.value, sd.timestamp, d.device_id, d.device_name
        FROM sensor_data AS sd
        JOIN devices AS d ON sd.device_id = d.device_id
        WHERE d.user_id = ? AND sd.timestamp >= ${getLastNDaysSQL(1)}
        ORDER BY sd.timestamp ASC;
    `;
    db.all(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ message: 'Gagal mengambil data' });
        }
        console.log(`[API] Mengembalikan ${results ? results.length : 0} data untuk user ${userId}`);
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

    // Normalize widget_type to match DB enum (accept frontend synonyms)
    const allowedWidgetTypes = ['number', 'toggle', 'slider', 'gauge', 'chart'];
    let normalizedWidgetType = widget_type;
    if (widget_type === 'graph') normalizedWidgetType = 'chart';

    if (!allowedWidgetTypes.includes(normalizedWidgetType)) {
        return res.status(400).json({ message: 'Tipe widget tidak dikenali' });
    }

    // Tentukan nilai awal: Toggle='false', Slider='0', Lainnya=''
    let defaultValue = '';
    if (normalizedWidgetType === 'toggle') defaultValue = 'false';
    if (normalizedWidgetType === 'slider') defaultValue = '0';

    const query = 'INSERT INTO widgets (user_id, device_id, sensor_type, widget_type, data_type, current_value) VALUES (?, ?, ?, ?, ?, ?)';
    
    db.run(query, [userId, device_id, sensor_type, normalizedWidgetType, data_type, defaultValue], function(err) {
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
// Manual Handshake: Semua koneksi diizinkan pada awalnya
// Autentikasi via pesan JSON: {"action":"auth", "key":"0Ly6kU"}

wss.on('connection', (ws, req) => {
    const parsedUrl = url.parse(req.url, true);
    const query = parsedUrl.query;
    const token = query.token;      // Dashboard: JWT token
    const secretKeyFromUrl = query.key;  // Device: Secret key di URL
    
    let clientType = null;          // 'device', 'dashboard', atau 'pending'
    let authStatus = 'pending';     // 'pending' atau 'authenticated'
    let userId = null;              // Jika dashboard atau device terauthentikasi
    let deviceId = null;            // Jika device
    let deviceName = null;          // Jika device
    let connClientKey = null;       // Unique identifier
    let authTimeout = null;         // Timeout untuk autentikasi
    
    console.log(`[WebSocket] 🔌 Koneksi baru - IP: ${req.socket.remoteAddress}`);
    console.log(`[WebSocket] URL: ${req.url}`);
    console.log(`[WebSocket] Query params - token: ${token ? 'ada' : 'tidak'}, key: ${secretKeyFromUrl ? 'ada' : 'tidak'}`);
    
    // Debug: Cek secret key registry
    console.log(`[DEBUG] Secret key registry size: ${secretKeyRegistry.size}`);
    if (secretKeyRegistry.size > 0) {
        console.log(`[DEBUG] Keys yang tersedia:`);
        secretKeyRegistry.forEach((info, key) => {
            console.log(`  - ${key} → Device ID ${info.device_id}`);
        });
    }

    // Normalisasi payload agar kompatibel dengan format lama dan baru.
    const normalizeSensorPayload = (data) => {
        const sensor_type = data.var ?? data.sensor_type;
        let value = data.val !== undefined ? data.val : data.value;

        // Terima nilai numerik yang dikirim sebagai string, termasuk format koma ("27,5") dari MIT App Inventor
        if (typeof value === 'string') {
            const trimmed = value.trim();
            // Normalisasi koma ke titik
            const dotNormalized = trimmed.replace(',', '.');
            // Jika hanya angka (opsional minus dan desimal), parse ke Number sehingga float terjaga
            if (/^-?\d+(?:\.\d+)?$/.test(dotNormalized)) {
                const num = Number(dotNormalized);
                if (!Number.isNaN(num)) value = num;
            }
        }

        return { sensor_type, value };
    };

    const persistControlState = (targetDeviceId, sensor_type, value, originalTimestampMs = null) => {
        // PRIORITAS 1: Update widget immediately (untuk UI responsiveness)
        db.run(
            'UPDATE widgets SET current_value = ? WHERE device_id = ? AND sensor_type = ?',
            [value, targetDeviceId, sensor_type],
            (err) => {
                if (err) {
                    console.error('Error updating widget from control:', err);
                } else {
                    console.log(`[✓ Control] Widget updated: ${sensor_type} = ${value}`);
                }
            }
        );

        // PRIORITAS 2: Buffer sensor data (non-blocking)
        sensorDataBuffer.add(targetDeviceId, sensor_type, value);

        // PRIORITAS 3: Async broadcast (non-blocking)
        setImmediate(async () => {
            db.get('SELECT public_slug FROM devices WHERE device_id = ?', [targetDeviceId], (slugErr, deviceRow) => {
                if (!slugErr && deviceRow && deviceRow.public_slug) {
                    const serverBroadcastMs = Date.now();
                    const pubPayload = {
                        type: 'dataUpdate',
                        sensor_type: sensor_type,
                        current_value: value,
                        server_broadcast_ms: serverBroadcastMs,
                        timestamp: new Date().toISOString()
                    };
                    if (originalTimestampMs && Number.isFinite(originalTimestampMs)) {
                        pubPayload.original_timestamp_ms = originalTimestampMs;
                        pubPayload.original_timestamp = new Date(originalTimestampMs).toISOString();
                    }
                    broadcastToPublicView(deviceRow.public_slug, pubPayload);
                }
            });

            db.get('SELECT user_id, device_name FROM devices WHERE device_id = ?', [targetDeviceId], (ownerErr, ownerRow) => {
                if (!ownerErr && ownerRow) {
                    const serverBroadcastMsUser = Date.now();
                    const userPayload = {
                        device: ownerRow.device_name,
                        device_id: Number(targetDeviceId),
                        var: sensor_type,
                        val: value,
                        server_broadcast_ms: serverBroadcastMsUser,
                        timestamp: new Date().toISOString()
                    };
                    if (originalTimestampMs && Number.isFinite(originalTimestampMs)) {
                        userPayload.original_timestamp_ms = originalTimestampMs;
                        userPayload.original_timestamp = new Date(originalTimestampMs).toISOString();
                    }
                    broadcastToUserDashboards(ownerRow.user_id, userPayload);
                }
            });
        });
    };

    const routeCommandToDeviceInstances = (senderLabel, targetDeviceId, sensor_type, value, senderWs, excludeConnKey = null) => {
        const deviceConnections = Array.from(allConnections.entries()).filter(
            ([key, connectionData]) =>
                connectionData.type === 'device' &&
                connectionData.deviceId == targetDeviceId &&
                connectionData.authStatus === 'authenticated' &&
                (!excludeConnKey || key !== excludeConnKey)
        );

        if (deviceConnections.length > 0) {
            const valueAsString = typeof value === 'string' ? value : String(value);
            const command = {
                type: 'command',
                var: sensor_type,
                val: valueAsString,
                sensor_type: sensor_type,
                value: valueAsString
            };
            let sentCount = 0;

            deviceConnections.forEach(([key, deviceConn]) => {
                if (deviceConn.ws.readyState === WebSocket.OPEN) {
                    deviceConn.ws.send(JSON.stringify(command));
                    sentCount++;
                }
            });

            console.log(`[✓ Perintah] (${senderLabel}) Dikirim ke ${sentCount} instance device ${targetDeviceId}: ${sensor_type} = ${valueAsString}`);
            senderWs.send(JSON.stringify({ status: 'ack', device_id: targetDeviceId, var: sensor_type, val: valueAsString }));
        } else {
            console.log(`[✗ Device] (${senderLabel}) ID ${targetDeviceId} tidak terhubung, tapi nilai sudah disimpan di database`);
            senderWs.send(JSON.stringify({
                status: 'ack',
                device_id: targetDeviceId,
                var: sensor_type,
                val: value,
                message: 'Nilai disimpan (device offline)'
            }));
        }
    };

    // --- REGISTER ALL EVENT HANDLERS FIRST (sebelum any returns) ---
    
    // MESSAGE HANDLER
    ws.on('message', (rawMessage) => {
        try {
            const messageStartedAt = process.hrtime.bigint();
            const serverRecvMs = Date.now();
            const messageText = rawMessage.toString();
            const data = JSON.parse(messageText);

            // Try to parse device-provided timestamp (if device includes it)
            let deviceSentAtMs = null;
            try {
                if (data && (data.timestamp || data.ts || data.time || data.sent_at)) {
                    const tsRaw = data.timestamp || data.ts || data.time || data.sent_at;
                    if (typeof tsRaw === 'number') {
                        // If seconds (10-digit), convert to ms
                        deviceSentAtMs = tsRaw > 1e12 ? tsRaw : (tsRaw < 1e12 ? tsRaw * 1000 : tsRaw);
                    } else if (typeof tsRaw === 'string') {
                        const parsed = Date.parse(tsRaw);
                        if (!isNaN(parsed)) deviceSentAtMs = parsed;
                    }
                }
            } catch (e) {
                deviceSentAtMs = null;
            }

            // Tentukan priority: Command (dari dashboard atau device) = priority 1, Data sensor = priority 0
            let messagePriority = 0;
            let messageType = 'unknown';

            // Deteksi tipe message
            if (clientType === 'dashboard') {
                messagePriority = 1; // Dashboard command: PRIORITAS TINGGI
                messageType = 'dashboard-command';
            } else if (clientType === 'device') {
                const hasTargetDevice = data.device_id !== undefined && data.device_id !== null && data.device_id !== '';
                const isCommandMessage = data.type === 'command' || hasTargetDevice;
                messagePriority = isCommandMessage ? 1 : 0; // Command > Data sensor
                messageType = isCommandMessage ? 'device-command' : 'device-data';
            } else if (clientType === 'pending') {
                messagePriority = 1; // Auth message: PRIORITAS TINGGI
                messageType = 'auth';
            }

            console.log(`[WebSocket Message] Dari ${clientType || 'unknown'} (Type: ${messageType}, Priority: ${messagePriority})`);

            // Log untuk admin panel (WebSocket communication log)
            addWsLog('received', {
                from: clientType,
                type: messageType,
                data: data,
                timestamp: new Date().toISOString()
            });

            const logProcessed = (type, payload) => {
                const durationMs = Number(process.hrtime.bigint() - messageStartedAt) / 1e6;
                const roundedMs = Math.round(durationMs * 100) / 100; // two decimal ms (kept internal)
                let deviceToServerMs = null;
                if (deviceSentAtMs && Number.isFinite(deviceSentAtMs)) {
                    deviceToServerMs = Math.round((serverRecvMs - deviceSentAtMs) * 100) / 100;
                }
                // Only send device->server timing to logs
                const timingObj = {};
                if (deviceToServerMs !== null) timingObj.deviceToServerMs = deviceToServerMs;
                addWsLogWithTiming(type, payload, timingObj);
            };

            // ENQUEUE ke message queue untuk async processing
            messageQueue.enqueue(async () => {
                // === HANDSHAKE AUTH UNTUK DEVICES YANG MENUNGGU ===
                if (clientType === 'device' && authStatus === 'pending') {
                    if (data.action === 'auth' && data.key) {
                        const secretKey = data.key;
                        const deviceInfo = secretKeyRegistry.get(secretKey);
                        
                        if (!deviceInfo) {
                            console.log(`[✗ Device] Secret key tidak valid: ${secretKey}`);
                            ws.send(JSON.stringify({ 
                                status: 'error', 
                                message: 'Secret key tidak valid' 
                            }));
                            logProcessed('error', {
                                from: clientType,
                                type: 'auth-failed',
                                data: data,
                                message: 'Secret key tidak valid'
                            });
                            ws.close(1008, 'Secret key tidak valid');
                            allConnections.delete(connClientKey);
                            clearTimeout(authTimeout);
                            return;
                        }
                        
                        // Autentikasi berhasil
                        authStatus = 'authenticated';
                        deviceId = deviceInfo.device_id;
                        deviceName = deviceInfo.device_name;
                        userId = deviceInfo.user_id;
                        
                        // Tukar kunci di peta koneksi (dari menunggu ke terauthentikasi)
                        allConnections.delete(connClientKey);
                        connClientKey = `device:${deviceId}`;
                        
                        // Verifikasi koneksi sebelumnya dari device yang sama
                        const oldKey = Array.from(allConnections.entries()).find(
                            ([key, val]) => val.type === 'device' && val.deviceId === deviceId && val.authStatus === 'authenticated'
                        );
                        if (oldKey) {
                            console.log(`[Device] Menutup koneksi sebelumnya dari "${deviceName}"`);
                            allConnections.get(oldKey[0]).ws.close(1000, 'Koneksi baru dari device yang sama');
                            allConnections.delete(oldKey[0]);
                        }
                        
                        // Simpan klien yang terauthentikasi
                        allConnections.set(connClientKey, { 
                            type: 'device', 
                            ws, 
                            deviceId, 
                            deviceName, 
                            userId,
                            authStatus: 'authenticated'
                        });
                        
                        // Kirim konfirmasi
                        ws.send(JSON.stringify({ 
                            type: 'handshake',
                            status: 'success', 
                            message: `Terauthentikasi sebagai "${deviceName}"`,
                            device_id: deviceId
                        }));

                        broadcastToUserDashboards(userId, {
                            type: 'devicePresence',
                            status: 'connected',
                            device_id: deviceId,
                            device_name: deviceName,
                            timestamp: new Date().toISOString()
                        });

                        logProcessed('processed', {
                            from: clientType,
                            type: 'auth-success',
                            data: data,
                            device_id: deviceId,
                            device_name: deviceName,
                            message: `Terauthentikasi sebagai "${deviceName}"`
                        });
                        
                        console.log(`[✓ Device] Terauthentikasi - "${deviceName}" (ID: ${deviceId})`);
                        clearTimeout(authTimeout);
                        return;
                    }
                    else {
                        // Pesan tidak valid saat menunggu
                        console.log(`[Device] Pesan tidak valid saat handshake`);
                        ws.send(JSON.stringify({ 
                            status: 'error', 
                            message: 'Kirim {"action":"auth","key":"..."} untuk authenticating' 
                        }));
                        logProcessed('error', {
                            from: clientType,
                            type: 'auth-invalid-format',
                            data: data,
                            message: 'Kirim {"action":"auth","key":"..."} untuk authenticating'
                        });
                        return;
                    }
                }
                
                // === HANYA KLIEN YANG TERAUTHENTIKASI YANG DAPAT MENGIRIM DATA ===
                if (authStatus !== 'authenticated') {
                    console.log(`[✗] Klien yang tidak terauthentikasi mencoba mengirim data`);
                    logProcessed('error', {
                        from: clientType,
                        type: 'unauthenticated',
                        data: data,
                        message: 'Klien yang tidak terauthentikasi mencoba mengirim data'
                    });
                    return;
                }
                
                // --- DEVICE MENGIRIM DATA SENSOR ---
                if (clientType === 'device') {
                    // Backwards-compatible: accept either a single reading
                    // (e.g. {"var":"suhu","val":27}) or a batch array
                    // (e.g. [{"var":"suhu","val":27},{"var":"hum","val":55}]).
                    if (Array.isArray(data)) {
                        const readings = data;
                        if (readings.length === 0) {
                            console.error('[Device] Batch pesan kosong');
                            logProcessed('error', {
                                from: clientType,
                                type: 'invalid-device-data-batch',
                                data: data,
                                message: 'Batch pesan kosong'
                            });
                            return;
                        }

                        // ACK once for the whole batch
                        try {
                            ws.send(JSON.stringify({ status: 'ack', type: 'batchReceived', count: readings.length, timestamp: new Date().toISOString() }));
                        } catch (e) {
                            // ignore send errors
                        }

                        readings.forEach((reading) => {
                            // Try per-reading timestamp first, fall back to message-level deviceSentAtMs
                            let perReadingTs = null;
                            try {
                                const tsRaw = reading.timestamp || reading.ts || reading.time || reading.sent_at;
                                if (tsRaw) {
                                    if (typeof tsRaw === 'number') {
                                        perReadingTs = tsRaw > 1e12 ? tsRaw : (tsRaw < 1e12 ? tsRaw * 1000 : tsRaw);
                                    } else if (typeof tsRaw === 'string') {
                                        const parsed = Date.parse(tsRaw);
                                        if (!isNaN(parsed)) perReadingTs = parsed;
                                    }
                                }
                            } catch (e) {
                                perReadingTs = deviceSentAtMs;
                            }

                            const { sensor_type, value } = normalizeSensorPayload(reading);
                            if (!sensor_type || value === undefined) return; // skip invalid entries

                            // Immediate realtime broadcast for dashboards
                            const serverBroadcastMs = Date.now();
                            const payload = {
                                device: deviceName,
                                device_id: deviceId,
                                var: sensor_type,
                                val: value,
                                server_broadcast_ms: serverBroadcastMs,
                                timestamp: new Date().toISOString()
                            };
                            if (perReadingTs) {
                                payload.original_timestamp_ms = perReadingTs;
                                payload.original_timestamp = new Date(perReadingTs).toISOString();
                            }
                            broadcastToUserDashboards(userId, payload);

                            // Buffer for DB
                            sensorDataBuffer.add(deviceId, sensor_type, value);

                            // Async widget update & public/device broadcasts
                            setImmediate(() => {
                                db.run(
                                    'UPDATE widgets SET current_value = ? WHERE device_id = ? AND sensor_type = ?',
                                    [value, deviceId, sensor_type],
                                    (err) => {
                                        if (!err) {
                                            db.get('SELECT public_slug FROM devices WHERE device_id = ?', [deviceId], (err, deviceRow) => {
                                                if (!err && deviceRow && deviceRow.public_slug) {
                                                    broadcastToPublicView(deviceRow.public_slug, {
                                                        type: 'dataUpdate',
                                                        sensor_type: sensor_type,
                                                        current_value: value,
                                                        timestamp: new Date().toISOString()
                                                    });
                                                }
                                            });

                                            broadcastToAllDevices({
                                                type: 'dataUpdate',
                                                device_id: deviceId,
                                                device_name: deviceName,
                                                var: sensor_type,
                                                val: value,
                                                timestamp: new Date().toISOString()
                                            }, connClientKey);
                                        }
                                    }
                                );
                            });
                        });

                        logProcessed('processed', {
                            from: clientType,
                            type: 'sensor-data-batch',
                            count: readings.length,
                            data: (readings.length > 10 ? `[${readings.length} readings]` : readings)
                        });
                        return;
                    }

                    // Single reading (legacy / default)
                    const { sensor_type, value } = normalizeSensorPayload(data);
                    if (!sensor_type || value === undefined) {
                        console.error('[Device] Pesan tidak valid - butuh var/val atau sensor_type/value');
                        logProcessed('error', {
                            from: clientType,
                            type: 'invalid-device-data',
                            data: data,
                            message: 'Pesan tidak valid - butuh var/val atau sensor_type/value'
                        });
                        return;
                    }

                    // Dukungan mode controller dari MIT App:
                    // jika payload mengandung device_id / type=command, perlakukan sebagai command.
                    const hasTargetDevice = data.device_id !== undefined && data.device_id !== null && data.device_id !== '';
                    const targetDeviceId = hasTargetDevice ? data.device_id : deviceId;
                    const isCommandMessage = data.type === 'command' || hasTargetDevice;

                    if (isCommandMessage) {
                        // Koneksi device hanya boleh mengontrol device miliknya sendiri (sesuai secret key).
                        if (String(targetDeviceId) !== String(deviceId)) {
                            console.warn(`[✗ Device] Menolak command lintas device. device auth=${deviceId}, target=${targetDeviceId}`);
                            ws.send(JSON.stringify({ status: 'error', message: 'Tidak diizinkan mengontrol device lain' }));
                            logProcessed('error', {
                                from: clientType,
                                type: 'command-rejected',
                                data: data,
                                message: 'Tidak diizinkan mengontrol device lain'
                            });
                            return;
                        }

                        console.log(`[Device/Controller ${deviceName}] 🎮 Perintah lokal: ${sensor_type} = ${value}`);
                        persistControlState(targetDeviceId, sensor_type, value, deviceSentAtMs);
                        routeCommandToDeviceInstances('device-controller', targetDeviceId, sensor_type, value, ws, connClientKey);
                        logProcessed('processed', {
                            from: clientType,
                            type: 'device-command',
                            data: data,
                            target_device_id: targetDeviceId,
                            message: 'Perintah diproses'
                        });
                        return;
                    }
                    
                    console.log(`[Device "${deviceName}"]  Data: ${sensor_type} = ${value}`);
                    
                    // Kirim ACK kembali ke device bahwa data diterima
                    ws.send(JSON.stringify({
                        status: 'ack',
                        type: 'dataReceived',
                        sensor_type: sensor_type,
                        value: value,
                        timestamp: new Date().toISOString(),
                        message: 'Data berhasil diterima'
                    }));

                    logProcessed('processed', {
                        from: clientType,
                        type: 'sensor-data',
                        data: data,
                        ack: {
                            status: 'ack',
                            message: 'Data berhasil diterima'
                        }
                    });
                    
                    //  PRIORITAS 1: Broadcast realtime (LANGSUNG, tidak di-buffer)
                    // Jadi dashboard lihat update immediately
                    const serverBroadcastMs = Date.now();
                    const payload = {
                        device: deviceName,
                        device_id: deviceId,
                        var: sensor_type,
                        val: value,
                        server_broadcast_ms: serverBroadcastMs,
                        timestamp: new Date().toISOString()
                    };
                    if (deviceSentAtMs) {
                        payload.original_timestamp_ms = deviceSentAtMs;
                        payload.original_timestamp = new Date(deviceSentAtMs).toISOString();
                    }
                    broadcastToUserDashboards(userId, payload);
                    
                    //  PRIORITAS 2: Buffer sensor data untuk batch insert (tidak blocking)
                    sensorDataBuffer.add(deviceId, sensor_type, value);
                    
                    //  PRIORITAS 3: Update widget & broadcast (async, non-blocking)
                    setImmediate(async () => {
                        db.run(
                            'UPDATE widgets SET current_value = ? WHERE device_id = ? AND sensor_type = ?',
                            [value, deviceId, sensor_type],
                            (err) => {
                                if (!err) {
                                    console.log(`[✓ Widget] ${sensor_type} = ${value}`);
                                    
                                    // Broadcast ke PUBLIC VIEW
                                    db.get('SELECT public_slug FROM devices WHERE device_id = ?', [deviceId], (err, deviceRow) => {
                                        if (!err && deviceRow && deviceRow.public_slug) {
                                            broadcastToPublicView(deviceRow.public_slug, {
                                                type: 'dataUpdate',
                                                sensor_type: sensor_type,
                                                current_value: value,
                                                timestamp: new Date().toISOString()
                                            });
                                        }
                                    });
                                    
                                    // Broadcast ke DEVICES lain
                                    broadcastToAllDevices({
                                        type: 'dataUpdate',
                                        device_id: deviceId,
                                        device_name: deviceName,
                                        var: sensor_type,
                                        val: value,
                                        timestamp: new Date().toISOString()
                                    }, connClientKey);
                                }
                            }
                        );
                    });
                }
                
                // Handle latency reports from dashboard (client-side measured)
                else if (clientType === 'dashboard' && data.action === 'latency_report') {
                    try {
                        const origMs = Number(data.original_timestamp_ms);
                        const recvMs = Number(data.client_receive_ms) || Date.now();
                        if (!isNaN(origMs)) {
                            const deviceToDashboardMs = Math.round((recvMs - origMs) * 100) / 100;
                            addWsLog('latency', {
                                from: 'dashboard',
                                device: data.device,
                                var: data.var,
                                device_to_dashboard_ms: deviceToDashboardMs,
                                original_timestamp_ms: origMs,
                                client_receive_ms: recvMs
                            });
                        }
                    } catch (e) {
                        console.error('Error processing latency_report:', e);
                    }
                    return;
                }

                // --- DASHBOARD MENGIRIM PERINTAH KE DEVICE (PRIORITAS TINGGI) ---
                else if (clientType === 'dashboard') {
                    const device_id = data.device_id;
                    const { sensor_type, value } = normalizeSensorPayload(data);
                    if (!device_id || !sensor_type || value === undefined) {
                        console.error('[Dashboard] Pesan tidak valid - butuh device_id + var/val atau sensor_type/value');
                        ws.send(JSON.stringify({ status: 'error', message: 'Format pesan tidak valid' }));
                        logProcessed('error', {
                            from: clientType,
                            type: 'invalid-dashboard-data',
                            data: data,
                            message: 'Format pesan tidak valid'
                        });
                        return;
                    }
                    
                    console.log(`[Dashboard User ${userId}] 📥 Perintah untuk device ${device_id}: ${sensor_type} = ${value}`);

                    persistControlState(device_id, sensor_type, value, deviceSentAtMs);
                    routeCommandToDeviceInstances('dashboard', device_id, sensor_type, value, ws);
                    logProcessed('processed', {
                        from: clientType,
                        type: 'dashboard-command',
                        data: data,
                        target_device_id: device_id,
                        message: 'Perintah dikirim ke device'
                    });
                }
            }, messagePriority); //  Dengan priority sesuai tipe message

        } catch (parseErr) {
            console.error('[WebSocket] Parse error:', parseErr.message);
        }
    });
    
    // --- CLOSE HANDLER ---
    ws.on('close', () => {
        console.log(`[WebSocket] Close event`);
        if (authTimeout) clearTimeout(authTimeout);
        
        if (connClientKey) {
            if (clientType === 'device' && userId && deviceId) {
                broadcastToUserDashboards(userId, {
                    type: 'devicePresence',
                    status: 'disconnected',
                    device_id: deviceId,
                    device_name: deviceName,
                    timestamp: new Date().toISOString()
                });
            }

            allConnections.delete(connClientKey);
            
            if (clientType === 'device') {
                console.log(`[Device] Terputus - "${deviceName || 'menunggu'}" (ID: ${deviceId || 'N/A'})`);
            } else if (clientType === 'dashboard') {
                console.log(`[Dashboard] Terputus - User ID ${userId}`);
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('[WebSocket Error]', error.message);
        if (authTimeout) clearTimeout(authTimeout);
    });

    // --- NOW DO AUTHENTICATION (no returns that would prevent handlers) ---
    
    // --- DASHBOARD DENGAN JWT TOKEN (autentikasi langsung via URL) ---
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.log(`[✗ Dashboard] Token tidak valid`);
                ws.close(1008, 'Token tidak valid');
                return;
            }
            
            clientType = 'dashboard';
            authStatus = 'authenticated';
            userId = user.userId;
            connClientKey = `dashboard:${user.userId}:${Date.now()}:${Math.random()}`;
            
            allConnections.set(connClientKey, { type: 'dashboard', ws, userId, username: user.username });
            console.log(`[✓ Dashboard] Terauthentikasi - User: ${user.username} (ID: ${userId})`);

            ws.send(JSON.stringify({
                type: 'handshake',
                status: 'success',
                message: `Terauthentikasi sebagai "${user.username}"`,
                user_id: userId
            }));

            sendDevicePresenceSnapshot(userId, ws);
            
            // Batalkan timeout jika ada
            if (authTimeout) clearTimeout(authTimeout);
        });
        return;
    }
    
    // --- DEVICE DENGAN SECRET KEY DI URL (autentikasi langsung) ---
    if (secretKeyFromUrl) {
        const deviceInfo = secretKeyRegistry.get(secretKeyFromUrl);
        
        if (!deviceInfo) {
            console.log(`[✗ Device] Secret key di URL tidak valid: ${secretKeyFromUrl}`);
            ws.close(1008, 'Secret key tidak valid');
            return;
        }
        
        clientType = 'device';
        authStatus = 'authenticated';
        deviceId = deviceInfo.device_id;
        deviceName = deviceInfo.device_name;
        userId = deviceInfo.user_id;
        // Gunakan unique key seperti dashboard, sehingga multiple instances dari device yang sama bisa coexist
        connClientKey = `device:${deviceId}:${Date.now()}:${Math.random()}`;
        
        // TIDAK menutup koneksi sebelumnya - biarkan multiple instances coexist
        allConnections.set(connClientKey, { 
            type: 'device', 
            ws, 
            deviceId, 
            deviceName, 
            userId,
            authStatus: 'authenticated'
        });
        
        console.log(`[✓ Device] Terauthentikasi via URL - "${deviceName}" (ID: ${deviceId})`);
        
        // Kirim konfirmasi ke device
        ws.send(JSON.stringify({
            type: 'handshake',
            status: 'success',
            message: `Terauthentikasi sebagai "${deviceName}"`,
            device_id: deviceId
        }));

        broadcastToUserDashboards(userId, {
            type: 'devicePresence',
            status: 'connected',
            device_id: deviceId,
            device_name: deviceName,
            timestamp: new Date().toISOString()
        });
        return;
    }
    
    // --- DEVICE TANPA TOKEN & TANPA KEY DI URL (butuh handshake manual) ---
    clientType = 'device';
    authStatus = 'pending';
    connClientKey = `device:pending:${Date.now()}:${Math.floor(Math.random() * 10000)}`;
    
    // Simpan klien yang menunggu
    allConnections.set(connClientKey, { 
        type: 'device', 
        ws, 
        deviceId: null, 
        deviceName: null,
        userId: null,
        authStatus: 'pending'
    });
    
    console.log(`[ Device] Menunggu - Menunggu autentikasi...`);
    
    // === TIMEOUT: 360 detik untuk mengirim auth message ===
    authTimeout = setTimeout(() => {
        if (allConnections.has(connClientKey) && authStatus === 'pending') {
            console.log(`[✗ Device]   Timeout autentikasi (tidak ada pesan yang diterima)`);
            ws.close(1008, 'Autentikasi timeout - kirim {"action":"auth","key":"..."} untuk authenticate');
            allConnections.delete(connClientKey);
        }
    }, 360000);
});

// --- Helper: Broadcast ke dashboard pengguna ---
function broadcastToUserDashboards(userId, data) {
    const payload = JSON.stringify(data);
    let broadcastCount = 0;
    
    console.log(`[Broadcast] Mencari dashboard untuk user ID ${userId}...`);
    
    allConnections.forEach((conn, key) => {
        if (conn.type === 'dashboard' && conn.userId === userId) {
            console.log(`[Broadcast] Ditemukan dashboard untuk user ${conn.username || userId}`);
            if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.send(payload);
                broadcastCount++;
                console.log(`[Broadcast] Data dikirim ke dashboard`);
            } else {
                console.log(`[Broadcast] Dashboard tidak aktif (readyState: ${conn.ws?.readyState})`);
            }
        }
    });
    
    if (broadcastCount === 0) {
        console.log(`[Broadcast] Tidak ada dashboard aktif untuk user ID ${userId}`);
    } else {
        console.log(`[Broadcast] ✓ Data dikirim ke ${broadcastCount} dashboard`);
    }
}

function sendDevicePresenceSnapshot(userId, ws) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    allConnections.forEach((conn) => {
        if (
            conn.type === 'device' &&
            conn.userId === userId &&
            conn.authStatus === 'authenticated' &&
            conn.ws && conn.ws.readyState === WebSocket.OPEN
        ) {
            ws.send(JSON.stringify({
                type: 'devicePresence',
                status: 'connected',
                device_id: conn.deviceId,
                device_name: conn.deviceName,
                timestamp: new Date().toISOString()
            }));
        }
    });
}

// --- BROADCAST KE SEMUA DEVICES (untuk sinkronisasi data antar device) ---
function broadcastToAllDevices(data, excludeConnKey = null) {
    const payload = JSON.stringify(data);
    let broadcastCount = 0;
    
    console.log(`[Device Broadcast] Mengirim ke semua device...`);
    
    // DEBUG: Tampilkan semua koneksi yang ada
    console.log(`[Device Broadcast DEBUG] Total koneksi: ${allConnections.size}`);
    allConnections.forEach((conn, key) => {
        console.log(`  - Key: ${key}, Type: ${conn.type}, AuthStatus: ${conn.authStatus}, DeviceId: ${conn.deviceId}, Ready: ${conn.ws?.readyState === WebSocket.OPEN}`);
    });
    
    allConnections.forEach((conn, key) => {
        if (conn.type === 'device' && conn.authStatus === 'authenticated') {
            // Exclude hanya sender connection (by unique key), bukan semua instance dari device yang sama
            if (excludeConnKey && key === excludeConnKey) {
                console.log(`[Device Broadcast] Skip sender: ${key}`);
                return;
            }
            
            if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.send(payload);
                broadcastCount++;
                console.log(`[Device Broadcast] Data dikirim ke device ${conn.deviceId} (${conn.deviceName})`);
            }
        }
    });
    
    if (broadcastCount === 0) {
        console.log(`[Device Broadcast] Tidak ada device aktif untuk broadcast`);
    } else {
        console.log(`[Device Broadcast] ✓ Data dikirim ke ${broadcastCount} device`);
    }
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
            WHERE device_id = ? AND timestamp >= ${getLastNDaysSQL(1)} 
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
        const queryData = `SELECT sensor_type, value, timestamp FROM sensor_data WHERE device_id = ? AND timestamp >= ${getLastNDaysSQL(1)} ORDER BY timestamp ASC`;

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

// Storage untuk SSE clients (Server-Sent Events untuk public view)
const publicViewClients = new Map(); // Map<slug, Set<response objects>>

// --- SERVER-SENT EVENTS (SSE) ENDPOINT UNTUK PUBLIC VIEW ---
app.get('/api/public/updates/:slug', (req, res) => {
    const slug = req.params.slug;
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Verifikasi slug valid
    db.get('SELECT device_id FROM devices WHERE public_slug = ?', [slug], (err, device) => {
        if (err || !device) {
            res.write(`data: {"error": "Invalid slug"}\n\n`);
            res.end();
            return;
        }
        
        // Tambahkan client ke tracking
        if (!publicViewClients.has(slug)) {
            publicViewClients.set(slug, new Set());
        }
        publicViewClients.get(slug).add(res);
        
        console.log(`[SSE] Client terhubung untuk slug: ${slug}`);
        
        // Kirim initial message
        res.write(`: SSE connection established\n\n`);
        
        // Handle disconnect
        req.on('close', () => {
            console.log(`[SSE] Client disconnect untuk slug: ${slug}`);
            publicViewClients.get(slug).delete(res);
        });
    });
                if (clientType === 'device' && userId && deviceId) {
                    broadcastToUserDashboards(userId, {
                        type: 'devicePresence',
                        status: 'disconnected',
                        device_id: deviceId,
                        device_name: deviceName,
                        timestamp: new Date().toISOString()
                    });
                }

});

// --- FUNGSI BROADCAST UPDATE KE PUBLIC VIEW CLIENTS ---
function broadcastToPublicView(slug, data) {
    if (!publicViewClients.has(slug)) return;
    
    const clients = publicViewClients.get(slug);
    const message = `data: ${JSON.stringify(data)}\n\n`;
    
    clients.forEach(client => {
        try {
            client.write(message);
        } catch (err) {
            console.error('[SSE] Error writing to client:', err.message);
            clients.delete(client);
        }
    });
}

// --- ADMIN ENDPOINTS ---

// 1. Admin Login
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ status: 'error', message: 'Password salah' });
    }

    const token = jwt.sign({ admin: true }, ADMIN_JWT_SECRET, { expiresIn: '8h' });
    res.json({ status: 'success', token });
});

// 2. Get Users dengan Pagination
app.get('/api/admin/users', autentikasiAdmin, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count of users
    db.get('SELECT COUNT(*) as total FROM users', [], (err, countResult) => {
        if (err) {
            console.error('Error counting users:', err);
            return res.status(500).json({ status: 'error', message: 'Error counting users' });
        }

        // Handle both MySQL and SQLite result formats
        const total = countResult.total || countResult.count || 0;
        const totalPages = Math.ceil(total / limit);

        // Get users dengan devices (secret keys) mereka
        const query = `
            SELECT
                u.user_id,
                u.username,
                u.email,
                COALESCE(GROUP_CONCAT(d.secret_key ORDER BY d.device_id SEPARATOR ','), '') AS secret_keys
            FROM users u
            LEFT JOIN devices d ON u.user_id = d.user_id
            GROUP BY u.user_id, u.username, u.email
            ORDER BY u.user_id ASC
            LIMIT ? OFFSET ?
        `;
        
        db.all(query, [limit, offset], (err, users) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(500).json({ status: 'error', message: 'Error fetching users' });
            }

            // Parse secret_keys dari string menjadi array
            const formattedUsers = (users || []).map(user => ({
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                secret_keys: user.secret_keys ? user.secret_keys.split(',') : []
            }));

            res.json({
                status: 'success',
                users: formattedUsers,
                total: total,
                page: page,
                limit: limit,
                totalPages: totalPages
            });
        });
    });
});

// 3. Get WebSocket Logs
app.get('/api/admin/ws-logs', autentikasiAdmin, (req, res) => {
    // Return cleaned logs (strip legacy timing keys)
    const cleanedLogs = wsLogs.map(entry => {
        const cleanedData = JSON.parse(JSON.stringify(entry.data || {}));
        if (Object.prototype.hasOwnProperty.call(cleanedData, 'response_time_ms')) delete cleanedData.response_time_ms;
        if (Object.prototype.hasOwnProperty.call(cleanedData, 'processing_ms')) delete cleanedData.processing_ms;
        return {
            type: entry.type,
            data: cleanedData,
            timestamp: entry.timestamp
        };
    });
    res.json({
        status: 'success',
        logs: cleanedLogs,
        total: cleanedLogs.length
    });
});

// 4. Clear WebSocket Logs
app.delete('/api/admin/ws-logs', autentikasiAdmin, (req, res) => {
    wsLogs.length = 0; // Clear array
    res.json({ status: 'success', message: 'Logs cleared' });
});

// --- JALANKAN SERVER ---
// server sudah wrap app dengan http.createServer(app), jadi cukup server.listen() saja
server.listen(port, '0.0.0.0', () => {
    console.log(`\n Server (Express + WebSocket) berjalan di http://0.0.0.0:${port}`);
    console.log(` WebSocket berjalan di ws://0.0.0.0:${port}`);
    console.log(`\n Akses dari jaringan lokal: http://${localIp}:${port}`);
    console.log(` Akses dari device lain: http://<IP_ROUTER_ANDA>:${port}`);
    console.log(`\n Jika tidak bisa akses:`);
    console.log(`   1. Cek IP router: ${localIp}`);
    console.log(`   2. Pastikan device lain di jaringan yang sama`);
    console.log(`   3. Check firewall router (port 3001 harus terbuka)`);
    console.log(`   4. Coba akses: http://${localIp}:${port}/\n`);
});
