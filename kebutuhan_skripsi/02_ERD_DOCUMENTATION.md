# ERD (Entity Relationship Diagram) - Platform UNIOT
## Dokumentasi Schema Database MySQL

**Tanggal:** 31 Mei 2026  
**Platform:** IoT Monitoring Dashboard (UNIOT)  
**Database System:** MySQL 5.7+  
**Normalization Level:** 3NF (Third Normal Form)

---

## 📊 Diagram Relasi Antar Tabel

```
┌──────────────────────┐
│       USERS          │
│ (User Management)    │
├──────────────────────┤
│ user_id (PK)         │
│ username (UNIQUE)    │
│ email (UNIQUE)       │◄──────────┐
│ password_hash        │           │
│ created_at           │           │
│ updated_at           │           │
└──────────────────────┘           │ 1:N
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│      DEVICES         │  │     WIDGETS          │  │  ACTIVITY_LOGS       │
│(IoT Devices)         │  │ (Components).        │  │ (Audit Trail)        │
├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ device_id (PK)       │  │ widget_id (PK)       │  │ log_id (PK)          │
│ user_id (FK)◄────────|──┤ user_id (FK)◄────────┼──┤ user_id (FK)         │
│ device_name          │  │ device_id (FK)───┐   │  │ action               │
│ api_key (UNIQUE)     │  │ sensor_type      │   │  │ details (JSON)       │
│ secret_key (UNIQUE)  │  │ widget_type      │   │  │ ip_address           │
│ public_slug (UNIQUE) │  │ data_type        │   │  │ timestamp            │
│ device_type          │  │ current_value    │   │  └──────────────────────┘
│ status               │  │ min_value        │   │
│ location             │  │ max_value        │   │
│ created_at           │  │ unit             │   │
│ updated_at           │  │ created_at       │   │
└──────────────────────┘  │ updated_at       │   │
        │                 └──────────────────┼───┘
        │ 1:N                                │
        └────────────────┬───────────────────┘
                         │
                    ┌────▼────────────────────┐
                    │                         │
                    ▼                         ▼
        ┌──────────────────────┐  ┌──────────────────────┐
        │   SENSOR_DATA        │  │      ALERTS          │
        │ (Time Series Data)   │  │ (Notifikasi)         │
        ├──────────────────────┤  ├──────────────────────┤
        │ data_id (PK)         │  │ alert_id (PK)        │
        │ device_id (FK)       │  │ device_id (FK)       │
        │ sensor_type          │  │ sensor_type          │
        │ value                │  │ condition            │
        │ timestamp (IDX)      │  │ threshold            │
        └──────────────────────┘  │ is_active            │
                                  │ created_at           │
                                  │ updated_at           │
                                  └──────────────────────┘

        ┌──────────────────────┐
        │ CONTROL_COMMANDS     │
        │ (Perintah Aktuator)  │
        ├──────────────────────┤
        │ command_id (PK)      │
        │ device_id (FK)       │◄─ dari DEVICES
        │ user_id (FK)         │◄─ dari USERS
        │ sensor_type          │
        │ command_value        │
        │ status               │
        │ created_at           │
        │ executed_at          │
        └──────────────────────┘
```

---

## 📋 Detail Tabel (7 Tabel Utama)

### 1️⃣ USERS - Manajemen Pengguna

| Kolom | Tipe | Constraint | Keterangan |
|-------|------|-----------|-----------|
| **user_id** | INT | PK, AUTO_INCREMENT | ID unik pengguna |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Nama login pengguna |
| email | VARCHAR(100) | UNIQUE, NOT NULL | Email pengguna |
| password_hash | VARCHAR(255) | NOT NULL | Password ter-hash (bcrypt) |
| created_at | TIMESTAMP | DEFAULT NOW | Waktu akun dibuat |
| updated_at | TIMESTAMP | ON UPDATE NOW | Update terakhir |

**Index:**
- `idx_username` - untuk login cepat
- `idx_email` - untuk pencarian email

**Relasi:**
- 1:N ke DEVICES (satu user punya banyak device)
- 1:N ke WIDGETS (satu user punya banyak widget)
- 1:N ke ACTIVITY_LOGS (tracking semua aksi user)
- 1:N ke CONTROL_COMMANDS (user mengirim perintah)

---

### 2️⃣ DEVICES - Manajemen Perangkat IoT

| Kolom | Tipe | Constraint | Keterangan |
|-------|------|-----------|-----------|
| **device_id** | INT | PK, AUTO_INCREMENT | ID unik device |
| user_id | INT | FK, NOT NULL | Pemilik device |
| device_name | VARCHAR(100) | NOT NULL | Nama device (misal: "Sensor Ruang 1") |
| api_key | VARCHAR(255) | UNIQUE, NOT NULL | Key untuk REST API |
| secret_key | VARCHAR(255) | UNIQUE, NOT NULL | Key untuk WebSocket |
| public_slug | VARCHAR(100) | UNIQUE | Custom URL publik (misal: "kebunku") |
| device_type | ENUM | DEFAULT 'hybrid' | Tipe: sensor / actuator / hybrid |
| status | ENUM | DEFAULT 'active' | Status: active / inactive / maintenance |
| location | VARCHAR(255) | - | Lokasi fisik perangkat |
| created_at | TIMESTAMP | DEFAULT NOW | Waktu device terdaftar |
| updated_at | TIMESTAMP | ON UPDATE NOW | Update terakhir |

**Index:**
- `idx_user_id` - filter device per user
- `idx_slug` - lookup cepat public view
- `idx_status` - filter device aktif

**Relasi:**
- N:1 ke USERS (many devices per one user)
- 1:N ke WIDGETS (satu device banyak widget)
- 1:N ke SENSOR_DATA (banyak data per device)
- 1:N ke ALERTS (banyak alert per device)
- 1:N ke CONTROL_COMMANDS (banyak perintah per device)

---

### 3️⃣ WIDGETS - Komponen Dashboard

| Kolom | Tipe | Constraint | Keterangan |
|-------|------|-----------|-----------|
| **widget_id** | INT | PK, AUTO_INCREMENT | ID unik widget |
| user_id | INT | FK, NOT NULL | Pemilik widget |
| device_id | INT | FK, NOT NULL | Device yang dipantau |
| sensor_type | VARCHAR(100) | NOT NULL | Tipe sensor (misal: "temperature", "humidity") |
| widget_type | ENUM | NOT NULL | Tipe tampilan: number / toggle / slider / gauge / chart |
| data_type | ENUM | NOT NULL | Tipe data: float / integer / boolean / string |
| current_value | VARCHAR(255) | - | Nilai terkini (cached dari sensor_data terakhir) |
| min_value | FLOAT | - | Nilai minimum untuk validasi/display |
| max_value | FLOAT | - | Nilai maksimum untuk validasi/display |
| unit | VARCHAR(50) | - | Satuan pengukuran (misal: "°C", "%", "mL/min") |
| created_at | TIMESTAMP | DEFAULT NOW | Waktu widget dibuat |
| updated_at | TIMESTAMP | ON UPDATE NOW | Update terakhir |

**Index:**
- `idx_device_id` - filter widget per device
- `idx_user_id` - filter widget per user
- `idx_sensor_type` - lookup cepat tipe sensor

**Relasi:**
- N:1 ke USERS (many widgets per one user)
- N:1 ke DEVICES (many widgets per one device)
- Data ditampilkan dari tabel SENSOR_DATA

**Widget Type Guide:**
- `number`: Menampilkan angka (misal: 25.5°C)
- `toggle`: Saklar ON/OFF (misal: relay)
- `slider`: Penggeser PWM (misal: brightness 0-255)
- `gauge`: Jarum speedometer (misal: 0-100%)
- `chart`: Grafik historis

---

### 4️⃣ SENSOR_DATA - Data Sensor Time Series

| Kolom | Tipe | Constraint | Keterangan |
|-------|------|-----------|-----------|
| **data_id** | BIGINT | PK, AUTO_INCREMENT | ID unik data point |
| device_id | INT | FK, NOT NULL | Device sumber data |
| sensor_type | VARCHAR(100) | NOT NULL | Tipe sensor |
| value | VARCHAR(255) | NOT NULL | Nilai sensor (disimpan string untuk fleksibilitas) |
| timestamp | DATETIME | DEFAULT NOW, IDX | Waktu data diterima |

**Index:**
- `idx_device_time` - query cepat data by device + waktu → **KRITIS**
- `idx_sensor_time` - query cepat data by sensor type + waktu
- `idx_timestamp` - query cepat data historis

**Relasi:**
- N:1 ke DEVICES (many data points per one device)

**Catatan Performa:**
- Tabel ini akan paling besar (jutaan record)
- Pertimbangkan partitioning by bulan untuk dataset besar
- Sample query: `SELECT value FROM sensor_data WHERE device_id=1 AND timestamp >= NOW()-INTERVAL 7 DAY ORDER BY timestamp DESC;`

---

### 5️⃣ ALERTS - Sistem Notifikasi

| Kolom | Tipe | Constraint | Keterangan |
|-------|------|-----------|-----------|
| **alert_id** | INT | PK, AUTO_INCREMENT | ID unik alert |
| device_id | INT | FK, NOT NULL | Device yang dipantau |
| sensor_type | VARCHAR(100) | - | Tipe sensor untuk alert (misal: "temperature") |
| condition | VARCHAR(50) | - | Kondisi: >, <, ==, !=, >=, <= |
| threshold | FLOAT | - | Nilai ambang (misal: 30 untuk "temperature > 30") |
| is_active | BOOLEAN | DEFAULT TRUE | Status alert aktif/nonaktif |
| created_at | TIMESTAMP | DEFAULT NOW | Waktu alert dibuat |
| updated_at | TIMESTAMP | ON UPDATE NOW | Update terakhir |

**Index:**
- `idx_device_id` - filter alert per device
- `idx_active` - filter alert yang aktif

**Relasi:**
- N:1 ke DEVICES (many alerts per one device)

**Contoh Konfigurasi Alert:**
```
Jika suhu (temperature) > 35°C → kirim notifikasi
Jika kelembaban (humidity) < 20% → kirim notifikasi
```

---

### 6️⃣ ACTIVITY_LOGS - Audit Trail

| Kolom | Tipe | Constraint | Keterangan |
|-------|------|-----------|-----------|
| **log_id** | BIGINT | PK, AUTO_INCREMENT | ID unik log |
| user_id | INT | FK, NOT NULL | User yang melakukan aksi |
| action | VARCHAR(255) | NOT NULL | Jenis aksi (misal: "login", "update_device") |
| details | JSON | - | Detail tambahan dalam format JSON |
| ip_address | VARCHAR(45) | - | IP address pengguna |
| timestamp | DATETIME | DEFAULT NOW, IDX | Waktu aksi terjadi |

**Index:**
- `idx_user_time` - query cepat aksi per user + waktu
- `idx_action` - filter aksi tertentu
- `idx_timestamp` - query cepat log historis

**Relasi:**
- N:1 ke USERS (many logs per one user)

**Contoh Logging:**
```json
{
  "user_id": 5,
  "action": "update_device",
  "details": {
    "device_id": 10,
    "old_name": "Sensor Lama",
    "new_name": "Sensor Baru",
    "timestamp": "2026-05-31T10:15:00Z"
  },
  "ip_address": "192.168.1.100"
}
```

---

### 7️⃣ CONTROL_COMMANDS - Perintah Kontrol Aktuator

| Kolom | Tipe | Constraint | Keterangan |
|-------|------|-----------|-----------|
| **command_id** | BIGINT | PK, AUTO_INCREMENT | ID unik perintah |
| device_id | INT | FK, NOT NULL | Device target |
| user_id | INT | FK, NOT NULL | User yang mengirim perintah |
| sensor_type | VARCHAR(100) | NOT NULL | Aktuator target (misal: "relay1", "pump") |
| command_value | VARCHAR(255) | NOT NULL | Nilai/perintah (misal: "ON", "OFF", "PWM:150") |
| status | ENUM | DEFAULT 'pending' | Status: pending / sent / executed / failed |
| created_at | TIMESTAMP | DEFAULT NOW | Waktu perintah dibuat |
| executed_at | TIMESTAMP | NULL | Waktu perintah dieksekusi device |

**Index:**
- `idx_device_id` - filter perintah per device
- `idx_status` - filter perintah pending
- `idx_created_at` - query perintah historis

**Relasi:**
- N:1 ke DEVICES (many commands per one device)
- N:1 ke USERS (many commands per one user)

**Contoh Perintah:**
```
1. Relay Toggle: command_value = "ON" / "OFF"
2. PWM Speed:    command_value = "PWM:200" (0-255)
3. Servo Angle:  command_value = "90" (derajat)
```

---

## 🔗 Relasi Antar Tabel

### Relasi 1:N (One to Many)

| Dari | Ke | Deskripsi |
|-----|----|---------| 
| **users** → **devices** | 1:N | 1 user memiliki banyak device |
| **users** → **widgets** | 1:N | 1 user memiliki banyak widget |
| **users** → **activity_logs** | 1:N | 1 user memiliki banyak log |
| **users** → **control_commands** | 1:N | 1 user mengirim banyak perintah |
| **devices** → **widgets** | 1:N | 1 device memiliki banyak widget |
| **devices** → **sensor_data** | 1:N | 1 device menghasilkan banyak data |
| **devices** → **alerts** | 1:N | 1 device memiliki banyak alert |
| **devices** → **control_commands** | 1:N | 1 device menerima banyak perintah |

### Cascade Rules

```
Jika user dihapus:
  → Semua devices milik user → DIHAPUS
    → Semua widgets related → DIHAPUS
    → Semua sensor_data → DIHAPUS
    → Semua alerts → DIHAPUS
    → Semua activity_logs → DIHAPUS

Jika device dihapus:
  → Semua widgets device → DIHAPUS
  → Semua sensor_data device → DIHAPUS
  → Semua alerts device → DIHAPUS
```

---

## 📈 Flow Data Dalam Sistem

```
1. DEVICE STARTUP
   Device → [Secret Key] → Server WebSocket
   Server → Register secret_key di memory (secretKeyRegistry)
   Server → Load dari database devices table

2. DATA SENSOR DITERIMA
   Device → {action: "data", var: "temperature", val: 25.5} via WebSocket
   Server → Buffer di SensorDataBuffer (batch setiap 2 detik)
   Server → Update widgets.current_value (realtime)
   Server → Broadcast ke dashboard via WebSocket
   SensorDataBuffer.flush() → INSERT BATCH ke sensor_data

3. USER LIHAT DASHBOARD
   Client → GET /api/widgets
   Server → Query widgets table
   Server → Return widget_id, current_value (dari cache)

4. USER LIHAT GRAFIK HISTORIS
   Client → GET /api/data/device/:id
   Server → Query sensor_data WHERE device_id=X AND timestamp >= (now-7days)
   Server → Return data untuk chart

5. USER KIRIM PERINTAH
   Client → POST /api/control-command
   Server → INSERT ke control_commands (status='pending')
   Server → Send ke device via WebSocket
   Device → Execute perintah
   Device → Report status='executed' 
```

---

## 🔐 Security Considerations

1. **Password Hashing**
   - Gunakan bcryptjs (sudah di kode)
   - Hash cost: 10 (default aman)

2. **API Keys**
   - `api_key`: untuk REST API calls
   - `secret_key`: untuk WebSocket authentication
   - Keduanya UNIQUE dan NOT NULL

3. **Rate Limiting**
   - Implementasikan di aplikasi untuk:
     - POST /register (prevent spam)
     - POST /api/devices (prevent DoS)

4. **SQL Injection Prevention**
   - Gunakan prepared statements (sudah di kode Node.js)
   - Parameter binding otomatis

5. **Data Validation**
   - Validate enum values (device_type, widget_type, dll)
   - Validate string lengths (max varchar length)

---

## 📊 Query Umum untuk Skripsi

### Query 1: Data Sensor 7 Hari Terakhir
```sql
SELECT 
    sd.timestamp,
    sd.sensor_type,
    sd.value,
    w.unit
FROM sensor_data sd
LEFT JOIN widgets w ON sd.device_id = w.device_id AND sd.sensor_type = w.sensor_type
WHERE sd.device_id = ? 
    AND sd.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY sd.timestamp DESC;
```

### Query 2: Rata-rata Data Per Jam
```sql
SELECT 
    DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') AS hour,
    sensor_type,
    AVG(CAST(value AS DECIMAL(10,2))) AS avg_value,
    MAX(CAST(value AS DECIMAL(10,2))) AS max_value,
    MIN(CAST(value AS DECIMAL(10,2))) AS min_value
FROM sensor_data
WHERE device_id = ?
    AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY hour, sensor_type
ORDER BY hour DESC;
```

### Query 3: Statistik Device per User
```sql
SELECT 
    u.username,
    COUNT(DISTINCT d.device_id) AS total_devices,
    COUNT(DISTINCT sd.data_id) AS total_sensor_readings,
    MAX(sd.timestamp) AS last_reading,
    COUNT(DISTINCT a.alert_id) AS active_alerts
FROM users u
LEFT JOIN devices d ON u.user_id = d.user_id
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id
LEFT JOIN alerts a ON d.device_id = a.device_id AND a.is_active = TRUE
WHERE u.user_id = ?
GROUP BY u.user_id, u.username;
```

---

## 📋 Normalisasi Database

**Normalization Level: 3NF (Third Normal Form)**

✅ **1NF (First Normal Form)**
- Semua kolom atomic (tidak ada multi-value)
- ✓ Sudah terpenuhi

✅ **2NF (Second Normal Form)**
- Semua non-key attributes dependent pada primary key
- ✓ Sudah terpenuhi

✅ **3NF (Third Normal Form)**
- Tidak ada transitive dependency
- ✓ Sudah terpenuhi
- Contoh: sensor_type tidak dependent pada entity lain

---

## 🚀 Rekomendasi Implementasi untuk Skripsi

1. **Database Server**
   - MySQL 5.7 atau MariaDB 10.3+
   - Minimum 2GB RAM untuk production

2. **Performa**
   - Untuk sensor data > 1 juta records: pertimbangkan partitioning
   - Monitor query dengan EXPLAIN
   - Backup harian untuk data penting

3. **Documentation**
   - Sertakan ERD di laporan (bab design)
   - Jelaskan relasi dan constraint setiap tabel
   - Berikan sample query yang digunakan

4. **Testing**
   - Test cascade delete
   - Test concurrent writes di sensor_data
   - Test query performance dengan large dataset

---

## 📁 File Terkait

- `01_schema_mysql.sql` - Script CREATE TABLE (siap pakai)
- `02_sample_data.sql` - Data dummy untuk testing (coming soon)
- `ERD_UNIOT_Draw.io.xml` - File ERD untuk Draw.io (coming soon)

---

**Dibuat untuk:** Skripsi Platform UNIOT  
**Versi:** 1.0  
**Last Updated:** 31 Mei 2026
