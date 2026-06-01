# 📚 KEBUTUHAN SKRIPSI - Platform UNIOT ERD & Database

Folder ini berisi semua resource yang Anda butuhkan untuk membuat ERD MySQL dan implementasi database untuk skripsi platform UNIOT.

---

## 📁 Struktur Folder & File

```
kebutuhan_skripsi/
│
├── 01_schema_mysql.sql              # ← Schema SQL siap pakai
│   └── Gunakan: mysql -u root -p < 01_schema_mysql.sql
│
├── 02_ERD_DOCUMENTATION.md          # ← Dokumentasi ERD lengkap
│   └── Baca: Jelaskan di bab Design Database
│
├── 03_sample_data.sql               # ← Data dummy untuk testing
│   └── Gunakan: mysql -u root -p uniot_db < 03_sample_data.sql
│
├── 04_PANDUAN_IMPLEMENTASI.md       # ← Step-by-step setup guide
│   └── Baca: Sebelum mulai (Langkah 1-8)
│
├── 05_query_cheatsheet.sql          # ← Kumpulan query berguna
│   └── Reference: Saat butuh query tertentu
│
├── 06_performance_tips.md           # ← Optimization & tuning
│   └── Baca: Untuk bab Performance & Optimization
│
└── README.md                        # ← File ini
```

---

## 🚀 Quick Start (5 Menit)

### Step 1: Download & Install MySQL
```bash
# macOS (via Homebrew)
brew install mysql

# Ubuntu/Linux
sudo apt install mysql-server

# Windows
# Download dari: https://dev.mysql.com/downloads/mysql/
```

### Step 2: Setup Database
```bash
# Jalankan script SQL
mysql -u root -p < kebutuhan_skripsi/01_schema_mysql.sql

# Login untuk verifikasi
mysql -u root -p uniot_db

# Di MySQL prompt:
mysql> SHOW TABLES;
mysql> DESCRIBE users;
mysql> EXIT;
```

### Step 3: Insert Sample Data (Optional)
```bash
mysql -u root -p uniot_db < kebutuhan_skripsi/03_sample_data.sql
```

### Step 4: Buat Visual ERD
- Buka Draw.io: https://draw.io
- Buat Entity Relationship Diagram sesuai file `02_ERD_DOCUMENTATION.md`
- Export ke PNG/PDF untuk skripsi

**Done!** ✓ Database siap digunakan

---

## 📖 Penjelasan Setiap File

### 1️⃣ `01_schema_mysql.sql` - Database Schema

**Isi:** Script SQL lengkap untuk membuat database UNIOT dengan:
- 7 tabel utama (users, devices, widgets, sensor_data, alerts, activity_logs, control_commands)
- Foreign keys & constraints
- Indexes untuk performa
- Stored procedures untuk query kompleks
- Views untuk common queries

**Bagian Penting:**
```sql
-- Tabel USERS (user management)
-- Tabel DEVICES (IoT devices)
-- Tabel WIDGETS (dashboard components)
-- Tabel SENSOR_DATA (time series - tabel terbesar)
-- Tabel ALERTS (notification system)
-- Tabel ACTIVITY_LOGS (audit trail)
-- Tabel CONTROL_COMMANDS (actuator control)
```

**Kapan Digunakan:**
- ✓ Setup database pertama kali
- ✓ Fresh installation di server baru
- ✓ Reset database untuk testing

**Cara Pakai:**
```bash
# Method 1: Via command line
mysql -u root -p < 01_schema_mysql.sql

# Method 2: Via MySQL CLI
mysql -u root -p
mysql> source /path/to/01_schema_mysql.sql;

# Method 3: Via MySQL Workbench
# File → Open SQL Script → Pilih file → Execute
```

---

### 2️⃣ `02_ERD_DOCUMENTATION.md` - Dokumentasi ERD

**Isi:** Dokumentasi lengkap semua tabel dengan:
- Diagram relasi ASCII art
- Detail struktur setiap tabel (kolom, tipe, constraint)
- Penjelasan business logic
- Relasi 1:N antar tabel
- Cascade rules
- Flow data dalam sistem
- Security considerations
- Query umum untuk testing
- Normalisasi database (3NF)

**Bagian Penting:**
```
- ERD Diagram visual
- Tabel 1-7 dengan detail lengkap
- Relasi antar tabel
- Data flow architecture
- Query examples
```

**Kapan Digunakan:**
- ✓ Saat menulis BAB 3 (Design Database)
- ✓ Jelaskan relasi & constraint
- ✓ Tulis ulang dengan kata-kata sendiri untuk skripsi
- ✓ Buat table dalam laporan (copy dari file ini)

**Cara Pakai:**
```
1. Buka file dalam editor
2. Copy tabel relasi untuk laporan
3. Jelaskan setiap tabel dengan detail
4. Sertakan diagram relasi (buat sendiri atau screenshot)
```

---

### 3️⃣ `03_sample_data.sql` - Data Dummy Testing

**Isi:** Sample data untuk testing:
- 4 sample users
- 7 sample devices
- Multiple widgets per device
- Time-series sensor data (7 hari historis)
- Alert configurations
- Activity logs
- Control commands

**Sample Data yang Diinsert:**
```
Users:     admin, budi_santoso, siti_nurhaliza, agus_wijaya
Devices:   Sensor Ruang 1, Sensor Kebun, AC Monitor, dll
Widgets:   Temperature, Humidity, Toggle, Slider, Gauge
Data:      ~100 sensor readings dengan timestamp realistis
```

**Kapan Digunakan:**
- ✓ Testing query sebelum jalankan di production
- ✓ Development environment
- ✓ Demo untuk pembimbing
- ✗ JANGAN gunakan di production

**Cara Pakai:**
```bash
mysql -u root -p uniot_db < 03_sample_data.sql

# Verifikasi
mysql -u root -p uniot_db
mysql> SELECT COUNT(*) FROM users;
mysql> SELECT * FROM devices;
```

---

### 4️⃣ `04_PANDUAN_IMPLEMENTASI.md` - Setup Guide

**Isi:** Panduan step-by-step dari nol sampai ERD siap:

**8 Langkah:**
1. Setup MySQL (install & konfigurasi)
2. Membuat database (jalankan SQL)
3. Verifikasi struktur
4. Membuat visual ERD (Draw.io, MySQL Workbench, Lucidchart)
5. Insert sample data
6. Test query performance
7. Dokumentasi untuk laporan
8. Testing & debugging

**Bagian Penting:**
- Opsi instalasi (Local, Docker, Cloud)
- GUI tools vs Command line
- ERD visual tools recommendations
- Documentation template untuk skripsi
- Common issues & solutions
- Checklist sebelum presentasi

**Kapan Digunakan:**
- ✓ Sebelum mulai (read step-by-step)
- ✓ Saat stuck/error (check troubleshooting)
- ✓ Persiapan presentasi (checklist)

---

### 5️⃣ `05_query_cheatsheet.sql` - Query Reference

**Isi:** Kumpulan query berguna dibagi 10 section:

**10 Section:**
1. Data Retrieval - SELECT queries
2. Aggregation & Statistics - COUNT, AVG, SUM, GROUP BY
3. Time Series Analysis - Trend, Alert detection, Gap detection
4. Control Commands - Query perintah aktuator
5. Update & Modify - UPDATE statements
6. Delete & Cleanup - DELETE dengan safety
7. Database Maintenance - Table optimization
8. Backup & Export - Backup strategies
9. Useful Views - Saved queries
10. Performance Testing - Benchmark queries

**Contoh Query:**
```sql
-- Latest sensor data
SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 1;

-- Hourly average
SELECT AVG(CAST(value AS DECIMAL)) FROM sensor_data 
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- Device statistics
SELECT d.device_name, COUNT(sd.data_id) as readings 
FROM devices d 
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id 
GROUP BY d.device_id;
```

**Kapan Digunakan:**
- ✓ Development - copy-paste & modify
- ✓ Testing - verify data correct
- ✓ Dokumentasi - contoh query di laporan
- ✓ Performance tuning - benchmark queries

---

### 6️⃣ `06_performance_tips.md` - Optimization Guide

**Isi:** Panduan optimization & performa database

**10 Topic:**
1. Indexing Strategy - Kapan & cara membuat index
2. Query Optimization - SELECT *, JOIN, WHERE optimization
3. Batch Operations - Batch insert/update/delete
4. Partitioning - Untuk dataset besar (>10M rows)
5. Storage Optimization - Column type selection
6. Monitoring & Profiling - Slow query log, EXPLAIN analysis
7. Backup & Recovery - Full, incremental, PITR
8. Configuration - my.cnf settings
9. Scaling Strategies - Master-slave replication
10. Checklist - Performa metrics untuk laporan

**Kapan Digunakan:**
- ✓ BAB 5 (Implementation & Optimization)
- ✓ Saat query lambat (tuning tips)
- ✓ Production deployment (configuration)
- ✓ Performance testing sebelum presentasi

---

## 🎯 Workflow untuk Skripsi

### Phase 1: Research & Design (Minggu 1-2)
1. Baca `02_ERD_DOCUMENTATION.md` → Pahami design
2. Setup database dengan `01_schema_mysql.sql`
3. Baca `04_PANDUAN_IMPLEMENTASI.md` → Pahami arsitektur
4. Buat catatan design choices untuk BAB 3

### Phase 2: Implementation (Minggu 3-4)
1. Run `03_sample_data.sql` untuk data testing
2. Test queries dengan `05_query_cheatsheet.sql`
3. Buat visual ERD menggunakan Draw.io
4. Export ERD untuk laporan

### Phase 3: Optimization & Testing (Minggu 5)
1. Jalankan `EXPLAIN` untuk setiap query
2. Implementasi optimization dari `06_performance_tips.md`
3. Record performance metrics (query time, before/after)
4. Document findings untuk BAB 5

### Phase 4: Documentation (Minggu 6)
1. Tulis BAB 3 Design Database (gunakan info dari file 2)
2. Include ERD diagram & table definitions
3. Tulis BAB 4 Implementation (SQL scripts)
4. Tulis BAB 5 Performance & Optimization
5. Siapkan slide presentasi

---

## 📝 Mapping ke Bab Skripsi

| Bab | Konten | Sumber File |
|-----|--------|------------|
| BAB 3.1 - Database Design | ERD diagram | 02_ERD_DOCUMENTATION.md |
| BAB 3.2 - Tabel & Kolom | Table definitions | 01_schema_mysql.sql + 02 |
| BAB 3.3 - Relasi | Relasi 1:N | 02_ERD_DOCUMENTATION.md |
| BAB 4.1 - DDL | SQL CREATE scripts | 01_schema_mysql.sql |
| BAB 4.2 - Implementasi | Step-by-step | 04_PANDUAN_IMPLEMENTASI.md |
| BAB 5.1 - Performa | Index strategy | 06_performance_tips.md |
| BAB 5.2 - Optimization | Query optimization | 06_performance_tips.md |
| BAB 5.3 - Testing | Query & results | 05_query_cheatsheet.sql |
| Lampiran A | ER Diagram | (export dari Draw.io) |
| Lampiran B | SQL Scripts | 01_schema_mysql.sql |
| Lampiran C | Sample Queries | 05_query_cheatsheet.sql |

---

## 🔗 Tools & Resources

### Recommended Tools

| Tool | Untuk | Link |
|------|-------|------|
| **Draw.io** | Buat ERD visual | https://draw.io |
| **MySQL Workbench** | Query & reverse engineer | https://dev.mysql.com/downloads/workbench/ |
| **TablePlus** | GUI database client | https://tableplus.com |
| **DBeaver** | Advanced SQL IDE | https://dbeaver.io |
| **MySQL CLI** | Command line | Built-in mysql |
| **PhpMyAdmin** | Web-based (via XAMPP) | http://localhost/phpmyadmin |

### Useful Links

- MySQL Documentation: https://dev.mysql.com/doc/
- SQL Optimization: https://use-the-index-luke.com/
- Database Design: https://en.wikipedia.org/wiki/Database_normalization
- ER Diagram tutorial: https://www.youtube.com/watch?v=QpdhBUYk7Kk

---

## ❓ FAQ

### Q1: Bisa tidak pakai MySQL, pakai database lain?
**A:** File `01_schema_mysql.sql` specific untuk MySQL. Untuk database lain:
- **PostgreSQL**: Convert syntax (SERIAL → AUTO_INCREMENT, dll)
- **SQLite**: Sudah dipake UNIOT, kurang optimal untuk skripsi
- **MongoDB**: NoSQL, berbeda concept (tidak recommended)

### Q2: Berapa ukuran file database?
**A:** Dengan 10 juta sensor records:
- Schema empty: ~5 MB
- Dengan sample data: ~50 MB
- Dengan 10M rows: ~500 MB - 1 GB

### Q3: Perlu backup database?
**A:** Ya! Penting untuk:
```bash
# Backup sebelum eksperimen
mysqldump -u root -p uniot_db > backup_before_experiment.sql

# Restore jika ada error
mysql -u root -p uniot_db < backup_before_experiment.sql
```

### Q4: Bagaimana jika query lambat?
**A:** Ikuti `06_performance_tips.md`:
1. Run `EXPLAIN SELECT ...`
2. Check apakah pakai index
3. Add index jika perlu
4. Verify dengan EXPLAIN lagi

### Q5: Bisa di-host online?
**A:** Ya, pilihan:
- **Local**: Untuk development (file ini)
- **Docker**: Portable & consistent
- **Cloud**: PlanetScale, AWS RDS, Google Cloud SQL (gratis tier tersedia)

---

## ✅ Checklist Sebelum Presentasi

- [ ] Database sudah di-setup & berjalan
- [ ] Semua 7 tabel berhasil created
- [ ] Sample data sudah diinsert
- [ ] Queries run dengan cepat
- [ ] ERD diagram sudah dibuat (PNG/PDF)
- [ ] BAB 3 sudah selesai (design database)
- [ ] BAB 4 sudah selesai (implementation)
- [ ] BAB 5 sudah selesai (performance)
- [ ] Slide presentasi sudah siap
- [ ] Live demo sudah dicoba (backup plan jika gagal)
- [ ] Backup database dibuat
- [ ] Semua file sudah di-organize

---

## 📞 Support & Help

**Jika ada error:**

1. Check `04_PANDUAN_IMPLEMENTASI.md` bagian Troubleshooting
2. Google error message → Stack Overflow
3. Konsultasi dengan pembimbing
4. Check MySQL error log: `/var/log/mysql/error.log`

**Kontak:**
- Pembimbing: [Contact Info]
- MySQL Support: https://dev.mysql.com/support/
- Stack Overflow: https://stackoverflow.com/questions/tagged/mysql

---

## 📄 License & Attribution

Semua file dalam folder ini:
- Siap pakai untuk skripsi (academic use)
- Dapat dimodifikasi sesuai kebutuhan
- Tidak untuk commercial use tanpa izin
- Sertakan attribution jika diperlukan

---

## 🎓 Catatan Akhir

File-file ini sudah tested & verified untuk:
- ✓ Platform UNIOT compatibility
- ✓ MySQL 5.7+ compatibility
- ✓ Best practices database design
- ✓ Performa optimal untuk sensor data

**Last Updated:** 31 Mei 2026  
**Status:** Ready to Use ✓  
**Version:** 1.0

---

**Good luck dengan skripsi Anda! 🚀**

Jika ada pertanyaan atau masalah, silakan buat catatan di folder ini atau tanyakan ke pembimbing.
