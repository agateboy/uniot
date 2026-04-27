# CHANGELOG: Pure WebSocket Tunneling Migration

## Ringkasan Perubahan Besar

Sistem UNIOT telah dirombak dari **HTTP Polling + Socket.IO** menjadi **Pure WebSocket Tunneling**. Ini adalah arsitektur yang lebih efisien, sederhana, dan scalable.

---

##  Perubahan Utama

### Backend (index.js)

#### Dihapus:
-  Library Socket.IO (`require("socket.io")`)
-  Rute HTTP `POST /api/data` (untuk mengumpulkan data dari ESP32)
-  Requirement header `x-api-key` dalam HTTP request
-  Express middleware Socket.IO CORS setup

#### Ditambahkan:
-  Library `ws` (native WebSocket untuk Node.js)
-  WebSocket Server (broker) yang routing data real-time
-  Authentikasi via query parameter pada koneksi WebSocket:
  - ESP32: `ws://...?api_key=[YOUR_API_KEY]`
  - Dashboard: `ws://...?token=[JWT_TOKEN]`
-  Maps untuk tracking connected clients:
  - `connectedClients`: Menyimpan semua koneksi aktif (device & dashboard)
  - `userConnections`: Menyimpan mapping user → dashboard connections (untuk multi-tab)

#### Logika Baru:
- **Sensor Data Flow**: ESP32 → Server Broker → Broadcast ke semua Dashboard user
- **Command Flow**: Dashboard → Server Broker → Route ke ESP32 tujuan
- **Format JSON Standar**: Semua komunikasi menggunakan JSON stringified

### Frontend (dashboard.html)

#### Dihapus:
-  Script tag: `<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>`
-  Socket.IO event listeners: `socket.emit()`, `socket.on()`
-  Socket.IO connection setup: `io(API_BASE, { auth: { token } })`

#### Ditambahkan:
-  Native WebSocket connection: `new WebSocket(wsUrl)`
-  `ws.onmessage` handler untuk menerima data dari server
-  `ws.send(JSON.stringify(data))` untuk mengirim commands
-  Auto-reconnect logic (3 detik jika koneksi putus)

#### Event Handlers Update:
**Toggle Switch:**
```javascript
// Lama (Socket.IO):
socket.emit('widgetStateChange', { widgetId, newState });

// Baru (Native WebSocket):
ws.send(JSON.stringify({
  device_id: widget.device_id,
  sensor_type: widget.sensor_type,
  current_value: newState
}));
```

**Slider (PWM):**
```javascript
// Lama (Socket.IO):
socket.emit('widgetStateChange', { widgetId, newState: newValue });

// Baru (Native WebSocket):
ws.send(JSON.stringify({
  device_id: widget.device_id,
  sensor_type: widget.sensor_type,
  current_value: newValue
}));
```

### Dependencies (package.json)

```json
// Dihapus:
"socket.io": "^4.8.1"

// Ditambahkan:
"ws": "^8.14.2"
```

---

## 📊 Perbandingan Arsitektur

### Lama (Socket.IO + HTTP)
```
┌─────────────┐
│   ESP32     │
└────┬────────┘
     │ HTTP POST /api/data (+ x-api-key header)
     ↓
┌─────────────────────────────────┐
│   Express Server                │
│   ├─ HTTP routes                │
│   └─ Socket.IO server           │
└────┬────────────────────────────┘
     │ Socket.IO emit/on
     ↓
┌─────────────────────────────────┐
│   Browser Dashboard             │
│   (Socket.IO client)            │
└─────────────────────────────────┘
```

### Baru (Pure WebSocket Tunneling)
```
┌─────────────┐
│   ESP32     │
└────┬────────┘
     │ WebSocket (api_key query param)
     ↓
┌─────────────────────────────────┐
│   Express Server + WebSocket    │
│   ├─ HTTP routes (untuk auth)   │
│   └─ WebSocket Broker (routing) │
└────┬────────────────────────────┘
     │ WebSocket message (JSON)
     ↓
┌─────────────────────────────────┐
│   Browser Dashboard             │
│   (Native WebSocket client)     │
└─────────────────────────────────┘
```

---

## 🔄 Format JSON Standar

### Data dari ESP32 → Server → Dashboard
```json
{
  "device_id": 1,
  "sensor_type": "suhu",
  "value": "28.5",
  "timestamp": "2026-04-14T10:30:45.123Z"
}
```

### Perintah dari Dashboard → Server → ESP32
```json
{
  "device_id": 1,
  "sensor_type": "led_merah",
  "current_value": "true"
}
```

Server mengirim ke ESP32 (simplified):
```json
{
  "sensor_type": "led_merah",
  "value": "true"
}
```

---

## 🚀 Keuntungan Baru

| Aspek | Socket.IO | WebSocket Murni |
|-------|-----------|-----------------|
| **Overhead** | ~40KB library | ~13KB library |
| **Latency** | Medium | Sangat rendah |
| **Kompleksitas** | High | Low |
| **Real-time** |  |  |
| **Polling fallback** | Ada | Tidak perlu |
| **Custom protocol** | Sulit | Mudah |
| **Deployment** | Kompleks | Sederhana |

---

## 📝 Interface HTTP yang Tetap Ada

Endpoint-endpoint berikut **tetap menggunakan HTTP** (tidak berubah):

```
POST   /register                    - Registrasi user
POST   /login                       - Login user
POST   /api/devices                 - Daftar device baru
GET    /api/devices                 - List device milik user
DELETE /api/devices/:id             - Hapus device
POST   /api/widgets                 - Buat widget
GET    /api/widgets                 - List widget
DELETE /api/widgets/:id             - Hapus widget
GET    /api/data                    - Ambil data sensor 24h terakhir
GET    /api/data/device/:id         - Ambil data device untuk CSV
POST   /api/devices/share           - Buat shared link
GET    /api/public/view/:slug       - Ambil data untuk public view
GET    /:slug                       - Serve public-view.html
GET    /                            - Serve index.html
```

---

## 🔧 Upgrade Instructions

### 1. Update Dependencies
```bash
npm install
```
ini akan:
- Menghapus `socket.io` (dari package-lock.json)
- Memasang `ws` (versi 8.14.2)

### 2. Restart Server
```bash
npm start
```

Server akan log:
```
Server (Express + WebSocket) berjalan di http://localhost:3001
Akses dari jaringan lokal: http://192.168.x.x:3001
```

### 3. Test Dashboard
- Buka browser: `http://localhost:3001/login.html`
- Login dengan user yang sebelumnya
- Buka console (F12) → seharusnya ada log: `✓ WebSocket terhubung ke server!`
- Test: klik tombol/slider → seharusnya ada log: `📤 Mengirim Toggle/Slider: ...`

### 4. Update ESP32 Code
Lihat file [WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md) untuk:
- Format JSON baru
- Contoh kode ESP32
- Library yang diperlukan (ArduinoJson, WebSocketsClient)

---

## ⚠️ Breaking Changes

### Untuk Pengguna:
-  Jika menggunakan library Socket.IO di custom client, harus update ke native WebSocket
-  Dashboard dan public-view sudah otomatis update

### Untuk ESP32:
-  Rute HTTP POST `/api/data` sudah dihapus, harus ganti ke WebSocket
-  Header `x-api-key` tidak lagi dikirim via HTTP, pakai query parameter di WebSocket URL
-  Format JSON tetap mirip, tinggal hapus field yang tidak perlu

**Contoh update ESP32:**

**Lama:**
```cpp
HTTPClient http;
http.addHeader("x-api-key", apiKey);
http.POST("http://server:3001/api/data", 
         "{\"sensor_type\":\"suhu\",\"value\":\"28.5\"}");
```

**Baru:**
```cpp
WebSocketsClient webSocket;
webSocket.begin(serverIP, 3001, "/?api_key=" + String(apiKey));
webSocket.sendTXT("{\"sensor_type\":\"suhu\",\"value\":\"28.5\"}");
```

---

## 📚 Dokumentasi

- **[WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md)** - Protokol komunikasi lengkap
- **[readme.md](./readme.md)** - Setup & deployment guide

---

## ✨ Fitur Lanjutan yang Bisa Ditambah

Sekarang dengan WebSocket murni, beberapa fitur baru lebih mudah diimplementasi:

1. **Historical Data Sync** - Saat ESP32 reconnect, server bisa mengirim command yang tertunda
2. **Bulk Commands** - Send multiple commands dalam satu message
3. **Binary Protocol** - Bisa ganti JSON ke binary untuk bandwidth lebih efisien
4. **Rate Limiting** - Kontrol frekuensi data dari ESP32 per device
5. **Compression** - Kompresi message untuk bandwidth lebih kecil
6. **Two-way ACK** - Konfirmasi bahwa command sudah diterima device

---

## 🎉 Kesimpulan

Migrasi ke Pure WebSocket Tunneling membuat sistem:
-  **Lebih sederhana** (1 library WebSocket vs 2 library Socket.IO + Express static)
-  **Lebih cepat** (latency lebih rendah, no overhead)
-  **Lebih fleksibel** (mudah customize protocol)
-  **Lebih mudah debug** (JSON plain text, bukan black box)
-  **Production-ready** (scalable & reliable)

Selamat dengan upgrade sistem IoT Anda! 🚀

