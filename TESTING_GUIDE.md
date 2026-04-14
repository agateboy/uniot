# 🧪 TESTING GUIDE - WebSocket Tunneling

Panduan testing untuk memverifikasi bahwa sistem WebSocket Tunneling sudah berjalan dengan baik.

---

## ✅ Pre-Flight Checks

Sebelum testing, pastikan:

1. **Backend sudah di-update:**
   ```bash
   npm install
   npm start
   ```
   Seharusnya log: `Server (Express + WebSocket) berjalan di http://localhost:3001`

2. **Browser sudah terbaru** (untuk WebSocket support)

3. **Firewall port 3001 terbuka**

---

## 🚀 Phase 1: Backend Connectivity Test

### 1a. HTTP Endpoints (for Dashboard Management)

```bash
# Test Registration
curl -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"123456"}'

# Expected: {"status":"success","message":"User berhasil terdaftar!"}
```

```bash
# Test Login
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}'

# Expected: {"message":"Login berhasil!","token":"eyJhbGci..."}
```

Salin TOKEN dari response di atas untuk testing berikutnya.

```bash
# Test Get Devices (gunakan TOKEN yang sudah di-dapat)
curl -X GET http://localhost:3001/api/devices \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected: [] (empty array jika belum ada device)
```

### Expected Result:
✅ Semua HTTP endpoint berfungsi normal

---

## 🌐 Phase 2: WebSocket Connection Test (Browser)

### 2a. Dashboard Login & WebSocket Connect

1. Buka browser: `http://localhost:3001/login.html`
2. Login dengan akun testuser yang dibuat di Phase 1
3. Seharusnya redirect ke dashboard
4. **Buka Developer Console**: Tekan `F12` → Tab konsol

### Expected Logs:
```
✓ WebSocket terhubung ke server!
```

Jika melihat log ini, berarti WebSocket sudah connect dengan baik! ✅

---

## 📱 Phase 3: Device Registration & Widget Setup

### 3a. Daftar Device baru

1. Di dashboard, isi "Nama Perangkat Baru" dengan `Simulasi ESP32`
2. Klik "Tambahkan Perangkat"
3. Seharusnya menerima API Key
4. **Salin API Key ini** (contoh: `uniot-xyz123abc`)

### 3b. Buat Widget

1. Pilih device di "Pilih Perangkat Aktif"
2. Klik "+ Tambah Variabel"
3. Isi:
   - **Nama Variabel**: `suhu`
   - **Tipe Visualisasi**: `Number`
   - **Tipe Data**: `Float`
4. Klik "Simpan Widget"

Ulangi 3-4 kali, buat widget:
- Widget 1: `suhu` (Number)
- Widget 2: `kelembaban` (Number)
- Widget 3: `led_merah` (Toggle)
- Widget 4: `brightness` (Slider)

### Expected Result:
✅ Dashboard berisi 4 widget kosong (belum ada data)

---

## 🔌 Phase 4: WebSocket Simulation (Node.js)

Sekarang kita simulasikan ESP32 mengirim data via WebSocket.

### 4a. Buat file test-websocket-device.js

```javascript
// File: test-websocket-device.js
const WebSocket = require('ws');

const API_KEY = 'uniot-xyz123abc'; // ← GANTI DENGAN API KEY ANDA
const SERVER = 'ws://localhost:3001';

const ws = new WebSocket(`${SERVER}/?api_key=${API_KEY}`);

ws.onopen = () => {
    console.log('✓ Device connected to server');
    
    // Kirim data sensor setiap 3 detik
    setInterval(() => {
        const data = {
            sensor_type: 'suhu',
            value: String(25 + Math.random() * 10) // Random 25-35°C
        };
        ws.send(JSON.stringify(data));
        console.log('📤 Sent:', JSON.stringify(data));
    }, 3000);
    
    // Kirim kelembaban setiap 5 detik
    setInterval(() => {
        const data = {
            sensor_type: 'kelembaban',
            value: String(40 + Math.random() * 40) // Random 40-80%
        };
        ws.send(JSON.stringify(data));
        console.log('📤 Sent:', JSON.stringify(data));
    }, 5000);
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('📨 Command received:', data);
    
    // Simulasi eksekusi command
    if (data.sensor_type === 'led_merah') {
        console.log(`  → LED ${data.value === 'true' ? 'ON' : 'OFF'}`);
    } else if (data.sensor_type === 'brightness') {
        console.log(`  → Brightness set to ${data.value}%`);
    }
};

ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
};

ws.onclose = () => {
    console.log('⚠️ Connection closed');
    process.exit(1);
};
```

### 4b. Jalankan Simulasi

```bash
node test-websocket-device.js
```

### Expected Output:
```
✓ Device connected to server
📤 Sent: {"sensor_type":"suhu","value":"28.5"}
📤 Sent: {"sensor_type":"kelembaban","value":"62.3"}
```

### Expected pada Dashboard:
- Widget "suhu" menampilkan angka yang berubah-ubah (25-35)
- Widget "kelembaban" menampilkan angka yang berubah-ubah (40-80)
- Log console:
  ```
  📨 Data diterima dari server: {device_id: 1, sensor_type: "suhu", value: "28.5", ...}
  ```

✅ **Sukses**: Data dari ESP32 real-time masuk ke dashboard!

---

## 🎮 Phase 5: Control Command Test

Sekarang test perintah balik dari dashboard ke device.

### 5a. Test Toggle (ON/OFF)

1. Klik tombol toggle "led_merah" di dashboard
2. **Lihat server logs** → seharusnya menampilkan command dikirim ke device
3. **Lihat test-websocket-device.js logs** → seharusnya:
   ```
   📨 Command received: {sensor_type: "led_merah", value: "true"}
     → LED ON
   ```

### Expected pada Browser Console:
```
📤 Mengirim Toggle: device=1, sensor=led_merah, value=true
```

✅ **Sukses**: Command dari dashboard diterima device!

### 5b. Test Slider (PWM)

1. Geser slider "brightness" di dashboard
2. **Lihat test-websocket-device.js logs**:
   ```
   📨 Command received: {sensor_type: "brightness", value: "128"}
     → Brightness set to 128%
   ```

✅ **Sukses**: PWM command bekerja!

---

## 📊 Phase 6: Multi-Tab Test

Test untuk memastikan sistem support multi-tab dari user yang sama.

### 6a. Buka Dashboard di 2 Tab

1. Buka tab baru: `http://localhost:3001/login.html`
2. Login dengan user yang sama
3. Kedua tab seharusnya terhubung

### 6b. Test Real-time Sync

1. Di **Tab 1**: Klik toggle "led_merah" → ON
2. Di **Tab 2**: Widget "led_merah" seharusnya icon berubah ke ON juga
3. Di **Tab 2**: Geser slider "brightness" → 200
4. Di **Tab 1**: Display brightness seharusnya berubah ke 200 juga

✅ **Sukses**: Multi-tab sync berfungsi!

---

## 📈 Phase 7: Historical Data Test

### 7a. Test API endpoints

Query data yang sudah dikumpulkan:

```bash
curl -X GET http://localhost:3001/api/data \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected: Array of {device_id, sensor_type, value, timestamp}
```

✅ **Sukses**: Historical data tersimpan di database!

---

## 🔄 Phase 8: Reconnection Test

Test auto-reconnect jika koneksi putus.

### 8a. Forced Disconnect

1. Buka server logs (`npm start` window)
2. Cek logs saat device connect:
   ```
   [WebSocket] Device tersambung - Device ID: 1, User ID: 2
   ```

3. Hentikan device test:
   ```bash
   # Ctrl+C di test-websocket-device.js
   ```

4. Lihat server logs: seharusnya ada log `[WebSocket] Koneksi ditutup`

### 8b. Reconnect

1. Jalankan ulang device test dalam 10 detik
2. Server logs seharusnya menampilkan device connect lagi
3. Dashboard seharusnya mulai menerima data lagi

✅ **Sukses**: Auto-reconnect berfungsi!

---

## 📋 Checklist Hasil Testing

| No. | Test | Status | Notes |
|-----|------|--------|-------|
| 1 | HTTP Register | ✅/❌ | |
| 2 | HTTP Login | ✅/❌ | |
| 3 | WebSocket Connect (Dashboard) | ✅/❌ | |
| 4 | Sensor Data masuk Dashboard | ✅/❌ | |
| 5 | Toggle Command ke Device | ✅/❌ | |
| 6 | Slider Command ke Device | ✅/❌ | |
| 7 | Multi-Tab Sync | ✅/❌ | |
| 8 | Historical Data API | ✅/❌ | |
| 9 | Auto-Reconnect | ✅/❌ | |

---

## 🐛 Jika Ada Error

### WebSocket Connection Refused
```
Error: connect ECONNREFUSED
```
→ Server tidak running. Jalankan `npm start`

### Token tidak valid
```
[WebSocket] Koneksi dashboard ditolak - Token tidak valid
```
→ Token sudah expired. Login ulang di dashboard.

### API Key tidak valid
```
[WebSocket] Koneksi device ditolak - API Key tidak valid
```
→ API Key salah. Cek di dashboard (tab Daftar Perangkat)

### Data tidak masuk dashboard
→ Cek browser console (F12) untuk error logs
→ Cek server logs untuk device connection status

---

## 🎉 Hasil Akhir

Jika semua test ✅ berhasil:

- ✅ Backend WebSocket Tunneling sudah berfungsi
- ✅ Frontend Dashboard sudah terhubung dengan baik
- ✅ Real-time data streaming berjalan normal
- ✅ Two-way command (dashboard → device) berfungsi
- ✅ Multi-tab support aktif
- ✅ Auto-reconnect logic berfungsi

**Sistem siap untuk production!** 🚀

Sekarang tinggal update kode ESP32 Anda (lihat [ESP32_MIGRATION.md](./ESP32_MIGRATION.md)) dan sistem sudah complete!

