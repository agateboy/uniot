# Protocol Komunikasi WebSocket Tunneling

Dokumentasi lengkap untuk komunikasi WebSocket murni antara ESP32, Server, dan Browser Dashboard.

---

## 1. Koneksi WebSocket

### A. Dari ESP32 (Device)
```
ws://[SERVER_IP]:[PORT]?api_key=[YOUR_API_KEY]
```

**Contoh:**
```
ws://192.168.1.100:3001?api_key=uniot-xyz12345
```

### B. Dari Browser (Dashboard)
```
ws://[SERVER_IP]:[PORT]?token=[JWT_TOKEN]
```

**Contoh:**
```
ws://192.168.1.100:3001?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 2. Format JSON Standar

### A. Data dari ESP32 → Server → Dashboard
Ketika ESP32 mengirim pembacaan sensor, format JSON-nya:

```json
{
  "sensor_type": "suhu",
  "value": "28.5"
}
```

**Contoh pengiriman dari Arduino/ESP32:**
```cpp
#include <ArduinoJson.h>
#include <WebSocketsClient.h>

StaticJsonDocument<200> doc;
doc["sensor_type"] = "suhu";
doc["value"] = "28.5";

String jsonString;
serializeJson(doc, jsonString);
webSocket.sendTXT(jsonString);
```

### B. Perintah dari Dashboard → Server → ESP32
Ketika user mengklik tombol atau slider di dashboard, format JSON-nya:

```json
{
  "device_id": 1,
  "sensor_type": "led_merah",
  "current_value": "true"
}
```

Atau untuk slider (PWM):
```json
{
  "device_id": 1,
  "sensor_type": "pwm_brightness",
  "current_value": "128"
}
```

**Server akan mengirim ke ESP32 (hanya sensor_type dan value):**
```json
{
  "sensor_type": "led_merah",
  "value": "true"
}
```

---

## 3. Flow Diagram

### Sensor Data (Real-time monitoring)
```
ESP32 
  ↓ (WebSocket: sensor_type + value)
Server (Broker)
  ↓ (Broadcast ke semua Dashboard user)
Dashboard Browser
  ↓ (Update widget secara real-time)
User melihat grafik/gauge/angka berubah
```

### Control Command (Perintah dari dashboard)
```
User klik tombol/slider di Dashboard
  ↓
Dashboard (WebSocket: device_id + sensor_type + current_value)
  ↓
Server (cek permission user)
  ↓
Cari koneksi WebSocket device yang sesuai
  ↓
Kirim ke ESP32 (sensor_type + value)
  ↓
ESP32 menerima & eksekusi perintah (ON/OFF/PWM)
```

---

## 4. Contoh Implementasi ESP32

### PlatformIO (Arduino IDE Modern)

**platformio.ini:**
```ini
[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps = 
    ArduinoJson
    WebSocketsClient
```

**main.cpp:**
```cpp
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* serverIP = "192.168.1.100";
const int serverPort = 3001;
const char* apiKey = "uniot-abc123xyz"; // Dari dashboard

WebSocketsClient webSocket;
DynamicJsonDocument doc(200);

// Simulasi pembacaan sensor
float readTemperature() {
    return 25.5 + random(-5, 5) / 10.0; // Dummy value
}

int readLEDStatus() {
    return digitalRead(LED_PIN);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_CONNECTED: {
            Serial.println("[WebSocket] Connected to server");
            break;
        }
        case WStype_TEXT: {
            // Pesan dari server (command)
            StaticJsonDocument<200> cmdDoc;
            DeserializationError error = deserializeJson(cmdDoc, payload, length);
            
            if (error) {
                Serial.println("JSON parse error");
                return;
            }
            
            const char* sensorType = cmdDoc["sensor_type"];
            const char* value = cmdDoc["value"];
            
            Serial.print("[WebSocket] Command received: ");
            Serial.print(sensorType);
            Serial.print(" = ");
            Serial.println(value);
            
            // Eksekusi perintah
            if (strcmp(sensorType, "led_merah") == 0) {
                bool state = strcmp(value, "true") == 0;
                digitalWrite(LED_PIN, state ? HIGH : LOW);
            }
            else if (strcmp(sensorType, "pwm_brightness") == 0) {
                int pwmValue = atoi(value);
                analogWrite(PWM_PIN, pwmValue);
            }
            
            break;
        }
        case WStype_DISCONNECTED: {
            Serial.println("[WebSocket] Disconnected from server");
            break;
        }
        case WStype_ERROR: {
            Serial.println("[WebSocket] Error!");
            break;
        }
    }
}

void setup() {
    Serial.begin(115200);
    
    // Connect WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(100);
    }
    Serial.println("WiFi connected");
    
    // WebSocket setup
    webSocket.begin(serverIP, serverPort, "/?api_key=" + String(apiKey));
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
}

void loop() {
    webSocket.loop();
    
    // Kirim sensor data setiap 5 detik
    static unsigned long lastSend = 0;
    if (millis() - lastSend > 5000) {
        lastSend = millis();
        
        DynamicJsonDocument sendDoc(200);
        sendDoc["sensor_type"] = "suhu";
        sendDoc["value"] = String(readTemperature(), 1);
        
        String jsonString;
        serializeJson(sendDoc, jsonString);
        webSocket.sendTXT(jsonString);
        
        Serial.print("Sent: ");
        Serial.println(jsonString);
    }
}
```

---

## 5. Debugging

### Check WebSocket Status
Di browser Dashboard, buka Console (F12) dan lihat logs:
```
✓ WebSocket terhubung ke server!
📨 Data diterima dari server: {...}
📤 Mengirim Toggle: device=1, sensor=led_merah, value=true
```

### Server Logs
Jalankan server dengan:
```bash
npm start
```

Lihat logs seperti:
```
[WebSocket] Koneksi baru - Token: ada, Device: undefined, ApiKey: ada
[WebSocket] Device tersambung - Device ID: 1, User ID: 2
[WebSocket] Pesan dari device (device:1): {"sensor_type":"suhu","value":"28.5"}
[WebSocket] Pesan dari dashboard (dashboard:2:1234567): {"device_id":1,"sensor_type":"suhu","current_value":"28.5"}
```

---

## 6. Security Notes

✔️ **Yang sudah aman:**
- API Key untuk ESP32 disimpan di database
- JWT Token untuk dashboard sudah terverifikasi
- Setiap command dari dashboard divalidasi (cek user punya device tersebut)

⚠️ **Harus diperhatikan production:**
- Ganti `ws://` dengan `wss://` (WebSocket Secure) jika production
- Update SECRET_JWT dengan kunci yang kuat
- Setup HTTPS/SSL certificate
- Implement rate-limiting untuk prevent deDoS

---

## 7. Troubleshooting

**ESP32 tidak bisa connect:**
- Cek API Key di dashboard ✓ cocok?
- Cek SERVER_IP & PORT benar?
- Firewall blocking port 3001?

**Dashboard tidak terima data dari ESP32:**
- Buka console dashboard (F12)
- Cek apakah tulisan "✓ WebSocket terhubung" ada
- Cek server logs apakah device tersambung

**Perintah dari dashboard tidak diterima ESP32:**
- Cek apakah device terkoneksi (lihat server logs)
- Cek format JSON yang dikirim dashboard

