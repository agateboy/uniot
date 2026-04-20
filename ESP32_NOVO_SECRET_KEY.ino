#include <WiFi.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include "DHT.h"

// ==========================================
// ⚙️ KONFIGURASI HARDWARE
// ==========================================
#define DHTPIN 5
#define DHTTYPE DHT22
#define POT_PIN 4
#define LED_PIN_ONOFF 6    // Pin Aktuator: LED Toggle (On/Off)
#define LED_PIN_PWM 7      // Pin Aktuator: LED PWM (Brightness)

// ==========================================
// KONFIGURASI WiFi
// ==========================================
const char* ssid = "Nuju Coffee 2";
const char* password = "seturanyogyakarta";

// ==========================================
// KONFIGURASI UNIOT SERVER (Secret Key)
// ==========================================
const char* ws_host = "192.168.110.152";  // IP Server UNIOT
const int ws_port = 3001;               // Port Server
const char* secret_key = "Wnx3UH";      // ⚠️ GANTI dengan secret key dari dashboard (6 karakter)

// ==========================================
// INISIALISASI GLOBAL
// ==========================================
WebSocketsClient webSocket;
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastPotRead = 0;
unsigned long lastDHTRead = 0;
bool isConnected = false;

// ⭐ CHANGE DETECTION: Simpan nilai terakhir untuk deteksi perubahan
float lastPotValue = -1;
float lastTempValue = -1;
float lastHumidityValue = -1;

// ⭐ THRESHOLD: Kirim hanya jika perubahan signifikan
const float POT_THRESHOLD = 5.0;        // Kirim jika berubah 5% atau lebih
const float TEMP_THRESHOLD = 0.5;       // Kirim jika berubah 0.5°C atau lebih
const float HUMIDITY_THRESHOLD = 3.0;   // Kirim jika berubah 3% atau lebih

// ⭐ INTERVAL: Naikkan interval agar tidak terlalu sering
const unsigned long POT_INTERVAL = 1000;    // Ubah dari 500ms → 1000ms
const unsigned long DHT_INTERVAL = 5000;    // Ubah dari 2000ms → 5000ms

// ==========================================
// FUNGSI SUBSCRIBER: Eksekusi Perintah Aktuator
// ==========================================
void eksekusiAktuator(const char* sensorType, const char* value) {
  
  // Kontrol LED on/off (Pin 6)
  if (strcmp(sensorType, "kondisi-led") == 0) {
    bool state = (strcmp(value, "true") == 0 || strcmp(value, "1") == 0);
    digitalWrite(LED_PIN_ONOFF, state ? HIGH : LOW);
    Serial.printf("✓ EKSEKUSI: LED (Pin 6) diubah menjadi %s\n", state ? "ON" : "OFF");
  }
  
  // Kontrol LED PWM / Brightness (Pin 7)
  else if (strcmp(sensorType, "pwm-led") == 0) {
    int pwmValue = constrain(atoi(value), 0, 255);
    analogWrite(LED_PIN_PWM, pwmValue);
    Serial.printf("✓ EKSEKUSI: PWM (Pin 7) diubah menjadi %d/255\n", pwmValue);
  }
  
  else {
    Serial.printf("Aktuator tidak dikenali: %s\n", sensorType);
  }
}

// ==========================================
// CALLBACK: WebSocket Events Handler
// ==========================================
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    
    case WStype_DISCONNECTED: {
      isConnected = false;
      Serial.println("[WS] Terputus dari server UNIOT");
      Serial.println("[WS] Mencoba menyambung kembali...");
      break;
    }

    case WStype_CONNECTED: {
      isConnected = true;
      Serial.println("[WS] TERHUBUNG ke Websocket UNIOT Server!");
      Serial.println("[WS] Siap mengirim (Publish) dan menerima (Subscribe) data.\n");
      break;
    }

    case WStype_TEXT: {
      // Parse JSON perintah dari dashboard
      StaticJsonDocument<256> doc;
      DeserializationError error = deserializeJson(doc, payload, length);

      if (error) {
        Serial.printf("[JSON] Parse error: %s\n", error.c_str());
        break;
      }

      const char* sensorType = doc["var"];
      
      const char* value = doc["current_value"]; 

      // Fallback cadangan jika format menggunakan "val"
      if (!value) {
        value = doc["val"];
      }

      if (!sensorType || !value) {
        // Serial.println("[WS] Payload tidak lengkap (kehilangan sensor_type atau value)");
        break;
      }

      Serial.printf("[WS] Perintah Diterima dari Dashboard: %s = %s\n", sensorType, value);
      eksekusiAktuator(sensorType, value);
      break;
    }

    case WStype_PING: {
      Serial.println("[WS] PING diterima dari server");
      break;
    }

    case WStype_PONG: {
      Serial.println("[WS] PONG dibalas oleh server");
      break;
    }

    case WStype_ERROR: {
      Serial.printf("[WS] Error: %s\n", payload);
      break;
    }

    default:
      break;
  }
}

// ==========================================
// 📤 FUNGSI PUBLISHER: Kirim Data Sensor
// ==========================================
void kirimDataWebSocket(const char* sensor_type, float value) {
  if (!isConnected) return; // Jangan buang memori jika belum konek

  StaticJsonDocument<128> doc;
  doc["var"] = sensor_type;
  doc["val"] = value;

  String jsonString;
  serializeJson(doc, jsonString);

  webSocket.sendTXT(jsonString); // Kirim instan tanpa HTTP POST
  Serial.printf("Data Terkirim [%s]: %.2f\n", sensor_type, value);
}

// ==========================================
// 📊 SETUP: Inisialisasi Hardware & Koneksi
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n========================================");
  Serial.println("   UNIOT ESP32 Pure WebSocket v2.1");
  Serial.println("   (Secret Key Authentication)");
  Serial.println("========================================\n");

  // Inisialisasi sensor DHT22
  dht.begin();
  Serial.println("[SENSOR] DHT22 Siap");

  // Inisialisasi pin aktuator
  pinMode(LED_PIN_ONOFF, OUTPUT);
  digitalWrite(LED_PIN_ONOFF, LOW);
  pinMode(LED_PIN_PWM, OUTPUT);
  analogWrite(LED_PIN_PWM, 0);
  Serial.println("[AKTUATOR] LED Siap");

  // === Koneksi WiFi ===
  Serial.printf("[WiFi] Menghubungkan ke: %s...\n", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int wifiTimeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTimeout < 20) {
    delay(500);
    Serial.print(".");
    wifiTimeout++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Terhubung! IP Address: %s\n\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Gagal terhubung. Periksa SSID & Password!");
    return;
  }

  // === Koneksi WebSocket ke UNIOT Server ===
  Serial.printf("[WS] Membuka terowongan ke: ws://%s:%d\n", ws_host, ws_port);
  
  // Format URL: /?key=0Ly6kU
  String ws_path = String("/") + "?key=" + String(secret_key);
  
  webSocket.begin(ws_host, ws_port, ws_path.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);  // Reconnect otomatis jika putus
  
  Serial.println("[SETUP] Inisialisasi selesai. Menunggu koneksi...\n");
}

// ==========================================
// LOOP: Pembacaan Sensor (Publisher)
// ==========================================
void loop() {
  // WAJIB: Menjaga terowongan WebSocket tetap hidup
  webSocket.loop();
  
  unsigned long now = millis();

  // ===== PUBLISH POTENSIOMETER (Interval 1000ms + Change Detection) =====
  if (now - lastPotRead > POT_INTERVAL) {
    lastPotRead = now;
    int rawVal = analogRead(POT_PIN);
    float potVal = map(rawVal, 0, 4095, 0, 100);
    
    // ⭐ Kirim hanya jika perubahan >= threshold
    float potDiff = abs(potVal - lastPotValue);
    if (lastPotValue < 0 || potDiff >= POT_THRESHOLD) {
      lastPotValue = potVal;
      kirimDataWebSocket("potensiometer", potVal);
    }
  }

  // ===== PUBLISH DHT22 (Interval 5000ms + Change Detection) =====
  if (now - lastDHTRead > DHT_INTERVAL) {
    lastDHTRead = now;
    
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (!isnan(temperature)) {
      // ⭐ Kirim suhu hanya jika perubahan >= threshold
      if (lastTempValue < -100 || abs(temperature - lastTempValue) >= TEMP_THRESHOLD) {
        lastTempValue = temperature;
        kirimDataWebSocket("suhu", temperature);
      }
    }
    else Serial.println("⚠ DHT22: Gagal membaca suhu");

    if (!isnan(humidity)) {
      // ⭐ Kirim kelembapan hanya jika perubahan >= threshold
      if (lastHumidityValue < 0 || abs(humidity - lastHumidityValue) >= HUMIDITY_THRESHOLD) {
        lastHumidityValue = humidity;
        kirimDataWebSocket("kelembapan", humidity);
      }
    }
    else Serial.println("⚠ DHT22: Gagal membaca kelembapan");
  }
}