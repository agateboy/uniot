# 🎯 QUICK REFERENCE - ERD UNIOT Ringkas

Panduan cepat struktur database UNIOT untuk reference cepat.

---

## 📊 7 Tabel Utama

### 1. USERS (Manajemen Pengguna)
```
┌──────────────────────────────┐
│         USERS                │
├──────────────────────────────┤
│ user_id (PK, INT)            │
│ username (VARCHAR, UNIQUE)   │
│ email (VARCHAR, UNIQUE)      │
│ password_hash (VARCHAR)      │
│ created_at, updated_at       │
└──────────────────────────────┘
```
**Purpose:** Login & user management  
**Relasi:** 1:N ke devices, widgets, logs  
**Key Query:** `SELECT * FROM users WHERE username = ?`

---

### 2. DEVICES (Perangkat IoT)
```
┌──────────────────────────────┐
│       DEVICES                │
├──────────────────────────────┤
│ device_id (PK, INT)          │
│ user_id (FK) → users         │
│ device_name (VARCHAR)        │
│ api_key, secret_key (UNIQUE) │
│ public_slug (UNIQUE)         │
│ device_type (ENUM)           │
│ status (ENUM)                │
│ location (VARCHAR)           │
│ created_at, updated_at       │
└──────────────────────────────┘
```
**Purpose:** Register & manage IoT devices  
**Relasi:** N:1 ke users, 1:N ke widgets/sensor_data  
**Key Query:** `SELECT * FROM devices WHERE user_id = ?`

---

### 3. WIDGETS (Dashboard Components)
```
┌──────────────────────────────┐
│       WIDGETS                │
├──────────────────────────────┤
│ widget_id (PK, INT)          │
│ user_id (FK) → users         │
│ device_id (FK) → devices     │
│ sensor_type (VARCHAR)        │
│ widget_type (ENUM)           │
│  - number, toggle, slider    │
│  - gauge, chart              │
│ data_type (ENUM)             │
│  - float, integer, boolean   │
│ current_value (VARCHAR)      │
│ min_value, max_value (FLOAT) │
│ unit (VARCHAR)               │
│ created_at, updated_at       │
└──────────────────────────────┘
```
**Purpose:** Configure dashboard display  
**Type Options:**
- `number`: Show numeric value (25.5°C)
- `toggle`: ON/OFF switch (true/false)
- `slider`: PWM control (0-255)
- `gauge`: Speedometer display
- `chart`: Time-series graph

**Key Query:**
```sql
SELECT * FROM widgets 
WHERE user_id = ? 
ORDER BY device_id;
```

---

### 4. SENSOR_DATA (Time Series - CRITICAL)
```
┌──────────────────────────────┐
│     SENSOR_DATA (⭐LARGEST)   │
├──────────────────────────────┤
│ data_id (PK, BIGINT)         │
│ device_id (FK) → devices     │
│ sensor_type (VARCHAR)        │
│ value (VARCHAR)              │
│ timestamp (DATETIME, INDEX)  │
│                              │
│ INDEX: device_id + timestamp │
│        sensor_type + timestamp
└──────────────────────────────┘
```
**Purpose:** Store all sensor readings  
**Volume:** Millions of records over time  
**Optimization:** Batch insert every 2 seconds  

**Key Query:**
```sql
SELECT * FROM sensor_data
WHERE device_id = ? 
  AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY timestamp DESC;
```

---

### 5. ALERTS (Notification System)
```
┌──────────────────────────────┐
│        ALERTS                │
├──────────────────────────────┤
│ alert_id (PK, INT)           │
│ device_id (FK) → devices     │
│ sensor_type (VARCHAR)        │
│ condition (VARCHAR)          │
│  - >, <, =, !=, >=, <=       │
│ threshold (FLOAT)            │
│ is_active (BOOLEAN)          │
│ created_at, updated_at       │
└──────────────────────────────┘
```
**Purpose:** Configure notifications  
**Example:** 
- If temperature > 30 → Alert!
- If humidity < 20 → Alert!

**Key Query:**
```sql
SELECT * FROM alerts 
WHERE device_id = ? 
  AND is_active = TRUE;
```

---

### 6. ACTIVITY_LOGS (Audit Trail)
```
┌──────────────────────────────┐
│     ACTIVITY_LOGS            │
├──────────────────────────────┤
│ log_id (PK, BIGINT)          │
│ user_id (FK) → users         │
│ action (VARCHAR)             │
│ details (JSON)               │
│ ip_address (VARCHAR)         │
│ timestamp (DATETIME)         │
└──────────────────────────────┘
```
**Purpose:** Track user actions (security)  
**Data Example:**
```json
{
  "user_id": 1,
  "action": "send_command",
  "details": {"device_id": 5, "command": "ON"},
  "ip_address": "192.168.1.100",
  "timestamp": "2026-05-31 10:15:00"
}
```

**Key Query:**
```sql
SELECT * FROM activity_logs
WHERE user_id = ? 
  AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY timestamp DESC;
```

---

### 7. CONTROL_COMMANDS (Actuator Control)
```
┌──────────────────────────────┐
│    CONTROL_COMMANDS          │
├──────────────────────────────┤
│ command_id (PK, BIGINT)      │
│ device_id (FK) → devices     │
│ user_id (FK) → users         │
│ sensor_type (VARCHAR)        │
│ command_value (VARCHAR)      │
│ status (ENUM)                │
│  - pending, sent, executed   │
│  - failed                    │
│ created_at, executed_at      │
└──────────────────────────────┘
```
**Purpose:** Send commands to actuators (relay, pump, etc)  
**Command Examples:**
- Relay: `ON`, `OFF`
- PWM: `PWM:150` (0-255)
- Servo: `90` (degrees)

**Key Query:**
```sql
SELECT * FROM control_commands 
WHERE device_id = ? 
  AND status = 'pending';
```

---

## 🔗 Relasi Visual

```
                    ┌──────────────────┐
                    │     USERS        │
                    └────────┬─────────┘
                             │ 1:N
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
         ┌────────────┐ ┌─────────┐ ┌─────────────┐
         │  DEVICES   │ │ WIDGETS │ │ ACTIVITY_  │
         ├────────────┤ ├─────────┤ │ LOGS       │
         │ device_id  │ │widget_id│ ├─────────────┤
         │ user_id(FK)│ │user_id  │ │ log_id      │
         │ device_name│ │device_id│ │ user_id(FK) │
         │ api_key    │ │...      │ │ action      │
         └─────┬──────┘ └─────────┘ └─────────────┘
               │ 1:N
               │
      ┌────────┴──────────┬───────────────┐
      ▼                   ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ SENSOR_DATA  │ │   ALERTS     │ │   CONTROL_   │
├──────────────┤ ├──────────────┤ │  COMMANDS    │
│ data_id (PK) │ │ alert_id (PK)│ ├──────────────┤
│ device_id(FK)│ │device_id(FK) │ │command_id(PK)│
│ sensor_type  │ │ condition    │ │device_id(FK) │
│ value        │ │ threshold    │ │user_id(FK)   │
│ timestamp    │ │ is_active    │ │ command_value│
└──────────────┘ └──────────────┘ │ status       │
                                   └──────────────┘
```

---

## 📈 Data Volume Reference

Untuk skripsi dengan data simulasi:

| Tabel | Sample Count | Size (MB) |
|-------|-------------|-----------|
| users | 10 | < 0.1 |
| devices | 30 | < 0.1 |
| widgets | 100 | < 0.1 |
| sensor_data | 100,000 | ~10 |
| alerts | 50 | < 0.1 |
| activity_logs | 1,000 | < 0.1 |
| control_commands | 500 | < 0.1 |
| **TOTAL** | | ~10 MB |

Dengan 1 juta sensor records: ~100 MB  
Dengan 10 juta sensor records: ~1 GB

---

## 🚀 Most Used Queries

### Query 1: Get Latest Sensor Values
```sql
-- Apa nilai terkini sensor?
SELECT d.device_name, sd.sensor_type, sd.value, sd.timestamp
FROM sensor_data sd
INNER JOIN devices d ON sd.device_id = d.device_id
WHERE sd.timestamp = (SELECT MAX(timestamp) FROM sensor_data);
```

### Query 2: Hourly Average Data
```sql
-- Berapa rata-rata suhu per jam?
SELECT 
  DATE_FORMAT(timestamp, '%H:00') AS hour,
  AVG(CAST(value AS DECIMAL)) AS avg_temp
FROM sensor_data
WHERE sensor_type = 'temperature'
  AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY hour;
```

### Query 3: User Statistics
```sql
-- Dashboard user summary
SELECT 
  u.username,
  COUNT(d.device_id) AS total_devices,
  COUNT(sd.data_id) AS total_readings,
  MAX(sd.timestamp) AS last_update
FROM users u
LEFT JOIN devices d ON u.user_id = d.user_id
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id
WHERE u.user_id = ?
GROUP BY u.user_id;
```

### Query 4: Alert Detection
```sql
-- Data yang exceed threshold
SELECT d.device_name, sd.sensor_type, sd.value, a.threshold
FROM sensor_data sd
INNER JOIN devices d ON sd.device_id = d.device_id
INNER JOIN alerts a ON d.device_id = a.device_id 
  AND sd.sensor_type = a.sensor_type
WHERE CAST(sd.value AS DECIMAL) > a.threshold
  AND sd.timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

### Query 5: Command Status
```sql
-- Perintah yang pending execution
SELECT cc.command_id, d.device_name, cc.sensor_type, 
       cc.command_value, cc.created_at
FROM control_commands cc
INNER JOIN devices d ON cc.device_id = d.device_id
WHERE cc.status = 'pending'
ORDER BY cc.created_at ASC;
```

---

## ⚡ Performance Tips

### Do's ✓
```sql
✓ SELECT specific columns (not *)
SELECT device_id, sensor_type, value FROM sensor_data;

✓ Use WHERE clause
SELECT * FROM sensor_data WHERE device_id = 1;

✓ Batch operations
INSERT INTO widgets VALUES (...), (...), (...);

✓ Use LIMIT
SELECT * FROM sensor_data LIMIT 100;
```

### Don'ts ✗
```sql
✗ SELECT *
SELECT * FROM sensor_data;

✗ No WHERE clause
SELECT * FROM sensor_data;

✗ Single operations loop
for (i=0; i<100; i++) { INSERT ... }

✗ Unlimited results
SELECT * FROM sensor_data;
```

---

## 📋 Enum Values Reference

### device_type
- `sensor` - Read-only sensor
- `actuator` - Controllable device
- `hybrid` - Both sensor & actuator

### device status
- `active` - Device working normally
- `inactive` - Device offline/disabled
- `maintenance` - Under maintenance

### widget_type
- `number` - Numeric display
- `toggle` - Boolean switch
- `slider` - PWM/range control
- `gauge` - Analog gauge display
- `chart` - Time-series graph

### data_type
- `float` - Decimal number (25.5)
- `integer` - Whole number (25)
- `boolean` - True/False
- `string` - Text value

### alert condition
- `>` - Greater than
- `<` - Less than
- `=` - Equal
- `!=` - Not equal
- `>=` - Greater or equal
- `<=` - Less or equal

### command status
- `pending` - Waiting to send
- `sent` - Sent to device
- `executed` - Device confirmed
- `failed` - Execution failed

---

## 🔑 Key Constraints

| Constraint | Tabel | Kolom | Alasan |
|-----------|-------|-------|--------|
| UNIQUE | users | username | Prevent duplicate login |
| UNIQUE | users | email | Prevent duplicate email |
| UNIQUE | devices | api_key | Security - unique per device |
| UNIQUE | devices | secret_key | Security - unique per device |
| UNIQUE | devices | public_slug | URL must be unique |
| FOREIGN KEY | devices | user_id | Link to owner |
| FOREIGN KEY | widgets | device_id | Link to device |
| FOREIGN KEY | control_commands | device_id | Link to target |
| NOT NULL | All tables | Most fields | Ensure data quality |
| CASCADE DELETE | All FK | ON DELETE | Auto-cleanup when parent deleted |

---

## 💾 Database Size Estimation

**Empty schema:** ~5 MB

**Growth per day (with 5 sensors, 1 reading/min each):**
```
5 sensors × 60 readings/hour × 24 hours = 7,200 readings/day
7,200 readings × 200 bytes/record = 1.4 MB/day
≈ 50 MB/month
≈ 600 MB/year
```

**So untuk 1 tahun data:**
- 5 sensors: ~600 MB
- 20 sensors: ~2.4 GB
- 100 sensors: ~12 GB

---

## 📂 File Locations

| File | Location | Purpose |
|------|----------|---------|
| Database file | `/var/lib/mysql/` | MySQL data storage |
| Schema SQL | `01_schema_mysql.sql` | Create tables |
| Backup | `backup_2026_05_31.sql` | Restore point |
| Error log | `/var/log/mysql/error.log` | Debug errors |
| Slow log | `/var/log/mysql/slow.log` | Performance analysis |

---

## 🎓 For Your Thesis

**In BAB 3 (Design):**
- ✓ Copy table definitions from here
- ✓ Include relasi diagram
- ✓ Explain why each field needed

**In BAB 4 (Implementation):**
- ✓ Include SQL script (01_schema_mysql.sql)
- ✓ Show DESCRIBE output
- ✓ Explain indexes

**In BAB 5 (Performance):**
- ✓ Show EXPLAIN analysis
- ✓ Before/after optimization
- ✓ Query execution time metrics

---

**Last Updated:** 31 Mei 2026  
**Version:** 1.0  
**Status:** Ready to Use ✓
