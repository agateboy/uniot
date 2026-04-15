# 🔑 UNIOT Secret Key Authentication - Setup Guide

## 📖 Visão Geral

O sistema UNIOT foi atualizado para usar **Secret Keys** ao invés de device names. Isso traz:

✅ **Evita conflitos de nomes** - Múltiplos devices podem ter nomes similares  
✅ **Segurança aprimorada** - Secret Key é único e aleatório (32 caracteres)  
✅ **Melhor rastreamento** - Database mapeia secret_keys para device_id  
✅ **Bi-direcional seguro** - Read & Write permissions inclusos na secret_key  

---

## 🚀 Como Usar

### 1️⃣ Criar Device no Dashboard

1. Abra a dashboard (ex: `http://192.168.0.115:3001`)
2. Faça login com sua conta
3. Vá para seção **"My Devices"**
4. Clique **"Add Device"** 
5. Digite nome do device (ex: "Sala Sensor", "Kitchen Monitor", etc)
6. Clique **"Create"**

**Resultado:** Uma **secret_key** será gerada automaticamente

```json
{
  "device_id": 1,
  "device_name": "Sala Sensor",
  "secret_key": "aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9"
}
```

### 2️⃣ Copiar Secret Key

Copie a `secret_key` que apareceu na tela (aparecerá como um código de 32 caracteres).

Exemplo de Secret Key:
```
aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9
```

### 3️⃣ Atualizar Código Arduino

**Abra o arquivo `ESP32_SECRET_KEY.ino`** e procure por:

```cpp
const char* secret_key = "SALIN_SECRET_KEY_DARI_DASHBOARD_DI_SINI";
```

**Substitua** por sua secret_key copiada:

```cpp
const char* secret_key = "aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9";
```

Exemplo completo:
```cpp
// ==========================================
// 🔑 KONFIGURASI UNIOT SERVER
// ==========================================
const char* ws_host = "192.168.0.115";  // IP Server UNIOT
const int ws_port = 3001;               // Port Server
const char* secret_key = "aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9";  // ✅ Secret Key copiado
```

**Não esqueça de atualizar também:**
- `ssid` = seu WiFi SSID
- `password` = sua WiFi password
- `ws_host` = IP do seu servidor UNIOT

### 4️⃣ Upload para ESP32

1. Conecte ESP32 via USB
2. Abra Arduino IDE
3. Carregue o arquivo `ESP32_SECRET_KEY.ino`
4. Selecione Board: `ESP32 Dev Module`
5. Selecione a porta COM correta
6. Clique **"Upload"**

Monitor Serial mostrará:
```
========================================
   UNIOT ESP32 Pure WebSocket v2.0
   (Secret Key Authentication)
========================================

[SENSOR] ✓ DHT22 initialized
[AKTUATOR] ✓ LED pins initialized
[WiFi] Menghubungkan ke: AAA...
[WiFi] ✅ Terhubung! IP: 192.168.1.100

[WS] Menghubungkan ke: 192.168.0.115:3001
[WS] Menggunakan secret_key: aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9

[SETUP] ✅ Initialization complete!

Waiting for WebSocket connection...

[WS] ✅ Terhubung ke UNIOT Server!
[WS] Siap mengirim dan menerima data...
```

---

## 📡 Formato de Comunicação

### Device → Server (Sensor Data)

```json
{
  "sensor_type": "suhu",
  "value": 28.5
}
```

### Server → Device (Commands)

```json
{
  "sensor_type": "kondisi-led",
  "value": "true"
}
```

### Dashboard recebe:

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

## 📊 Sensor Types Suportados

| Sensor Type | Value Type | Example | Atuador? |
|-------------|-----------|---------|----------|
| `suhu` | Float | `25.5` | ❌ |
| `kelembapan` | Float | `65.2` | ❌ |
| `potensiometer` | Float | `45.3` | ❌ |
| `kondisi-led` | String | `"true"` ou `"false"` | ✅ |
| `pwm-led` | Integer (0-255) | `128` | ✅ |
| `device_status` | String | `"online"` | ❌ |

---

## 🔧 Customizar Sensors

Se quiser adicionar mais sensores, modifique o `loop()`:

```cpp
// Adicionar novo sensor (ex: Luminosidade)
if (now - lastLuxRead > 1000) {
    lastLuxRead = now;
    int lux = analogRead(LUX_PIN);
    kirimDataWebSocket("luminosidade", lux);
}
```

E no lado do servidor, configure o widget na dashboard:
- **sensor_type**: `luminosidade`
- **widget_type**: `gauge` ou `chart`

---

## 🐛 Troubleshooting

### ❌ "Secret key não valid"
- Copie a secret_key **exatamente** como foi gerada
- Verifique se não há espaços a mais
- Recrie o device e copie novamente

### ❌ "WebSocket disconnected"
- Verifique WiFi connection (Serial monitor)
- Verifique IP do servidor (`ws_host`)
- Verifique se servidor está rodando (`npm start`)

### ❌ "Dados não aparecem no dashboard"
- Confirme que device está terhubung (Serial monitor)
- Verifique se sensor_type está correto
- Recarregue a página do dashboard (F5)

### ❌ "Aktuador não responde"
- Verifique se device está online em "My Devices"
- Confirme que pino do ESP32 está correto (`LED_PIN_ONOFF`, `LED_PIN_PWM`)
- Teste com Serial.println para debug

---

## 📦 Database Schema

Quando um device é criado, a tabela `devices` armazena:

```sql
INSERT INTO devices (user_id, device_name, api_key, secret_key)
VALUES (1, 'Sala Sensor', '', 'aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9');
```

E a tabela `secretKeyRegistry` (in-memory) mapeia:

```
secret_key → { device_id, device_name, user_id }
```

Quando o servidor reinicia, ele carrega automaticamente todos os secret_keys do banco.

---

## 🔐 Segurança

- Secret keys são **únicos e aleatórios** (32 caracteres)
- Cada secret key é vinculado a um `device_id` e `user_id`
- Na WebSocket, apenas o `user_id` recebe dados do seu device
- Outros usuários não conseguem acessar seus dados

---

## ❓ FAQ

**P: Posso usar um secret_key em múltiplos ESP32?**  
R: Não, cada secret_key é único. Se múltiplos ESP32 usarem a mesma key, apenas o último a conectar permanecerá conectado.

**P: O que acontece se perder a secret_key?**  
R: Delete o device e crie novamente. Uma nova secret_key será gerada.

**P: Posso trocar a secret_key?**  
R: Futuramente vamos adicionar um botão "Regenerate Key". Por enquanto, delete e recrie o device.

**P: Preciso de API Key agora?**  
R: Não, secret_key substitui o API Key. O campo `api_key` estará vazio.

---

## 📞 Suporte

Se tiver dúvidas, verifique:
1. Serial Monitor do Arduino (debug logs)
2. Console do servidor (logs WebSocket)
3. Browser DevTools → Network → WS
