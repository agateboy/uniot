# 🚀 UNIOT Secret Key - Quick Reference

## 📍 URL Formats

```
Device Connect:
ws://192.168.0.115:3001/?key=aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9

Dashboard Connect:
ws://192.168.0.115:3001/?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 💻 Device → Server (Sensor Data)

```json
{"sensor_type": "suhu", "value": 28.5}
{"sensor_type": "kelembapan", "value": 65.2}
{"sensor_type": "potensiometer", "value": 45.3}
```

---

## 🎮 Server → Device (Commands)

```json
{"sensor_type": "kondisi-led", "value": "true"}
{"sensor_type": "pwm-led", "value": "128"}
```

---

## 📡 Server → Dashboard (Broadcast)

```json
{
  "device": "Sala Sensor",
  "device_id": 1,
  "sensor_type": "suhu",
  "value": "28.5",
  "timestamp": "2026-04-15T10:30:45.123Z"
}
```

---

## 🔑 Secret Key Generation

```javascript
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
let key = '';
for (let i = 0; i < 32; i++) {
  key += chars.charAt(Math.floor(Math.random() * chars.length));
}
return key;

// Resultado: aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9
```

---

## 📦 Database Tables

### devices
```sql
CREATE TABLE devices (
  device_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  device_name TEXT,
  api_key TEXT,
  secret_key TEXT UNIQUE,
  public_slug TEXT UNIQUE
);
```

### sensor_data
```sql
CREATE TABLE sensor_data (
  data_id INTEGER PRIMARY KEY,
  device_id INTEGER NOT NULL,
  sensor_type TEXT,
  value TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🏗️ Architecture

```
┌──────────────┐           ┌──────────────┐
│   ESP32      │           │   Browser    │
│   Device     │◄────────►│   Dashboard  │
└──────────────┘           └──────────────┘
  ?key=abc123                ?token=xyz789
        │                          │
        └──────────┬───────────────┘
                   │
            ┌──────▼──────┐
            │  WebSocket  │
            │   Server    │
            │ (index.js)  │
            └──────┬──────┘
                   │
            ┌──────▼───────────┐
            │   SQLite DB      │
            │  - devices       │
            │  - sensor_data   │
            │  - widgets       │
            └──────────────────┘
```

---

## ⚙️ Arduino Code Template

```cpp
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

const char* secret_key = "YOUR_SECRET_KEY_32_CHARS";
const char* ws_host = "192.168.0.115";
const int ws_port = 3001;

WebSocketsClient webSocket;

void setup() {
  String ws_path = "/?key=" + String(secret_key);
  webSocket.begin(ws_host, ws_port, ws_path.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
  
  // Send sensor data
  DynamicJsonDocument doc(200);
  doc["sensor_type"] = "suhu";
  doc["value"] = 25.5;
  
  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_TEXT) {
    DynamicJsonDocument doc(256);
    deserializeJson(doc, payload, length);
    
    String sensorType = doc["sensor_type"];
    String value = doc["value"];
    
    // Execute acuator
    if (sensorType == "kondisi-led") {
      digitalWrite(LED_PIN, value == "true" ? HIGH : LOW);
    }
  }
}
```

---

## 🔐 Environment Setup

**.env**
```
LOCAL_IP=192.168.0.115
PORT=3001
SECRET_JWT=YOUR_SECRET_HERE
```

---

## 📝 Sensor Types Reference

| Type | Value | Direction | Purpose |
|------|-------|-----------|---------|
| suhu | 25.5 | D→S | Temperature reading |
| kelembapan | 65.2 | D→S | Humidity reading |
| potensiometer | 45.3 | D→S | Potentiometer value |
| luminosidade | 800 | D→S | Light level |
| kondisi-led | true/false | S→D | Toggle LED |
| pwm-led | 0-255 | S→D | PWM brightness |
| device_status | online | D→S | Device heartbeat |

---

## 🛠️ Server Startup

```bash
# Install dependencies
npm install

# Start server
npm start

# Result
Successfully connected to database.sqlite! 🔌
✓ Secret key registry loaded: X devices
Server running on http://192.168.0.115:3001
```

---

## 🧪 Testing with WebSocket Client

### Connect Device
```
URL: ws://192.168.0.115:3001/?key=aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9
Send: {"sensor_type":"suhu","value":28.5}
```

### Connect Dashboard
```
URL: ws://192.168.0.115:3001/?token=eyJhbGci...
Send: {"device_id":1,"sensor_type":"kondisi-led","value":"true"}
```

---

## 🐛 Debug Logs

### Server Logs
```
[WebSocket] Koneksi baru - Secret Key: ada, Token: tidak
[✓ Device] Terhubung - "Sala Sensor" (ID: 1)
[Device "Sala Sensor"] Kirim data: { sensor_type: 'suhu', value: 28.5 }
[Dashboard User 1] Command ke device 1: { sensor_type: 'kondisi-led', value: 'true' }
[✓ Command] Sent to device 1
```

### Arduino Serial
```
[WiFi] ✅ Terhubung! IP: 192.168.1.100
[WS] Terhubung ke: 192.168.0.115:3001
[WS] Menggunakan secret_key: aB5xQ9mK2pL...
[WS] ✅ Terhubung ke UNIOT Server!
✓ Terkirim [suhu]: 28.50
[WS] 📥 Perintah diterima: kondisi-led = true
✓ LED (Pin 6): ON
```

---

## 🚨 Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Secret key tidak valid" | Wrong key copied | Copy exactly 32 chars |
| "Token tidak valid" | Expired JWT | Relogin in dashboard |
| "WebSocket disconnected" | Network error | Check IP & WiFi |
| "Device tidak terhubung" | Device offline | Check Arduino serial |

---

## 📊 API Endpoints (HTTP)

```
POST   /api/devices              - Create new device
GET    /api/devices              - List user devices
DELETE /api/devices/:id          - Delete device
POST   /api/widgets              - Create widget
GET    /api/widgets              - List widgets
DELETE /api/widgets/:id          - Delete widget
GET    /api/data                 - Get 24h sensor history
POST   /api/devices/share        - Share device publicly
```

---

## 🔗 Connection Flow

```
ESP32 Boots
    ↓
Connects to WiFi
    ↓
Opens WebSocket: ws://server:3001/?key=secret
    ↓
Server validates secret_key in registry
    ↓
Lookup: deviceInfo = secretKeyRegistry.get(key)
    ↓
Device becomes "online" in DB
    ↓
ESP32 starts sending sensor data every 500ms-2000ms
    ↓
Server saves to sensor_data table
    ↓
Broadcasts to all dashboards (own user only)
    ↓
Dashboard displays in real-time
```

---

