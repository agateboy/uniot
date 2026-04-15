# Manual Handshake Authentication - Quick Reference

## What's New

The UNIOT system now supports **Manual Handshake Authentication** for devices that cannot use URL parameters (like Android WebSocket Tester).

## Before vs After

### Before
```
Arduino → ws://server:3001/?key=0Ly6kU
Server validates URL immediately
✓ Simple but URL parameters visible
```

### After  
```
Arduino → ws://server:3001/
Arduino → {"action":"auth","key":"0Ly6kU"}
Server ← {"status":"success","device_id":1}
✓ Flexible, supports restricted clients
```

## Key Changes

| Component | Change | Impact |
|-----------|--------|--------|
| **index.js** | Removed URL validation, added handshake logic | ✅ Complete |
| **Arduino Code** | Changed URL, added auth message, added gateway check | ✅ Complete |
| **Dashboard** | No changes needed (still uses JWT) | ✅ Works as-is |

## Testing Checklist

- [ ] Server starts successfully (`npm start`)
- [ ] Arduino connects to WiFi
- [ ] Arduino sends auth message
- [ ] Server logs "✓ Device Autenticado"
- [ ] Sensor data appears in dashboard
- [ ] Dashboard commands toggle LED on Arduino
- [ ] Disconnect/reconnect works

## Quick Fixes

### Arduino Won't Authenticate
1. Copy exact secret key from dashboard (6 chars)
2. Update `const char* secret_key = "XXXXXX";`
3. Recompile and upload
4. Check serial for "✓ Auth" message

### Server Won't Accept Connection
1. Run `npm start` to start server
2. Check port 3001 is open: `netstat -an | grep 3001`
3. Verify device is sending to correct IP

### Dashboard Has No Data  
1. Device must authenticate first (check Arduino serial)
2. Select device from dropdown in dashboard
3. Wait 2 seconds for data (DHT22 refresh interval)

## Files Changed

- **index.js** - Backend authentication handler
- **ESP32_NOVO_SECRET_KEY.ino** - Arduino with handshake support

## Files Created

- **HANDSHAKE_AUTHENTICATION.md** - Complete protocol specification
- **TESTING_HANDSHAKE.md** - Detailed testing guide
- **HANDSHAKE_TESTING_EXAMPLES.md** - Code examples for testing
- **IMPLEMENTATION_SUMMARY.md** - Updated implementation docs

## Next Steps

1. **Test with Arduino**: Upload new firmware and monitor serial
2. **Test with Web Dashboard**: Create device and send commands  
3. **Test with Android App**: Use WebSocket Tester if available
4. **Review Logs**: Check server logs for auth messages

## Support

- **Need Protocol Details?** → See HANDSHAKE_AUTHENTICATION.md
- **Testing Examples?** → See HANDSHAKE_TESTING_EXAMPLES.md
- **Step-by-Step Guide?** → See TESTING_HANDSHAKE.md
- **Implementation Details?** → See IMPLEMENTATION_SUMMARY.md

---

**Status:** ✅ Complete and ready for testing

**No Breaking Changes:** Dashboard, REST API, and existing devices continue to work
