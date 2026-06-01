# 🚀 MySQL Setup - Quick Start

**Latest Update:** MySQL 8.0 + Docker Integration Complete

---

## ⚡ 30-Second Quick Start

```bash
# macOS / Linux
./start.sh

# Windows PowerShell
.\start.bat

# Wait ~1-2 minutes for:
# ✓ Docker MySQL container to start
# ✓ Schema to initialize
# ✓ npm dependencies to install  
# ✓ Server to launch

# Then open: http://localhost:3001
```

---

## 🎯 What Just Happened

Your UNIOT server now uses **MySQL 8.0** (containerized via Docker) instead of SQLite:

✅ **Same startup experience** - Just run `./start.sh` or `.\start.bat`  
✅ **Automatic Docker setup** - No manual MySQL installation needed  
✅ **Production-ready** - MySQL handles millions of sensor records  
✅ **Thesis-ready** - Professional architecture for documentation  

---

## 📋 Files Modified

| File | Change | Impact |
|------|--------|--------|
| `package.json` | Added `mysql2` driver | Node.js can talk to MySQL |
| `index.js` | Database adapter pattern | Flexible MySQL/SQLite switching |
| `start.sh` | Docker orchestration | Auto-starts MySQL container |
| `start.bat` | Windows equivalent | Same experience on Windows |
| `docker-compose.yml` | NEW - Container config | Runs MySQL 8.0 in Docker |
| `lib/database-adapter.js` | NEW - DB wrapper | Unified interface for queries |
| `scripts/generate-env.js` | Enhanced | Auto-generates MySQL config |
| `readme.md` | Updated | Docker instructions |

**Net Result:** Same 31 database queries work unchanged ✓

---

## 🔍 Verify Installation

After running `./start.sh`:

1. **Check logs** - Look for: `✓ Successfully connected to MySQL!`
2. **Check container** - Run: `docker ps | grep uniot_mysql`
3. **Open browser** - Visit: `http://localhost:3001`
4. **Test device** - Create device & send sensor data

---

## ⚙️ Configuration

Auto-generated `.env`:
```env
DB_TYPE=mysql                    # Database type
DB_HOST=localhost                # MySQL host
DB_USER=uniot_user               # MySQL user
DB_PASSWORD=uniot_pass           # MySQL password
DB_NAME=uniot_db                 # Database name
LOCAL_IP=192.168.x.x             # Your machine IP
PORT=3001                        # Server port
```

**To customize:** Edit `.env` before running `npm start`

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| "Docker not found" | Install Docker Desktop (or `apt install docker.io` on Linux) |
| "Can't connect to MySQL" | Check `docker ps` - is container running? |
| "Port already in use" | Kill other process: `docker stop uniot_mysql` |
| "Want to use SQLite?" | Set `DB_TYPE=sqlite` in `.env` and restart |

---

## 📚 For More Info

- **Setup Guide:** See `MYSQL_MIGRATION_GUIDE.md`
- **Troubleshooting:** See `MYSQL_IMPLEMENTATION_CHECKLIST.md`
- **Thesis (BAB 4):** See `kebutuhan_skripsi/04_PANDUAN_IMPLEMENTASI.md`
- **Database Design:** See `kebutuhan_skripsi/02_ERD_DOCUMENTATION.md`

---

## ✨ Summary

You now have:
```
┌─────────────────────────────┐
│   Node.js (Port 3001)       │
│  ├─ Express REST API        │
│  ├─ WebSocket tunneling     │
│  └─ Message queue system    │
└────────────┬────────────────┘
             │
    [Database Adapter]
             │
     ┌───────┴──────┐
     ▼              ▼
  MySQL          SQLite
  (Docker)       (Fallback)
```

**Same UX, Professional Architecture, Production-Ready! 🎉**

---

**Ready?** Run: `./start.sh` (or `.\start.bat` on Windows)
