# Manual Handshake - Testing Examples

Quick test scripts without Arduino hardware.

## 1. cURL (Bash)

### Test Regular HTTP Connection
```bash
# Get device list
curl http://localhost:3000/api/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create device
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"device_name":"TestDevice"}'
```

---

## 2. Node.js Script

### Simple Test Client

Create `ws-test.js`:

```javascript
const WebSocket = require('ws');

// ==========================================
const WS_URL = 'ws://localhost:3001/';
const SECRET_KEY = '0Ly6kU';  // Change to your device key
// ==========================================

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('[✓] Connected to server');
    console.log('[⏳] Sending auth message...');
    
    // Send authentication
    const authMessage = {
        action: 'auth',
        key: SECRET_KEY
    };
    
    ws.send(JSON.stringify(authMessage));
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data);
        console.log('[📨] Received:', JSON.stringify(msg, null, 2));
        
        // If authentication successful, start sending data
        if (msg.status === 'success') {
            console.log('\n[✓ Auth] Authenticated! Starting to send data...\n');
            
            // Send sensor data every 2 seconds
            setInterval(() => {
                const sensorData = {
                    sensor_type: 'suhu',
                    value: 20 + Math.random() * 10  // Random temp 20-30°C
                };
                ws.send(JSON.stringify(sensorData));
                console.log('[📤] Sent:', sensorData);
            }, 2000);
        }
    } catch (error) {
        console.error('[❌] Parse error:', error.message);
    }
});

ws.on('error', (error) => {
    console.error('[❌] WebSocket error:', error.message);
});

ws.on('close', () => {
    console.log('[⚠️ ] Connection closed');
    process.exit(0);
});

// Test: After 10 seconds, close
setTimeout(() => {
    console.log('\n[✓] Closing connection...');
    ws.close();
}, 10000);
```

### Run Test
```bash
npm install ws  # Install WebSocket library
node ws-test.js

# Expected output:
# [✓] Connected to server
# [⏳] Sending auth message...
# [📨] Received: {
#   "status": "success",
#   "message": "Autenticado como \"Device Name\"",
#   "device_id": 1
# }
# [✓ Auth] Authenticated! Starting to send data...
# [📤] Sent: { sensor_type: 'suhu', value: 27.3 }
```

---

## 3. Python Script

### Simple Auth Check

Create `test_handshake.py`:

```python
import websocket
import json
import time
import threading

# ==========================================
WS_URL = 'ws://localhost:3001/'
SECRET_KEY = '0Ly6kU'
# ==========================================

class WebSocketClient:
    def __init__(self, url, secret_key):
        self.url = url
        self.secret_key = secret_key
        self.ws = None
        self.authenticated = False
    
    def on_open(self, ws):
        print('[✓] Connected to server')
        print('[⏳] Sending authentication...')
        
        auth_msg = {
            'action': 'auth',
            'key': self.secret_key
        }
        ws.send(json.dumps(auth_msg))
    
    def on_message(self, ws, message):
        try:
            data = json.loads(message)
            print(f'[📨] Received: {json.dumps(data, indent=2)}')
            
            if data.get('status') == 'success':
                self.authenticated = True
                print('\n[✓ Auth] Authentication successful!\n')
                self.send_sensor_data()
        except json.JSONDecodeError as e:
            print(f'[❌] JSON Error: {e}')
    
    def on_error(self, ws, error):
        print(f'[❌] Error: {error}')
    
    def on_close(self, ws, close_status_code, close_msg):
        print('[⚠️ ] Connection closed')
    
    def send_sensor_data(self):
        def send():
            for i in range(5):
                if self.authenticated:
                    sensor_data = {
                        'sensor_type': 'suhu',
                        'value': 20 + i
                    }
                    self.ws.send(json.dumps(sensor_data))
                    print(f'[📤] Sent: {sensor_data}')
                    time.sleep(2)
            self.ws.close()
        
        thread = threading.Thread(target=send)
        thread.start()
    
    def connect(self):
        self.ws = websocket.WebSocketApp(
            self.url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        self.ws.run_forever()

if __name__ == '__main__':
    client = WebSocketClient(WS_URL, SECRET_KEY)
    client.connect()
```

### Run Test
```bash
pip install websocket-client
python test_handshake.py
```

---

## 4. Browser Console (JavaScript)

Open browser DevTools (F12) and paste:

```javascript
// Connect to test device (not dashboard)
const ws = new WebSocket('ws://localhost:3001/');
let authenticated = false;

ws.onopen = () => {
    console.log('[✓] Connected');
    ws.send(JSON.stringify({
        action: 'auth',
        key: '0Ly6kU'  // Change to your key
    }));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('[📨]', data);
    
    if (data.status === 'success') {
        authenticated = true;
        console.log('[✓] Authenticated!');
        
        // Send test data
        setInterval(() => {
            ws.send(JSON.stringify({
                sensor_type: 'test',
                value: Math.random() * 100
            }));
        }, 1000);
    }
};

ws.onerror = (err) => console.error('[❌]', err);
ws.onclose = () => console.log('[⚠️ ] Closed');

// Close after 30 seconds
setTimeout(() => ws.close(), 30000);
```

---

## 5. telnet (Basic Connection Test)

Test if server accepts connections:

```bash
# On macOS/Linux
nc -zv localhost 3001
# Output: succeeded in 25 ms

# Or using telnet
telnet localhost 3001
# Once connected, type raw JSON:
# {"action":"auth","key":"0Ly6kU"}
```

---

## 6. Automated Test Suite

Create `test-all.sh`:

```bash
#!/bin/bash

echo "=========================================="
echo "   Manual Handshake Test Suite"
echo "=========================================="

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Server is running
echo -e "\n${YELLOW}Test 1: Check if server is running${NC}"
if nc -z localhost 3001 2>/dev/null; then
    echo -e "${GREEN}✓ Server is running on port 3001${NC}"
else
    echo -e "${RED}✗ Server is NOT running${NC}"
    exit 1
fi

# Test 2: Database is accessible
echo -e "\n${YELLOW}Test 2: Check database${NC}"
if [ -f "database.sqlite" ]; then
    echo -e "${GREEN}✓ Database file exists${NC}"
else
    echo -e "${RED}✗ Database file missing${NC}"
fi

# Test 3: Secret key registry loaded
echo -e "\n${YELLOW}Test 3: Check server logs for registry${NC}"
echo "Copy this command and check for '[✓ Registry] Carregado':"
echo "cat $VSCODE_TARGET_SESSION_LOG 2>/dev/null | grep Registry"

# Test 4: Run Node.js test
echo -e "\n${YELLOW}Test 4: Run Node.js WebSocket client${NC}"
if [ -f "ws-test.js" ]; then
    echo -e "${GREEN}✓ Test script found${NC}"
    echo "Run with: node ws-test.js"
else
    echo -e "${YELLOW}! Test script not found, creating...${NC}"
    cat > ws-test.js << 'EOF'
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3001/');

ws.on('open', () => {
    console.log('[✓] Connected');
    ws.send(JSON.stringify({action:'auth',key:'0Ly6kU'}));
});

ws.on('message', (data) => {
    console.log('[📨]', JSON.parse(data));
    ws.close();
});

ws.on('error', (err) => console.error('[❌]', err.message));
EOF
    echo "Created ws-test.js - run with: npm install ws && node ws-test.js"
fi

echo -e "\n${GREEN}=========================================="
echo "Tests complete!"
echo "==========================================${NC}"
```

### Run Tests
```bash
chmod +x test-all.sh
./test-all.sh
```

---

## 7. Docker Container Test

If running in Docker:

```bash
# Test from host machine
docker exec -it uniot_server npm run test:websocket

# Or manual test
docker logs uniot_server | tail -50  # View logs
docker exec -it uniot_server node ws-test.js
```

---

## 8. Load Testing

Create `load-test.js` (multiple simultaneous connections):

```javascript
const WebSocket = require('ws');

const NUM_CLIENTS = 5;
const WS_URL = 'ws://localhost:3001/';
const SECRET_KEY = '0Ly6kU';

let authenticated = 0;
let messageCount = 0;

function createClient(id) {
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
        console.log(`[Client ${id}] Connected`);
        ws.send(JSON.stringify({
            action: 'auth',
            key: SECRET_KEY
        }));
    });
    
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.status === 'success') {
            authenticated++;
            console.log(`[Client ${id}] Authenticated (${authenticated}/${NUM_CLIENTS})`);
            
            // Start sending data
            setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        sensor_type: `sensor_${id}`,
                        value: Math.random() * 100
                    }));
                    messageCount++;
                }
            }, Math.random() * 1000 + 500);  // Random interval
        }
    });
    
    ws.on('error', (err) => {
        console.log(`[Client ${id}] Error:`, err.message);
    });
}

// Create multiple clients
console.log(`Creating ${NUM_CLIENTS} test clients...`);
for (let i = 1; i <= NUM_CLIENTS; i++) {
    setTimeout(() => createClient(i), i * 100);  // Stagger connections
}

// Report every 5 seconds
setInterval(() => {
    console.log(`\n[Status] Authenticated: ${authenticated}/${NUM_CLIENTS}, Messages: ${messageCount}`);
}, 5000);

// Stop after 30 seconds
setTimeout(() => {
    console.log('\nTest complete');
    process.exit(0);
}, 30000);
```

### Run Load Test
```bash
node load-test.js
```

---

## Troubleshooting Test Scripts

### "Cannot find module 'ws'"
```bash
npm install ws --save-dev
```

### "Connection refused on port 3001"
```bash
# Make sure server is running
cd /home/agate/Documents/uniot
npm start
```

### "Secret key invalid"
1. Check key matches a real device: `sqlite3 database.sqlite "SELECT * FROM devices;"`
2. Create new device from dashboard and copy the key
3. Update `SECRET_KEY` variable

### "Message appears to arrive but is ignored"
1. Server expects JSON exactly: `{"action":"auth","key":"XXXXXX"}`
2. No extra fields or whitespace
3. Verify `authStatus === 'pending'` before first message

---

## Verify Success Criteria

Test passes if you see:

✅ Connection established
✅ Auth message sent
✅ Success response received with device_id
✅ Sensor data accepted by server
✅ Dashboard shows data from device
✅ Commands from dashboard execute on device
✅ Auto-reconnect works when connection drops
