# 📖 PANDUAN IMPLEMENTASI ERD UNIOT untuk Skripsi

**Tujuan:** Memandu dari nol hingga membuat ERD MySQL untuk platform UNIOT di skripsi Anda.

---

## 🚀 Langkah 1: Setup Database MySQL

### Opsi A: Local Installation (Windows/Mac/Linux)

**Download & Install:**
1. Buka https://dev.mysql.com/downloads/mysql/
2. Download MySQL Community Server (versi latest)
3. Install dengan wizard default
4. Setup password root saat install

**Verifikasi:**
```bash
mysql --version
mysql -u root -p
# Masukkan password yang diberikan saat install
```

### Opsi B: Docker (Recommended untuk Development)

```bash
# Jalankan MySQL container
docker run --name uniot_mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=uniot_db \
  -p 3306:3306 \
  -d mysql:8.0

# Connect ke database
docker exec -it uniot_mysql mysql -u root -p

# Password: root123
```

### Opsi C: Online (MySQL as a Service)

- **PlanetScale** (MySQL compatible): https://planetscale.com (gratis tier)
- **AWS RDS**: https://aws.amazon.com/rds/
- **Google Cloud SQL**: https://cloud.google.com/sql/

---

## 🛠️ Langkah 2: Membuat Database

### Via Command Line (mysql CLI)

```bash
# Login ke MySQL
mysql -u root -p

# Masukkan password
# Muncul prompt: mysql>

# Paste semua isi file: 01_schema_mysql.sql
mysql> source /path/to/01_schema_mysql.sql;

# Atau bisa juga baca file langsung:
mysql -u root -p < /path/to/01_schema_mysql.sql
```

### Via GUI (MySQL Workbench)

1. Download MySQL Workbench dari: https://dev.mysql.com/downloads/workbench/
2. Install & buka aplikasi
3. Setup connection ke MySQL server
4. File → Open SQL Script → Pilih `01_schema_mysql.sql`
5. Click ⚡ Execute Script

### Via PhpMyAdmin (Web Based)

1. Install XAMPP (sudah include Apache + MySQL + PhpMyAdmin)
2. Buka http://localhost/phpmyadmin
3. Login dengan user: root, password: kosong
4. Create database baru: `uniot_db`
5. Import file `01_schema_mysql.sql` via UI

---

## 📊 Langkah 3: Verifikasi Struktur Database

Jalankan query untuk memastikan semua tabel created dengan benar:

```sql
-- Lihat semua tabel
SHOW TABLES;

-- Output yang diharapkan:
-- | Tables_in_uniot_db  |
-- |---------------------|
-- | activity_logs       |
-- | alerts              |
-- | control_commands    |
-- | devices             |
-- | sensor_data         |
-- | users               |
-- | widgets             |

-- Lihat struktur tabel USERS
DESCRIBE users;

-- Lihat struktur tabel DEVICES
DESCRIBE devices;
```

---

## 🎨 Langkah 4: Membuat Visual ERD

### Opsi 1: Draw.io (Recommended - Gratis & Mudah)

1. Buka https://draw.io
2. New Diagram → Entity Relationship Diagram
3. Drag & drop entities sesuai file `02_ERD_DOCUMENTATION.md`
4. Setup relasi dengan connector lines
5. Export → PDF untuk skripsi

**Quick Template:**
```
Draw.io shapes yang digunakan:
- Entity (Rectangle)
- Relationship (Diamond)
- Connector (Lines dengan cardinality: 1, N)
```

### Opsi 2: MySQL Workbench (Native & Profesional)

1. Buka MySQL Workbench
2. Database → Reverse Engineer
3. Pilih connection ke database `uniot_db`
4. Next → Pilih schema `uniot_db`
5. Finish → Auto generate ERD visual
6. Export → PNG/PDF untuk laporan

### Opsi 3: Lucidchart (Cloud - Kolaborasi)

1. Sign up di https://www.lucidchart.com
2. New → Entity Relationship Diagram
3. Drag templates dari library
4. Share dengan pembimbing untuk feedback
5. Export ke berbagai format

---

## 📝 Langkah 5: Insert Sample Data untuk Testing

Gunakan file `03_sample_data.sql` untuk testing:

```bash
# Import sample data
mysql -u root -p uniot_db < /path/to/03_sample_data.sql

# Login dan lihat data
mysql -u root -p uniot_db

# Query untuk lihat data yang diinsert
mysql> SELECT * FROM users LIMIT 5;
mysql> SELECT * FROM devices;
mysql> SELECT * FROM sensor_data LIMIT 10;
```

---

## 🔍 Langkah 6: Test Query Performance

### Query 1: Filter Data Sensor 7 Hari

```sql
SELECT 
    sd.timestamp,
    sd.sensor_type,
    sd.value,
    w.unit
FROM sensor_data sd
LEFT JOIN widgets w ON sd.device_id = w.device_id 
    AND sd.sensor_type = w.sensor_type
WHERE sd.device_id = 1
    AND sd.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY sd.timestamp DESC
LIMIT 100;

-- Lihat query plan (apakah pakai INDEX)
EXPLAIN SELECT ...;
```

### Query 2: Aggregate Data Per Jam

```sql
SELECT 
    DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') AS hour,
    sensor_type,
    COUNT(*) AS data_points,
    AVG(CAST(value AS DECIMAL(10,2))) AS avg_value,
    MAX(CAST(value AS DECIMAL(10,2))) AS max_value,
    MIN(CAST(value AS DECIMAL(10,2))) AS min_value
FROM sensor_data
WHERE device_id = 1
    AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY hour, sensor_type
ORDER BY hour DESC;
```

### Query 3: User Dashboard Summary

```sql
SELECT 
    u.username,
    COUNT(DISTINCT d.device_id) AS total_devices,
    COUNT(DISTINCT sd.data_id) AS total_readings,
    MAX(sd.timestamp) AS last_update,
    COUNT(DISTINCT a.alert_id) AS active_alerts
FROM users u
LEFT JOIN devices d ON u.user_id = d.user_id
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id
LEFT JOIN alerts a ON d.device_id = a.device_id AND a.is_active = TRUE
WHERE u.user_id = 1
GROUP BY u.user_id;
```

---

## 📋 Langkah 7: Dokumentasi untuk Laporan Skripsi

### A. Bab Design Database

**Struktur yang disarankan untuk skripsi:**

```markdown
## BAB 3: DESAIN SISTEM

### 3.1 Desain Database

#### 3.1.1 Entity Relationship Diagram (ERD)
[Sertakan gambar ERD]

Gambar 3.1 menunjukkan relasi antar entitas dalam sistem UNIOT.
Sistem terdiri dari 7 tabel utama:

1. **Users** - Manajemen pengguna dan autentikasi
   - Menyimpan data login dan profil user
   - Primary key: user_id
   
2. **Devices** - Perangkat IoT yang terhubung
   - Setiap device memiliki secret_key unik untuk WebSocket
   - Relasi 1:N dengan Users
   
3. **Widgets** - Komponen UI di dashboard
   - Menyimpan konfigurasi tampilan (number, toggle, slider, dll)
   - Relasi N:1 dengan Devices
   
4. **Sensor_data** - Data time-series dari sensor
   - Tabel paling besar, optimal dengan indexing timestamp
   - Dioptimalkan dengan batch insert setiap 2 detik
   
5. **Alerts** - Konfigurasi notifikasi
   - Trigger alert ketika data sensor melebihi threshold
   
6. **Activity_logs** - Audit trail
   - Mencatat setiap aksi user untuk security
   
7. **Control_commands** - Perintah ke aktuator
   - Menyimpan history perintah yang dikirim ke device

#### 3.1.2 Normalisasi Database
Database sudah dinormalisasi hingga 3NF (Third Normal Form):
- Semua kolom atomic (tidak ada multi-value)
- Tidak ada transitive dependency
- Setiap entitas memiliki primary key unik

#### 3.1.3 Relasi Antar Tabel
[Gambar atau tabel relasi 1:N]

| Entitas Sumber | Entitas Tujuan | Cardinality | Deskripsi |
|---|---|---|---|
| Users | Devices | 1:N | Satu user bisa punya banyak device |
| Users | Widgets | 1:N | Satu user bisa punya banyak widget |
| Devices | Sensor_data | 1:N | Satu device generate banyak data |
| Devices | Alerts | 1:N | Satu device bisa punya banyak alert |

#### 3.1.4 Constraint & Integritas Data
- Foreign Key: Referential integrity
- ON DELETE CASCADE: Jika device dihapus, semua sensor_data otomatis dihapus
- UNIQUE constraint: api_key, secret_key untuk security
- NOT NULL: Kolom penting selalu terisi
```

### B. Tabel di Bab Implementasi

```markdown
### 3.2 Implementasi Database

#### 3.2.1 DDL (Data Definition Language)
Script SQL untuk membuat tabel:

Tabel 3.1: Struktur Tabel USERS
| Kolom | Tipe | Constraint | Keterangan |
|-------|------|-----------|-----------|
| user_id | INT | PK, AUTO_INCREMENT | ... |
| username | VARCHAR(50) | UNIQUE, NOT NULL | ... |
| ... | ... | ... | ... |

[Lengkapi untuk semua tabel]

#### 3.2.2 Index & Performa
Tabel 3.2: Indexing Strategy
| Tabel | Nama Index | Kolom | Alasan |
|-------|-----------|-------|--------|
| sensor_data | idx_device_time | (device_id, timestamp) | Query 7-hari cepat |
| sensor_data | idx_sensor_time | (sensor_type, timestamp) | Grouped query optimal |
| ... | ... | ... | ... |

#### 3.2.3 Sample Query
Contoh query yang sering digunakan:

[Query 1, 2, 3 dari testing]
```

### C. Lampiran ERD

**Sertakan:**
1. File PDF gambar ERD (export dari Draw.io/Workbench)
2. File SQL schema (01_schema_mysql.sql)
3. File documentation (02_ERD_DOCUMENTATION.md)

---

## 🧪 Langkah 8: Testing & Debugging

### Common Issues & Solutions

**Issue 1: Foreign Key Error saat insert**
```sql
-- Error: Cannot add or update a child row

-- Solution: Pastikan parent record sudah ada
INSERT INTO users VALUES (1, 'admin', 'admin@test.com', 'hash', ...);
INSERT INTO devices VALUES (1, 1, 'Device1', ...); -- user_id=1 sudah ada
```

**Issue 2: Index tidak terpakai (slow query)**
```sql
-- Check apakah query pakai index
EXPLAIN SELECT * FROM sensor_data WHERE device_id=1 AND timestamp > NOW()-INTERVAL 7 DAY;

-- Jika tidak pakai index, create manual:
CREATE INDEX idx_device_time ON sensor_data(device_id, timestamp);
```

**Issue 3: Duplicate secret_key saat register device**
```sql
-- Ensure secret_key always UNIQUE
-- Dalam aplikasi Node.js, gunakan crypto random:
const secretKey = crypto.randomBytes(32).toString('hex');
```

---

## 📦 Checklist untuk Skripsi

- [ ] Database sudah di-setup di MySQL
- [ ] Semua 7 tabel berhasil dibuat
- [ ] Sample data sudah diinsert
- [ ] ERD visual sudah dibuat (PNG/PDF)
- [ ] Query testing sudah dijalankan & optimal
- [ ] Documentation sudah lengkap
- [ ] Backup database sudah dibuat
- [ ] File SQL sudah disimpan di folder kebutuhan_skripsi

---

## 📁 File References

File yang sudah disiapkan di folder `kebutuhan_skripsi/`:

```
kebutuhan_skripsi/
├── 01_schema_mysql.sql          # Script CREATE TABLE
├── 02_ERD_DOCUMENTATION.md      # Dokumentasi lengkap ERD
├── 03_sample_data.sql           # Data dummy untuk testing
├── 04_PANDUAN_IMPLEMENTASI.md   # File ini
├── 05_query_cheatsheet.sql      # Kumpulan query berguna
└── 06_performance_tips.md       # Tips optimasi performa
```

---

## 🎓 Saran untuk Presentasi Skripsi

### Slide 1: Database Overview
- Gambar: ERD lengkap
- Text: "Platform UNIOT menggunakan 7 tabel dengan relasi 1:N"

### Slide 2: Tabel Utama
- Tabel: List 7 tabel + function masing-masing
- Icon: Gunakan simbol database, server, dll

### Slide 3: Query Performance
- Graph: Comparison dengan/tanpa index
- Tabel: Response time sebelum-sesudah optimization

### Slide 4: Backup & Recovery
- Diagram: Backup strategy
- Timeline: Full backup weekly, incremental daily

---

## 💡 Tips Tambahan

1. **Kolaborasi dengan Pembimbing**
   - Kirim file SQL & ERD untuk di-review
   - Tanyakan feedback tentang design choices

2. **Security Check**
   - Password di-hash dengan bcrypt ✓
   - Prepared statements digunakan ✓
   - Rate limiting diimplementasikan ✓

3. **Performance Optimization**
   - Index di-create di kolom frequently queried ✓
   - Batch insert untuk sensor_data ✓
   - Connection pooling di aplikasi ✓

4. **Documentation**
   - Explain WHY, tidak hanya WHAT
   - Sertakan alternative design & alasan pilihan
   - Referensi dari paper/best practices

---

**Last Updated:** 31 Mei 2026  
**Untuk:** Skripsi Platform UNIOT  
**Status:** Ready to Use ✓
