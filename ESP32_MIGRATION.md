# 🚀 Update ESP32 untuk WebSocket Tunneling

Panduan cepat untuk update kode ESP32 Anda agar kompatibel dengan sistem WebSocket tunneling baru.

---

## 📋 Perubahan Utama

| Aspek | Lama (HTTP) | Baru (WebSocket) |
|-------|----------|-----------------|
| **Koneksi** | HTTP POST | WebSocket |
| **Authentikasi** | Header `x-api-key` | Query parameter `?api_key=...` |
| **Data kirim** | HTTP request body | WebSocket send() |
| **Perintah terima** | HTTP response | WebSocket message |
| **Library** | HTTPClient | WebSocketsClient |

---

## 🔧 Kode Lama vs Baru

### Lama: HTTP Polling
```cpp
#include <HTTPClient.h>

void sendSensorData() {
    HTTPClient http;
    String url = "http://192.168.1.100:3001/api/data";
    String jsonData = "{\"sensor_type\":\"suhu\",\"value\":\"28.5\"}";
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", "uniot-abc123xyz");  // ← Header API Key
    
    int httpCode = http.POST(jsonData);
    String response = http.getString();
    http.end();
    
    // Parse response untuk mendapatkan command
    // ...
}
```

### Baru: WebSocket Tunneling
```cpp
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

WebSocketsClient webSocket;
const char* API_KEY = "uniot-abc123xyz";

void setupWebSocket() {
    String wsUrl = "/?api_key=" + String(API_KEY);  // ← Query parameter
    webSocket.begin("192.168.1.100", 3001, wsUrl);
    webSocket.onEvent(webSocketEvent);
}

void sendSensorData(const char* sensorType, float value) {
    StaticJsonDocument<200> doc;
    doc["sensor_type"] = sensorType;
    doc["value"] = String(value, 2);
    
    String jsonData;
    serializeJson(doc, jsonData);
    webSocket.sendTXT(jsonData);  // ← Send via WebSocket
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    if (type == WStype_TEXT) {
        // Menerima command dari server
        StaticJsonDocument<200> cmdDoc;
        deserializeJson(cmdDoc, payload);
        
        const char* sensorType = cmdDoc["sensor_type"];
        const char* value = cmdDoc["value"];
        
        // Eksekusi command
        executeCommand(sensorType, value);
    }
}
```

---

## 📦 Library Yang Diperlukan

### PlatformIO (Recommended)
**platformio.ini:**
```ini
[env:esp32]
lib_deps = 
    ArduinoJson
    WebSocketsClient
```

### Arduino IDE
Install dari Library Manager:
1. Sketch → Include Library → Manage Libraries
2. Cari: `ArduinoJson` → Install (by Benoit Blanchon)
3. Cari: `WebSocketsClient` → Install (by Morrissimo2010)

---

## 💻 Contoh Kode Lengkap

### Untuk ESP32 (PlatformIO)

**File: platformio.ini**
```ini
[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
lib_deps = 
    ArduinoJson
    WebSocketsClient
```

**File: src/main.cpp**
```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ===== KONFIGURASI =====
const char* SSID = "YOUR_SSID";
const char* PASSWORD = "YOUR_PASSWORD";
const char* SERVER_IP = "192.168.1.100";
const int SERVER_PORT = 3001;
const char* API_KEY = "uniot-abc123xyz";  // Dari dashboard

// Global variables
WebSocketsClient webSocket;
float lastTemperature = 0.0;
bool ledState = false;

// ===== SENSOR FUNCTIONS =====
float readTemperature() {
    // Baca dari sensor (simulasi)
    return 20.0 + random(-50, 50) / 10.0;
}

// ===== CONTROL FUNCTIONS =====
void controlLED(bool state) {
    ledState = state;
    digitalWrite(LED_PIN, state ? HIGH : LOW);
    Serial.print("[LED] Set to: ");
    Serial.println(state ? "ON" : "OFF");
}

void setPWM(int value) {
    analogWrite(PWM_PIN, value);
    Serial.print("[PWM] Set to: ");
    Serial.println(value);
}

// ===== WEBSOCKET HANDLERS =====
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_CONNECTED: {
            Serial.println("[WebSocket] Connected to server!");
            break;
        }
        
        case WStype_TEXT: {
            // Parse JSON dari server (command dari dashboard)
            StaticJsonDocument<200> doc;
            DeserializationError error = deserializeJson(doc, payload, length);
            
            if (error) {
                Serial.println("[Error] JSON parse failed!");
                return;
            }
            
            const char* sensorType = doc["sensor_type"] | "";
            const char* value = doc["value"] | "";
            
            Serial.print("[Command] ");
            Serial.print(sensorType);
            Serial.print(" = ");
            Serial.println(value);
            
            // Eksekusi sesuai sensor_type
            if (strcmp(sensorType, "led_merah") == 0) {
                bool state = strcmp(value, "true") == 0;
                controlLED(state);
            }
            else if (strcmp(sensorType, "pwm_brightness") == 0) {
                int pwmValue = atoi(value);
                setPWM(pwmValue);
            }
            break;
        }
        
        case WStype_DISCONNECTED: {
            Serial.println("[WebSocket] Disconnected!");
            break;
        }
        
        case WStype_ERROR: {
            Serial.println("[WebSocket] Error!");
            break;
        }
    }
}

// ===== SETUP =====
void setup() {
    Serial.begin(115200);
    delay(100);
    
    // Pin configuration
    pinMode(LED_PIN, OUTPUT);
    pinMode(PWM_PIN, OUTPUT);
    
    // WiFi connection
    Serial.print("Connecting to WiFi: ");
    Serial.println(SSID);
    WiFi.begin(SSID, PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nFailed to connect WiFi!");
        return;
    }
    
    // WebSocket setup
    String wsUrl = "/?api_key=" + String(API_KEY);
    webSocket.begin(SERVER_IP, SERVER_PORT, wsUrl);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    
    Serial.println("WebSocket setup complete");
}

// ===== LOOP =====
void loop() {
    webSocket.loop();
    
    // Kirim sensor data setiap 5 detik
    static unsigned long lastSend = 0;
    unsigned long now = millis();
    
    if (now - lastSend > 5000) {
        lastSend = now;
        
        // Baca sensor
        float temp = readTemperature();
        
        // Hanya kirim jika ada perubahan signifikan (hemat bandwidth)
        if (abs(temp - lastTemperature) > 0.5) {
            lastTemperature = temp;
            
            // Format JSON
            StaticJsonDocument<200> doc;
            doc["sensor_type"] = "suhu";
            doc["value"] = String(temp, 2);
            
            String jsonData;
            serializeJson(doc, jsonData);
            
            // Send via WebSocket
            webSocket.sendTXT(jsonData);
            
            Serial.print("[Sent] ");
            Serial.println(jsonData);
        }
    }
}
```

---

## 🔌 Pin Configuration

Sesuaikan PIN dengan board Anda:

```cpp
#define LED_PIN 5        // GPIO5 - onboard LED atau LED merah
#define PWM_PIN 18       // GPIO18 - PWM output untuk brightness/dimmer
#define TEMP_SENSOR_PIN 34  // GPIO34 - Analog input untuk sensor suhu
```

---

## ✅ Testing Checklist

Setelah upload kode ke ESP32:

- [ ] Serial monitor menampilkan "Connected to WiFi"
- [ ] Serial monitor menampilkan "Connected to server!"
- [ ] Setiap 5 detik ada log: `[Sent] {"sensor_type":"suhu","value":"..."`
- [ ] Buka dashboard dan lihat data suhu update real-time
- [ ] Klik tombol/slider di dashboard → lihat serial log menerima command

---

## 🐛 Troubleshooting

### ESP32 tidak bisa connect ke WiFi:
- Cek SSID dan PASSWORD benar
- Cek ESP32 dalam range WiFi
- Reset ESP32 atau power cycle

### ESP32 tidak bisa connect ke server:
- Cek SERVER_IP dan PORT benar
- Cek API_KEY dari dashboard cocok
- Cek firewall port 3001 tidak blocked
- Cek server running (`npm start`)

### Data tidak masuk dashboard:
- Buka server console → cek log `[WebSocket] Device tersambung`
- Buka browser dashboard console (F12) → cek `✓ WebSocket terhubung`
- Cek format JSON benar

### Command dari dashboard tidak diterima ESP32:
- Cek pada serial monitor apakah baris `[Command]` muncul
- Cek device_id di dashboard cocok dengan ESP32
- Cek koneksi WebSocket masih active

---

## 📚 Referensi

- [WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md) - Spesifikasi protokol lengkap
- [ArduinoJson Documentation](https://arduinojson.org/)
- [WebSocketsClient Library](https://github.com/Links2004/arduinoWebSockets)

---

## 💡 Tips

1. **Reduce data** - Hanya kirim data jika ada perubahan signifikan
2. **Increase interval** - Ubah 5000ms ke lebih lama jika perlu (hemat bandwidth)
3. **Error handling** - Tambah try-catch untuk JSON parsing jika perlu
4. **MQTT alternative** - Jika WebSocket masih kompleks, pertimbangkan MQTT

Happy coding! 🚀

