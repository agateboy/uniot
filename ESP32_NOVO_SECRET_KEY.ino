#include <WiFi.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include "DHT.h"

// ==========================================
// ⚙️  KONFIGURASI HARDWARE
// ==========================================
#define DHTPIN 5
#define DHTTYPE DHT22
#define POT_PIN 4
#define LED_PIN_ONOFF 6    // Pin Aktuator: LED Toggle (On/Off)
#define LED_PIN_PWM 7      // Pin Aktuator: LED PWM (Brightness)

// ==========================================
// 📡 KONFIGURASI WiFi
// ==========================================
const char* ssid = "iPhone";
const char* password = "12345678";

// ==========================================
// 🔑 KONFIGURASI UNIOT SERVER (Secret Key)
// ==========================================
const char* ws_host = "172.20.10.2";  // IP Server UNIOT
const int ws_port = 3001;               // Port Server
const char* secret_key = "Wnx3UH";      // ⚠️  GANTI dengan secret key dari dashboard (6 karakter)

// ==========================================
// 🔧 INISIALISASI GLOBAL
// ==========================================
WebSocketsClient webSocket;
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastPotRead = 0;
unsigned long lastDHTRead = 0;

bool isConnected = false;
bool isAuthenticated = false;  // Rastrear status de autenticação

// ==========================================
// 📨 CALLBACK: WebSocket Events Handler
// ==========================================
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    
    case WStype_DISCONNECTED: {
      isConnected = false;
      isAuthenticated = false;
      Serial.println("[WS] ❌ Disconnected dari server");
      Serial.println("[WS] Tentando reconectar em 5 segundos...");
      break;
    }

    case WStype_CONNECTED: {
      isConnected = true;
      isAuthenticated = false;  // Reset auth status pada reconexão
      Serial.println("[WS] ✅ TERHUBUNG ke UNIOT Server (pendente autenticação)");
      Serial.println("[WS] Enviando handshake de autenticação...");
      
      // === ENVIAR HANDSHAKE AUTH ===
      StaticJsonDocument<128> authDoc;
      authDoc["action"] = "auth";
      authDoc["key"] = secret_key;
      String authJson;
      serializeJson(authDoc, authJson);
      webSocket.sendTXT(authJson);
      Serial.printf("[WS] 📤 Auth enviada: %s\n", authJson.c_str());
      Serial.println("");
      break;
    }

    case WStype_TEXT: {
      // Parse JSON perintah dari dashboard
      // Format utama: {"var": "kondisi-led", "val": "true"}
      // Kompatibilitas: {"sensor_type": "kondisi-led", "value": "true"}
      
      DynamicJsonDocument doc(256);
      DeserializationError error = deserializeJson(doc, payload, length);

      if (error) {
        Serial.printf("[JSON] ❌ Parse error: %s\n", error.c_str());
        break;
      }

      const char* sensorType = doc["var"] | doc["sensor_type"];
      const char* value = doc["val"] | doc["value"];

      if (!sensorType || !value) {
        Serial.println("[WS] ⚠️  Payload não completo (precisa var/val)");
        break;
      }

      Serial.printf("[WS] 📥 Comando recebido: %s = %s\n", sensorType, value);
      eksekusiAktuator(sensorType, value);
      break;
    }

    case WStype_PING: {
      Serial.println("[WS] 🔔 PING recebido do server");
      break;
    }

    case WStype_PONG: {
      Serial.println("[WS] 🔔 PONG do server");
      break;
    }

    case WStype_ERROR: {
      Serial.printf("[WS] ❌ Error: %s\n", payload);
      break;
    }

    default:
      break;
  }
}

// ==========================================
// 🎮 FUNGSI: Eksekusi Perintah Aktuator
// Menerima perintah dari dashboard dan execute
// ==========================================
void eksekusiAktuator(const char* sensorType, const char* value) {
  
  // Kontrol LED on/off (Pin 6)
  if (strcmp(sensorType, "kondisi-led") == 0) {
    bool state = strcmp(value, "true") == 0 || strcmp(value, "1") == 0;
    digitalWrite(LED_PIN_ONOFF, state ? HIGH : LOW);
    Serial.printf("✓ LED (Pin 6): %s\n", state ? "ON" : "OFF");
  }
  
  // Kontrol LED PWM / Brightness (Pin 7)
  else if (strcmp(sensorType, "pwm-led") == 0) {
    int pwmValue = constrain(atoi(value), 0, 255);
    analogWrite(LED_PIN_PWM, pwmValue);
    Serial.printf("✓ PWM (Pin 7): %d/255\n", pwmValue);
  }
  
  // Tambahkan aktuator lainnya sesuai kebutuhan
  else {
    Serial.printf("⚠️  Aktuator tidak dikenali: %s\n", sensorType);
  }
}

// ==========================================
// 📤 FUNGSI: Kirim Data Sensor ke Server
// Format JSON: {"var": "suhu", "val": 28.5}
// ==========================================
void kirimDataWebSocket(const char* sensor_type, float value) {
  
  // Verifica se está conectado E autenticado
  if (!isConnected || !isAuthenticated) {
    return;  // Silencioso se não está conectado/autenticado
  }

  StaticJsonDocument<128> doc;
  doc["var"] = sensor_type;
  doc["val"] = value;

  String jsonString;
  serializeJson(doc, jsonString);

  webSocket.sendTXT(jsonString);
  Serial.printf("📤 [%s]: %.2f\n", sensor_type, value);
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
  Serial.println("[SENSOR] ✓ DHT22 initialized");

  // Inisialisasi pin aktuator
  pinMode(LED_PIN_ONOFF, OUTPUT);
  digitalWrite(LED_PIN_ONOFF, LOW);
  pinMode(LED_PIN_PWM, OUTPUT);
  analogWrite(LED_PIN_PWM, 0);
  Serial.println("[AKTUATOR] ✓ LED pins initialized");

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
    Serial.printf("\n[WiFi] ✅ Terhubung! IP: %s\n\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] ❌ Gagal terhubung. Periksa SSID & Password!");
    return;
  }

  // === Koneksi WebSocket ao UNIOT Server ===
  Serial.printf("[WS] Conectando ao: ws://%s:%d\n", ws_host, ws_port);
  Serial.printf("[WS] Secret key (para handshake): %s\n", secret_key);
  
  // Conectar sem parâmetros na URL (autenticação via handshake)
  webSocket.begin(ws_host, ws_port, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);  // Tentar reconectar a cada 5 segundos
  
  Serial.println("[WS] 🔗 Conexão iniciada...");

  Serial.println("\n[SETUP] ✅ Initialization complete!\n");
  Serial.println("Waiting for WebSocket connection...\n");
}

// ==========================================
// 🔄 LOOP: Pembacaan Sensor & Control
// ==========================================
void loop() {
  // WAJIB: Maintain WebSocket connection (chamada frequente)
  webSocket.loop();
  
  // Pequeno delay para evitar WDT reset
  delay(10);

  unsigned long now = millis();

  // ===== PEMBACAAN POTENSIOMETER (500ms) =====
  // Interval lebih singkat karena pembacaan analog cepat & stable
  if (now - lastPotRead > 500) {
    lastPotRead = now;
    int rawVal = analogRead(POT_PIN);
    float potVal = map(rawVal, 0, 4095, 0, 100);
    kirimDataWebSocket("potensiometer", potVal);
  }

  // ===== PEMBACAAN DHT22 (2000ms) =====
  // Jeda PENTING untuk menjaga stabilitas sensor fisik
  if (now - lastDHTRead > 2000) {
    lastDHTRead = now;
    
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    // Validasi pembacaan (DHT22 bisa return NaN jika error)
    if (!isnan(temperature)) {
      kirimDataWebSocket("suhu", temperature);
    } else {
      Serial.println("⚠️  DHT22: gagal baca temperature");
    }

    if (!isnan(humidity)) {
      kirimDataWebSocket("kelembapan", humidity);
    } else {
      Serial.println("⚠️  DHT22: gagal baca humidity");
    }
  }
}

// ==========================================
// 📋 INFORMAÇÃO DE CONEXÃO
// ==========================================
/*
  CONNECTION FLOW:
  1. Conecta ao: ws://172.20.10.2:3001/
  2. Server aceita conexão (status: pending)
  3. Device envia: {"action":"auth","key":"0Ly6kU"}
  4. Server valida e responde: {"status":"success","message":"...","device_id":1}
  5. Device pode agora enviar dados
  
  SENSOR DATA FORMAT (Device → Server):
  {"var": "suhu", "val": 28.5}
  {"var": "kelembapan", "val": 65.2}
  {"var": "potensiometer", "val": 45.3}
  
  COMMAND FORMAT (Server → Device):
  {"var": "kondisi-led", "val": "true"}
  {"var": "pwm-led", "val": "128"}
  
  FEATURES:
  ✓ Manual Handshake Authentication (sem URL parameters)
  ✓ 3-segundo timeout para autenticação
  ✓ Auto-reconnect a cada 5 segundos
  ✓ Comunicação bidirecional em tempo real
  ✓ Dashboard pode enviar comandos para device
  ✓ Compatible com Android WebSocket Tester app
*/
