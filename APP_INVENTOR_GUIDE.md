# Panduan WebSocket untuk App Inventor

## File Updated
- `app-inventor-websocket.html` - HTML upgrade dengan error handling lebih baik

## Protocol Komunikasi

### Format yang Dikirim App Inventor ke Server

**1. Koneksi ke WebSocket:**
```
CONNECT:ws://192.168.0.103:3001?key=YOUR_SECRET_KEY
atau
CONNECT:ws://192.168.0.103:3001?token=YOUR_JWT_TOKEN
```

**2. Mengirim Data Sensor:**
```
SEND:{"var":"suhu","val":25.5}
atau
SEND:{"var":"kelembaban","val":65}
```

**3. Check Status:**
```
STATUS:
```

**4. Clear Log:**
```
CLEAR
```

---

## Format yang Diterima dari Server

### 1. Connection Response
```json
{
  "status": "success",
  "message": "Terauthentikasi sebagai \"Device Name\"",
  "device_id": 2
}
```
App akan terima: `ACK:{...json...}`

### 2. Data Received ACK
```json
{
  "status": "ack",
  "type": "dataReceived",
  "sensor_type": "suhu",
  "value": "25.5",
  "timestamp": "2026-04-19T10:30:45.123Z",
  "message": "Data berhasil diterima"
}
```
App akan terima: `ACK:{...json...}`

### 3. Data Update (dari Device Lain)
```json
{
  "type": "dataUpdate",
  "device_id": 3,
  "device_name": "Arduino_Kamar",
  "sensor_type": "kelembaban",
  "value": "72",
  "timestamp": "2026-04-19T10:30:45.123Z"
}
```
App akan terima: `DATA:{...json...}`

### 4. Error Response
```json
{
  "status": "error",
  "message": "Description of error"
}
```
App akan terima: `ERROR:{...json...}`

---

## Cara Setup di App Inventor

### Block untuk Koneksi
```blocks
- WebViewer: Call WebViewer1.CallJavaScript with arguments:
  Script: window.AppInventor.setWebViewString("CONNECT:ws://IP:3001?key=YOUR_KEY")

- Label untuk akses hasil:
  text = WebViewer1.ConsumeContentFromView()
```

### Block untuk Mengirim Data
```blocks
- TextBox: temperatureValue (value dari sensor)
- Button: Send_Data
  Call WebViewer1.CallJavaScript:
    Script: window.AppInventor.setWebViewString("SEND:"+"{\"var\":\"suhu\",\"val\":"+temperatureValue.Text+"}")

- Menerima ACK:
  WebViewer1.OnPageFinished:
    set label.Text = WebViewer1.ConsumeContentFromView()
```

### Block untuk Terima Data Real-time
```blocks
- Timer: set Interval = 100ms
  Timer1.Timer:
    set receiveData = WebViewer1.ConsumeContentFromView()
    if receiveData ≠ "" then:
      # Parse dan handle pesan
      # JSON:{...} = data dari server
      # ACK:{...} = acknowledge dari server
      # DATA:{...} = update dari device lain
```

---

## Troubleshooting

### Issue: App tidak menerima data dari server
**Solusi:**
1. Pastikan URL WebSocket benar: ws://192.168.0.103:3001?key=SECRET_KEY
2. Pastikan secret_key valid (lihat di database)
3. Check browser console (F12) untuk error messages
4. Pastikan server Node.js running

### Issue: Data yang dikirim tidak tersimpan
**Solusi:**
1. Format JSON harus: `{"var":"sensor_name","val":value}`
2. `val` bisa number atau string, akan otomatis convert
3. Sensor/variabel harus sudah dibuat di dashboard

### Issue: Terima data dari server tapi tidak ke App
**Solusi:**
1. HTML sudah handle berbagai format (ACK, DATA, ERROR, JSON)
2. Setiap pesan ditambah unique timestamp agar App tidak skip
3. Check network tab di DevTools (F12) untuk lihat komunikasi

### Issue: Connection keep dropping
**Solusi:**
1. Ada timeout atau network issue
2. HTML sudah punya error handler dan reconnect delay
3. Pastikan server tidak crash (check console)
4. Coba reduce data send frequency

---

## Contoh Flow

```
1. App Inventor terbuka
   ↓ (Load HTML)
2. User klik "Connect" button
   ↓ (Kirim CONNECT command)
3. WebView JS → setWebViewString("CONNECT:ws://...")
   ↓
4. Server terima koneksi, validate key
   ↓ (Kirim ACK)
5. Server: {"status":"success",...}
   ↓
6. WebView JS terima, parse JSON
   ↓ (Kirim ke App)
7. setWebViewString("ACK:{"status":"success",...}|T:1234567890")
   ↓
8. App call ConsumeContentFromView() dapat hasil
   ↓
9. Label update menampilkan "Connected!"

10. User berubah sensor value
    ↓ (Kirim SEND)
11. WebView JS → ws.send('{"var":"suhu","val":25.5}')
    ↓
12. Server terima, update database & broadcast
    ↓ (Kirim ACK)
13. Server: {"status":"ack","sensor_type":"suhu",...}
    ↓
14. WebView JS terima & forward
    ↓ (Kirim ke App)
15. setWebViewString("ACK:{"status":"ack",...}|T:1234567890")
    ↓
16. App update UI "Data sent!"

17. Device lain mengirim data yang sama
    ↓
18. Server broadcast ke semua device
    ↓ (Kirim UPDATE)
19. Server: {"type":"dataUpdate","sensor_type":"suhu","value":"25.8"}
    ↓
20. WebView JS terima & forward
    ↓ (Kirim ke App)
21. setWebViewString("DATA:{"type":"dataUpdate",...}|T:1234567890")
    ↓
22. App dapat notifikasi data berubah dari device lain
```

---

## Testing dengan Postman/cURL

```bash
# 1. Test WebSocket connection
wscat -c "ws://192.168.0.103:3001?key=YOUR_SECRET_KEY"

# 2. Kirim data dari terminal
{ "var": "suhu", "val": 28.5 }

# 3. Harusnya dapat ACK dari server:
{ "status": "ack", "type": "dataReceived", ... }
```

---

## File HTML Updated
- **Location**: `/uniot/app-inventor-websocket.html`
- **Features**:
  - ✓ Better error handling
  - ✓ Connection status tracking
  - ✓ Multiple message types support
  - ✓ Unique timestamp untuk setiap pesan
  - ✓ Colored log untuk debugging
  - ✓ Auto timestamp di setiap log entry
  - ✓ Limit 100 log entries terbaru
