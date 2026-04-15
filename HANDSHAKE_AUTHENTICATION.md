# Manual Handshake Authentication System

## Overview
The UNIOT system has been upgraded to support **manual handshake authentication** instead of URL parameter-based authentication. This allows support for restricted WebSocket clients (like Android WebSocket Tester app) that cannot add URL parameters.

## Architecture

### Before (URL Parameter Based)
```
Device connects to: ws://172.20.10.2:3001/?key=0Ly6kU
Server validates immediately based on URL parameter
```

### After (Manual Handshake)
```
Device connects to: ws://172.20.10.2:3001/
Device sends:      {"action":"auth","key":"0Ly6kU"}
Server responds:   {"status":"success","message":"Authenticated...","device_id":1}
Device can now send sensor data
```

## Connection States

| State | Description | Can Send Data? |
|-------|-------------|---|
| **pending** | Connected but not authenticated | ❌ No |
| **authenticated** | Successfully authenticated with valid secret key | ✅ Yes |
| **timeout** | No auth message received within 3 seconds | ❌ Disconnected |

## Protocol

### Device (Arduino) Flow

#### 1. Initial Connection
```javascript
// Arduino connects to WebSocket server
webSocket.begin("172.20.10.2", 3001, "/");
```

#### 2. Server Accepts Connection (pending state)
```json
[Server] Connected - Status: pending, Waiting for auth...
```

#### 3. Device Sends Authentication
```json
// Device sends immediately on CONNECTED event
{"action":"auth","key":"0Ly6kU"}
```

#### 4. Server Validates & Responds
**Success Response:**
```json
{
  "status":"success",
  "message":"Authenticated as \"Device Name\"",
  "device_id":1
}
```

**Error Response:**
```json
{
  "status":"error",
  "message":"Secret key inválida"
}
```

#### 5. Device Sends Sensor Data
After authentication, device can send:
```json
// Temperature data
{"sensor_type":"suhu","value":28.5}

// Humidity data  
{"sensor_type":"kelembapan","value":65.2}

// Potentiometer data
{"sensor_type":"potensiometer","value":45.0}
```

### Dashboard Flow

The Dashboard **still uses JWT token** authentication for simplicity:

```
Dashboard connects to: ws://dashboard.com/?token=eyJhbGc...
Server validates JWT immediately (no handshake needed)
Dashboard authenticated and ready
```

This is more efficient than handshake since both are on same server.

## Timeout Behavior

### 3-Second Authentication Window

If device doesn't send authentication message within **3 seconds** of connection:

```javascript
// Server-side
authTimeout = setTimeout(() => {
    if (authStatus === 'pending') {
        ws.close(1008, 'Autenticação timeout - nenhuma mensagem recebida em 3s');
        console.log('[✗ Device] ⏱️ Timeout de autenticação');
    }
}, 3000);
```

### What Happens When Device Reconnects?

1. Old connection is closed
2. New connection starts in `pending` state
3. Device must send auth message again
4. If invalid: connection closes immediately
5. If valid: new 3-second timeout is set on next disconnect

## Arduino Implementation

### Key Code Sections

**1. Authentication Flag:**
```cpp
bool isConnected = false;
bool isAuthenticated = false;  // Track auth status
```

**2. Send Auth on Connection:**
```cpp
case WStype_CONNECTED: {
    isConnected = true;
    isAuthenticated = false;  // Reset on reconnect
    
    // Send handshake auth immediately
    StaticJsonDocument<128> authDoc;
    authDoc["action"] = "auth";
    authDoc["key"] = secret_key;
    webSocket.sendTXT(authJson);
    break;
}
```

**3. Handle Auth Response:**
```cpp
if (doc.containsKey("status")) {
    if (strcmp(status, "success") == 0) {
        isAuthenticated = true;
        Serial.println("[✓ Auth] Autenticado! Iniciando envio de dados...");
    }
}
```

**4. Gate Sensor Data Transmission:**
```cpp
void kirimDataWebSocket(const char* sensor_type, float value) {
    // Only send if authenticated
    if (!isConnected || !isAuthenticated) {
        return;  // Silent return if not ready
    }
    
    // Send sensor data...
}
```

## Use Cases

### ✅ Supported Clients

1. **ESP32 Arduino Device** - Uses manual handshake
2. **Dashboard Web App** - Uses JWT token in URL (immediate auth)
3. **Android WebSocket Tester** - Can connect to IP:Port without parameters

### ❌ What Doesn't Work Anymore

- Direct URL parameters like `?key=0Ly6kU` for devices
  - **Solution:** Use handshake message instead

## Error Handling

### Device Scenarios

| Scenario | Action | Result |
|----------|--------|--------|
| Wrong secret key | Server closes immediately | Error logged, reconnect after 5s |
| No auth message in 3s | Server closes connection | Timeout error, reconnect after 5s |
| Disconnects during data | Connection closes | Auto-reconnect after 5s |
| Sends data while pending | Server ignores | No data saved |

### Dashboard Scenarios

| Scenario | Action | Result |
|----------|--------|--------|
| Invalid JWT | Immediate close | Error logged |
| Device offline | Command queued locally | Displayed as "offline" |
| Device authenticated | Command forwarded | Executed on device |

## Testing Checklist

- [ ] Arduino connects to server
- [ ] Server logs "Pendente - Aguardando autenticação..."
- [ ] Arduino sends auth message
- [ ] Server logs "✓ Autenticado"
- [ ] Arduino sends temp/humidity data
- [ ] Dashboard receives sensor data
- [ ] Dashboard sends toggle command
- [ ] Arduino executes LED toggle
- [ ] Disconnect Arduino, wait 5s
- [ ] Arduino reconnects and authenticates again

## Troubleshooting

### Arduino Never Gets Authenticated

```
Log: [⏳ Device] Pendente - Aguardando autenticação...
```

**Causes:**
- Secret key in Arduino code doesn't match dashboard
- Connection drops too fast (DNS/network issue)
- Server restarted during connection attempt

**Fix:**
1. Verify secret key matches dashboard display
2. Check WiFi signal strength
3. Restart Arduino

### Server Closes Connection Immediately

```
Log: [✗ Device] Secret key inválida: 0Ly6kU
```

**Causes:**
- Wrong secret key sent
- Device copied old key from different device creation
- Server restart before registry populated

**Fix:**
1. Check dashboard for correct secret key
2. Copy new key from latest device creation
3. Verify server is fully started (check logs)

### Dashboard Can't Send Commands

```
Log: [✗ Device] ID X não conectado ou não autenticado
```

**Causes:**
- Device not authenticated yet
- Device crashed/disconnected
- Message format wrong

**Fix:**
1. Check device logs for auth status
2. Manually reconnect device (power off/on)
3. Verify dashboard sends correct JSON format

## Migration Guide (For Existing Devices)

If you're upgrading from the old URL parameter system:

### Before (Old Code)
```cpp
String ws_path = String("/") + "?key=" + String(secret_key);
webSocket.begin(ws_host, ws_port, ws_path.c_str());
```

### After (New Code)
```cpp
webSocket.begin(ws_host, ws_port, "/");

// On connection, send:
// {"action":"auth","key":"0Ly6kU"}
```

## Files Modified

- **index.js** - WebSocket handler with handshake logic
- **ESP32_NOVO_SECRET_KEY.ino** - Arduino code with auth support
- **dashboard.html** - No changes (uses JWT token)

## Future Enhancements

Possible improvements:
- [ ] Session tokens (short-lived auth tokens after handshake)
- [ ] Rate limiting on auth attempts
- [ ] Device capabilities broadcast after auth success
- [ ] Symmetric encryption for secret key transmission
- [ ] Multi-device batching in single handshake
