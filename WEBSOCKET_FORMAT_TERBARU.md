# 🎯 Pure WebSocket Tunneling - Format Terbaru

## 📋 Spesifikasi Format JSON

### 1. ESP32 Connect (Open WebSocket)
```
ws://localhost:3001/?device=sensor_ruangan1
```
**Tidak ada API Key - hanya device identifier di query parameter.**

### 2. Data Server ⟷ Device (Binary Tunneling)

#### Device → Server (send)
```json
{
  "sensor_type": "suhu",
  "value": "28.5"
}
```

#### Server → Device (receive command)
```json
{
  "sensor_type": "led_merah",
  "value": "true"
}
```

### 3. Data Server ⟷ Dashboard

#### Device Data Broadcast (Server → Dashboard)
```json
{
  "device": "sensor_ruangan1",
  "sensor_type": "suhu",
  "value": "28.5",
  "timestamp": "2026-04-14T10:30:45.123Z"
}
```

#### Command (Dashboard → Server → Device)
```json
{
  "device": "sensor_ruangan1",
  "sensor_type": "led_merah",
  "value": "true"
}
```

---

## 🔌 Testing dengan WebSocket Tester

### Connect Device
```
URL: ws://localhost:3001/?device=sensor_ruangan1
```

Send:
```json
{"sensor_type": "suhu", "value": "25.5"}
```

Receive (dari server):
```json
{"sensor_type": "led", "value": "true"}
```

### Connect Dashboard
```
URL: ws://localhost:3001/?token=eyJhbGci...
```

Send:
```json
{"device": "sensor_ruangan1", "sensor_type": "led", "value": "true"}
```

Receive:
```json
{"device": "sensor_ruangan1", "sensor_type": "suhu", "value": "28.5", "timestamp": "..."}
```

---

## ✅ Key Features

- ✅ **Pure WebSocket Tunneling** - semua data via WebSocket, tidak ada HTTP polling
- ✅ **No API Key** - device identifier hanya dari query parameter
- ✅ **Open Connection** - device bisa connect langsung tanpa authentication khusus
- ✅ **JSON Format** - semua data dalam format JSON yang bisa ditest dengan WebSocket Tester
- ✅ **Real-time Bi-directional** - data dan command real-time dua arah
- ✅ **Simple & Testable** - bisa ditest langsung dengan aplikasi WebSocket Tester

---

## 📝 Update ESP32 Code

Ganti dari HTTP API:
```cpp
// LAMA
HTTPClient http;
http.addHeader("x-api-key", apiKey);
http.POST("http://server:3001/api/data", jsonData);
```

Ke WebSocket:
```cpp
// BARU
WebSocketsClient webSocket;
webSocket.begin("server", 3001, "/?device=sensor_ruangan1");
webSocket.sendTXT("{\"sensor_type\":\"suhu\",\"value\":\"28.5\"}");
```

---

## 🧪 Testing Checklist

- [ ] Device connect: `ws://localhost:3001/?device=sensor_ruangan1`
- [ ] Device send sensor: `{"sensor_type": "suhu", "value": "28.5"}`
- [ ] Dashboard menerima broadcast: `{"device": "sensor_ruangan1", ...}`
- [ ] Dashboard send command: `{"device": "sensor_ruangan1", "sensor_type": "led", "value": "true"}`
- [ ] Device menerima command: `{"sensor_type": "led", "value": "true"}`
- [ ] Testable dengan WebSocket Tester ✓

Selesai! System sudah pure WebSocket tunneling tanpa API Key.

