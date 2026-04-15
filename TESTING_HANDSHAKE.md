# Manual Handshake - Testing Guide

## Quick Test (5 minutes)

### Step 1: Start Server
```bash
cd /home/agate/Documents/uniot
npm start
# Expected output:
# [✓ Server] Listening on port 3000
# [✓ WebSocket] Listening on port 3001
```

### Step 2: Open Dashboard
```
Browser: http://localhost:3000
Login with test account
```

### Step 3: Create Test Device
1. Click "Create Device"
2. Name: "TestDevice"
3. Copy the 6-char secret key (e.g., `0Ly6kU`)
4. Note the device_id (e.g., `1`)

### Step 4: Update Arduino Code
Edit `ESP32_NOVO_SECRET_KEY.ino`:
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* ws_host = "YOUR_SERVER_IP";  // e.g., 192.168.1.100
const char* secret_key = "0Ly6kU";  // Your copied secret key
```

### Step 5: Upload & Monitor
```
1. Upload sketch to ESP32
2. Open Serial Monitor (115200 baud)
3. Expected sequence:
   [WiFi] Terhubung! IP: 192.168.x.x
   [WS] Conectando ao: ws://YOUR_SERVER_IP:3001/
   [WS] Enviando handshake de autenticação...
   [WS] 📤 Auth enviada: {"action":"auth","key":"0Ly6kU"}
   [✓ Auth] Autenticado como "TestDevice"
   [WS] ✅ AUTENTICADO! Iniciando envio de dados...
   📤 [suhu]: 28.50
   📤 [kelembapan]: 65.20
   📤 [potensiometer]: 45.00
```

### Step 6: Verify Dashboard
1. Go back to browser dashboard
2. Select "TestDevice" from device list
3. Should see live sensor data:
   - Temperature graph
   - Humidity graph
   - Potentiometer graph

### Step 7: Test Command from Dashboard
1. Click "Toggle" or adjust slider on dashboard
2. Check Arduino serial log for command:
   ```
   [WS] 📥 Comando recebido: kondisi-led = true
   ✓ LED (Pin 6): ON
   ```
3. Verify LED responds to command

---

## Detailed Troubleshooting

### Issue: Arduino Not Connecting to WiFi

**Serial Output:**
```
[WiFi] Tentando se conectar a: iPhone...
.....
[WiFi] ❌ Gagal terhubung
```

**Causes & Solutions:**
1. Wrong SSID or password
   - Update: `ssid` and `password` variables
   - Verify exact spelling (case-sensitive)

2. WiFi network not available
   - Create hotspot on phone with name "iPhone"
   - Or update SSID to your actual network

3. ESP32 WiFi module issue
   - Try: `WiFi.mode(WIFI_OFF); delay(1000); WiFi.mode(WIFI_STA);`

---

### Issue: Connected to WiFi But WebSocket Fails

**Serial Output:**
```
[WiFi] ✅ Terhubung! IP: 192.168.1.100
[WS] Conectando ao: ws://172.20.10.2:3001/
[WS] 🔗 Conexão iniciada...
[WS] ❌ Disconnected dari server
```

**Likely Causes:**
1. Server IP wrong
   - Check: `const char* ws_host = "172.20.10.2";`
   - Get correct IP: ping server from another device
   - Or use `localhost` if on same machine (won't work for remote)

2. Server not running
   - On server machine: `npm start`
   - Check for `[✓ WebSocket] Listening on port 3001`

3. Firewall blocking port 3001
   - Allow port 3001 in firewall
   - Or test with `telnet 172.20.10.2 3001`

4. DNS resolution issue
   - Use IP address instead of hostname
   - Or add to hosts file

---

### Issue: Connected but No Authentication Response

**Serial Output:**
```
[WS] ✅ TERHUBUNG ao UNIOT Server (pendente autenticação)
[WS] 📤 Auth enviada: {"action":"auth","key":"0Ly6kU"}
[WS] 🔌 Koneksi nova - IP: 192.168.1.100
(Silent - no response)
```

**Causes:**
1. Secret key doesn't match any device in database
   - Verify in dashboard: copied correct key?
   - Create new device to get new key

2. Server registry not loaded
   - Check server logs for: `[✓ Registry] Carregado`
   - Restart server if missing

3. Message format wrong
   - Arduino must send exactly: `{"action":"auth","key":"0Ly6kU"}`
   - Spaces matter, no extra fields

4. Event handler not triggered
   - Check server logs for incoming message
   - Use `console.log('[WS] Received:', rawMessage)` to debug

---

### Issue: Authentication Fails (Wrong Key)

**Serial Output:**
```
[WS] 📤 Auth enviada: {"action":"auth","key":"WRONG123"}
[✗ Auth] Erro: Secret key inválida
```

**Fix:**
1. Copy correct key from dashboard
2. Verify no typos (6 characters exactly)
3. Create new device to generate new key if lost

---

### Issue: Dashboard Shows "No Data" After Auth Success

**Arduino Serial Shows:**
```
[✓ Auth] Autenticado como "TestDevice"
[WS] ✅ AUTENTICADO! Iniciando envio de dados...
📤 [suhu]: 28.50
📤 [kelembapan]: 65.20
```

**But Dashboard Has No Graphs:**

1. Device not selected in dashboard
   - Check dropdown: "Select Device" - choose TestDevice

2. WebSocket not connected on dashboard
   - Check browser console: `open browser DevTools (F12)`
   - Should NOT show WebSocket errors

3. Data not being broadcast to dashboard user
   - Check server logs for: `broadcastToUserDashboards`
   - Verify user_id matches

4. Connection between dashboard and server broken
   - Refresh dashboard page
   - Check server logs for dashboard connection

---

## Server-Side Testing

### Check Connection Status

In server terminal, you should see:

```
[WebSocket] 🔌 Koneksi nova - IP: 192.168.1.100
[⏳ Device] Pendente - Aguardando autenticação...
[✓ Device] Autenticado - "TestDevice" (ID: 1)
[Device "TestDevice"] 📤 Dados: suhu = 28.5
[Dashboard User 1] 📥 Comando para device 1: kondisi-led = true
[✓ Comando] Enviado para device 1
```

### Test with Android WebSocket Tester

If available on Android device:

1. Open Android WebSocket Tester app
2. Connect to: `ws://[YOUR_SERVER_IP]:3001/`
3. Send message: `{"action":"auth","key":"0Ly6kU"}`
4. Expected response: `{"status":"success",...}`
5. Try sending sensor data: `{"sensor_type":"test","value":99}`
6. Check dashboard for data received

---

## Performance Testing

### Verify Sensor Data Frequency

**Expected Intervals:**
- DHT22 (temperature/humidity): 2000ms (every 2 seconds)
- Potentiometer: 500ms (very responsive)

**Check:**
```
Terminal: npm start 2>&1 | grep "📤"
Should see multiple messages per second
```

### Verify Command Response Time

1. Dashboard sends toggle command
2. Arduino receives within ~50-100ms
3. LED changes immediately
4. Arduino logs "LED ON/OFF"

---

## Reconnection Testing

### Simulate Disconnect

1. Unplug Ethernet/WiFi from Arduino board
2. Wait 5 seconds (server timeout)
3. Plug back in
4. Should see in serial:
   ```
   [WS] ❌ Disconnected dari server
   [WS] Tentando reconectar em 5 segundos...
   [WS] ✅ TERHUBUNG...
   [WS] 📤 Auth enviada...
   [✓ Auth] Autenticado...
   ```

### Verify Dashboard Handles Offline Device

1. While device reconnecting, try to send command from dashboard
2. Should see: `[✗ Device] ID 1 não conectado ou não autenticado`
3. Dashboard should show "Offline" or similar status
4. Once device reconnects, commands work again

---

## Complete Test Checklist

- [ ] Server starts without errors
- [ ] Dashboard login works
- [ ] Create device shows secret key
- [ ] Arduino compiles and uploads
- [ ] Arduino connects to WiFi
- [ ] Arduino connects to WebSocket server
- [ ] Arduino sends auth message
- [ ] Server validates and responds
- [ ] Arduino receives success response
- [ ] Serial shows "AUTENTICADO"
- [ ] Sensor data appears in dashboard graphs
- [ ] Dashboard command toggles LED on Arduino
- [ ] Disconnect Arduino
- [ ] Arduino reconnects automatically after 5s
- [ ] Commands work again after reconnect
- [ ] Multiple devices can connect simultaneously

---

## Expected Server Log Output

```
[WebSocket] 🔌 Koneksi nova - IP: 192.168.1.100
[⏳ Device] Pendente - Aguardando autenticação...
[WebSocket] Parse error: (none - valid JSON)
[✓ Device] Autenticado - "TestDevice" (ID: 1)
[Device "TestDevice"] 📤 Dados: suhu = 28.5
[Device "TestDevice"] 📤 Dados: kelembapan = 65.2
[Device "TestDevice"] 📤 Dados: potensiometer = 45.0
[Dashboard User 1] 📥 Comando para device 1: kondisi-led = true
[✓ Comando] Enviado para device 1
[Device] Fechando conexão anterior de "TestDevice"
[Device] Desconectado - "TestDevice" (ID: 1)
```

---

## Support

If tests fail:
1. Check this guide for your error
2. Review HANDSHAKE_AUTHENTICATION.md for protocol details
3. Check console/serial logs for actual error messages
4. Run single test at a time, not all at once
5. Restart server and device if unsure
