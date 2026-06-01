# 🚀 PERFORMANCE OPTIMIZATION TIPS - Database UNIOT

Panduan optimasi performa untuk database UNIOT yang akan Anda gunakan di skripsi.

---

## 📊 1. Indexing Strategy

### 1.1 Index yang Sudah Ada (dalam schema)

```sql
-- Index pada USERS
INDEX idx_username (username)       -- Untuk login query
INDEX idx_email (email)             -- Untuk password recovery

-- Index pada DEVICES
INDEX idx_user_id (user_id)         -- Filter by user
INDEX idx_slug (public_slug)        -- Public view lookup
INDEX idx_status (status)           -- Device status filter

-- Index pada WIDGETS
INDEX idx_device_id (device_id)     -- Widget per device
INDEX idx_user_id (user_id)         -- Widget per user
INDEX idx_sensor_type (sensor_type) -- Sensor type search

-- Index pada SENSOR_DATA (KRITIS - tabel terbesar)
INDEX idx_device_time (device_id, timestamp)    -- Most important!
INDEX idx_sensor_time (sensor_type, timestamp)  -- Secondary
INDEX idx_timestamp (timestamp)                 -- Cleanup/archive queries
```

### 1.2 Kapan Perlu Tambah Index

**Query lambat?** Gunakan `EXPLAIN` untuk diagnosis:

```sql
-- Sebelum optimize:
EXPLAIN SELECT * FROM sensor_data 
WHERE device_id = 1 AND timestamp > NOW()-INTERVAL 7 DAY;

-- Lihat kolom: type, possible_keys, key, rows, Extra
-- Jika "type" = ALL atau rows terlalu besar → perlu index

-- Tambah index:
CREATE INDEX idx_device_time ON sensor_data(device_id, timestamp);

-- Setelah optimize - lihat perbedaan:
EXPLAIN SELECT * FROM sensor_data 
WHERE device_id = 1 AND timestamp > NOW()-INTERVAL 7 DAY;
-- Seharusnya sekarang "type" = range, rows berkurang drastis
```

### 1.3 Composite Index Order

**Penting:** Urutan kolom dalam composite index mempengaruhi performa!

```sql
-- ✓ GOOD - Lebih menguntungkan:
CREATE INDEX idx_device_time ON sensor_data(device_id, timestamp);
-- Query ini cepat:
SELECT * FROM sensor_data 
WHERE device_id = 1 AND timestamp > NOW()-INTERVAL 7 DAY; ✓ Fast

-- ✗ BAD - Sebaliknya kurang optimal:
CREATE INDEX idx_time_device ON sensor_data(timestamp, device_id);
-- Query ini agak lambat:
SELECT * FROM sensor_data 
WHERE device_id = 1 AND timestamp > NOW()-INTERVAL 7 DAY; ✗ Slower
```

**Rule of Thumb:**
- Letakkan kolom yang di-filter dengan `=` dulu
- Kemudian kolom yang di-filter dengan `<`, `>`, `BETWEEN`

---

## ⚡ 2. Query Optimization

### 2.1 SELECT * vs Specific Columns

```sql
-- ✗ SLOW - Ambil semua kolom
SELECT * FROM sensor_data 
WHERE device_id = 1;

-- ✓ FAST - Ambil kolom yang dibutuhkan
SELECT sensor_type, value, timestamp 
FROM sensor_data 
WHERE device_id = 1;

-- Performa boost: ~20-30% lebih cepat tergantung jumlah kolom
```

### 2.2 JOIN Optimization

```sql
-- ✗ Banyak sub-query (N+1 problem)
SELECT d.device_name 
FROM devices d 
WHERE d.user_id = 1;
-- Hasil: 5 devices
-- Kemudian loop untuk setiap device:
SELECT COUNT(*) FROM sensor_data WHERE device_id = 1; -- 1st query
SELECT COUNT(*) FROM sensor_data WHERE device_id = 2; -- 2nd query
SELECT COUNT(*) FROM sensor_data WHERE device_id = 3; -- 3rd query
-- Total: 6 queries (1 + 5)

-- ✓ Single JOIN (optimal)
SELECT 
    d.device_id,
    d.device_name,
    COUNT(sd.data_id) AS sensor_count
FROM devices d
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id
WHERE d.user_id = 1
GROUP BY d.device_id;
-- Total: 1 query
```

### 2.3 Filter di WHERE, bukan SELECT

```sql
-- ✗ Ambil semua, filter di app
SELECT * FROM sensor_data;
-- Process dalam PHP/Node.js:
$data = filter($data, function($row) { 
    return $row['device_id'] == 1; 
});

-- ✓ Filter di SQL
SELECT * FROM sensor_data WHERE device_id = 1;
// Atau dengan parameter binding:
$stmt = $pdo->prepare("SELECT * FROM sensor_data WHERE device_id = ?");
$stmt->execute([$device_id]);
```

### 2.4 LIMIT untuk Large Result

```sql
-- ✗ Tanpa limit (ambil jutaan record)
SELECT * FROM sensor_data;

-- ✓ Dengan limit & pagination
SELECT * FROM sensor_data 
WHERE device_id = 1 
ORDER BY timestamp DESC 
LIMIT 100 OFFSET 0;

-- Page 1
SELECT * FROM sensor_data 
WHERE device_id = 1 
ORDER BY timestamp DESC 
LIMIT 100;

-- Page 2
SELECT * FROM sensor_data 
WHERE device_id = 1 
ORDER BY timestamp DESC 
LIMIT 100 OFFSET 100;

-- Page 3
SELECT * FROM sensor_data 
WHERE device_id = 1 
ORDER BY timestamp DESC 
LIMIT 100 OFFSET 200;
```

---

## 🔄 3. Batch Operations

### 3.1 Batch Insert (sudah di kode UNIOT!)

```sql
-- ✗ SLOW - Insert satu per satu (7 queries)
INSERT INTO sensor_data VALUES (1, 'temp', '25.5', NOW());
INSERT INTO sensor_data VALUES (1, 'temp', '25.6', NOW());
INSERT INTO sensor_data VALUES (1, 'temp', '25.7', NOW());
-- ... 7 total

-- ✓ FAST - Batch insert dalam 1 query
INSERT INTO sensor_data VALUES 
(1, 'temp', '25.5', NOW()),
(1, 'temp', '25.6', NOW()),
(1, 'temp', '25.7', NOW()),
...
(1, 'temp', '25.9', NOW());

-- Performance boost: 5-10x lebih cepat!

-- Di UNIOT code (SensorDataBuffer):
-- Batch setiap 2 detik atau 100 records
// Performa: ~5000 records/detik vs 500 records/detik
```

### 3.2 Batch Update

```sql
-- ✗ Update satu per satu
UPDATE widgets SET current_value = '25.5' WHERE widget_id = 1;
UPDATE widgets SET current_value = '65.2' WHERE widget_id = 2;
UPDATE widgets SET current_value = '120' WHERE widget_id = 3;

-- ✓ Update dengan CASE (lebih cepat)
UPDATE widgets 
SET current_value = CASE widget_id
    WHEN 1 THEN '25.5'
    WHEN 2 THEN '65.2'
    WHEN 3 THEN '120'
END
WHERE widget_id IN (1, 2, 3);
```

### 3.3 Batch Delete (dengan caution!)

```sql
-- ✗ Unsafe - delete without backup
DELETE FROM sensor_data 
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- ✓ Safe - delete dengan transaction & backup
START TRANSACTION;

-- Backup dulu (optional tapi recommended)
CREATE TABLE sensor_data_backup_2026_05 AS
SELECT * FROM sensor_data 
WHERE timestamp >= '2026-05-01' AND timestamp < '2026-06-01';

-- Baru delete
DELETE FROM sensor_data 
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Verify baru commit
SELECT COUNT(*) FROM sensor_data;
COMMIT;
```

---

## 💾 4. Database Partitioning (untuk dataset besar)

Jika sensor_data sudah > 10 juta records, pertimbangkan partitioning.

### 4.1 Partition by Month

```sql
-- Recreate sensor_data dengan monthly partition
CREATE TABLE sensor_data_partitioned (
    data_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,
    sensor_type VARCHAR(100) NOT NULL,
    value VARCHAR(255) NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_device_time (device_id, timestamp),
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
) ENGINE=InnoDB
PARTITION BY RANGE (YEAR_MONTH(timestamp)) (
    PARTITION p202501 VALUES LESS THAN (202502),
    PARTITION p202502 VALUES LESS THAN (202503),
    PARTITION p202503 VALUES LESS THAN (202504),
    PARTITION p202504 VALUES LESS THAN (202505),
    PARTITION p202505 VALUES LESS THAN (202506),
    PARTITION p202506 VALUES LESS THAN (202507),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);

-- Benefit:
-- - Query cepat karena hanya scan partition yang dibutuhkan
-- - Delete old data lebih cepat (drop partition vs delete rows)
-- - Lebih efficient untuk storage
```

### 4.2 Query Partition (automatic)

```sql
-- Query otomatis pakai partition yang tepat
SELECT * FROM sensor_data_partitioned 
WHERE device_id = 1 
  AND timestamp >= '2026-05-01' 
  AND timestamp < '2026-06-01';
-- MySQL hanya scan partition p202505 (lebih cepat!)

-- Lihat info partition
SELECT * FROM INFORMATION_SCHEMA.PARTITIONS 
WHERE TABLE_NAME = 'sensor_data_partitioned';
```

---

## 🗄️ 5. Storage & Memory Optimization

### 5.1 Column Type Selection

```sql
-- ✗ Tidak optimal
CREATE TABLE sensor_data (
    data_id BIGINT,
    device_id INT,
    sensor_type VARCHAR(500),  -- Terlalu panjang!
    value VARCHAR(500),        -- Should be smaller
    timestamp DATETIME
);
-- Storage: ~50 bytes per row

-- ✓ Optimal
CREATE TABLE sensor_data (
    data_id BIGINT,
    device_id INT,
    sensor_type VARCHAR(50),   -- Cukup untuk "temperature", "humidity"
    value VARCHAR(20),         -- Cukup untuk "25.5" atau "1024"
    timestamp DATETIME
);
-- Storage: ~30 bytes per row (40% lebih kecil!)

-- Untuk 10 juta rows:
-- Tidak optimal: 10,000,000 * 50 bytes = 500 MB
-- Optimal:      10,000,000 * 30 bytes = 300 MB (savings: 200 MB!)
```

### 5.2 Data Type Optimization

```sql
-- ✗ Lebih besar
CREATE TABLE devices (
    device_id BIGINT,        -- 8 bytes (overkill)
    user_id BIGINT,          -- 8 bytes (overkill)
    device_type VARCHAR(100) -- Too much choice
);

-- ✓ Lebih kecil
CREATE TABLE devices (
    device_id INT,           -- 4 bytes (max ~2 billion devices)
    user_id INT,             -- 4 bytes (cukup)
    device_type ENUM('sensor', 'actuator', 'hybrid')  -- 1 byte
);
```

### 5.3 Enable Query Cache (jika MySQL < 8.0)

```sql
-- MySQL 5.7 support query cache
-- Check status
SHOW VARIABLES LIKE 'query_cache%';

-- Enable (dalam my.cnf atau my.ini):
/*
[mysqld]
query_cache_type=1
query_cache_size=256M
*/

-- Setelah restart MySQL:
SELECT * FROM sensor_data WHERE device_id = 1;  -- Query cached
SELECT * FROM sensor_data WHERE device_id = 1;  -- Hit cache (instant!)

-- Catatan: MySQL 8.0+ remove query cache (gunakan Redis instead)
```

---

## 🔍 6. Monitoring & Profiling

### 6.1 Slow Query Log

```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;  -- Log query > 2 detik

-- Log location:
-- MySQL: /var/log/mysql/slow.log
-- Windows: C:\ProgramData\MySQL\MySQL Server 8.0\Data\*-slow.log

-- Analyze slow queries
mysqldumpslow /var/log/mysql/slow.log | head -20
```

### 6.2 Performance Schema

```sql
-- Lihat tabel mana yang paling sering diakses
SELECT 
    object_schema,
    object_name,
    count_read,
    count_write,
    ROUND(sum_timer_read / 1000000000, 2) AS total_read_time_sec
FROM performance_schema.table_io_waits_summary_by_table
WHERE object_schema = 'uniot_db'
ORDER BY count_read DESC;

-- Lihat query mana yang paling lambat
SELECT 
    digest_text,
    count_star,
    avg_timer_wait / 1000000000 AS avg_time_sec,
    max_timer_wait / 1000000000 AS max_time_sec
FROM performance_schema.events_statements_summary_by_digest
ORDER BY max_timer_wait DESC
LIMIT 10;
```

### 6.3 EXPLAIN Analysis

```sql
-- Detailed EXPLAIN output
EXPLAIN FORMAT=JSON SELECT * FROM sensor_data 
WHERE device_id = 1 AND timestamp > NOW()-INTERVAL 7 DAY;

-- Output analysis:
{
  "query_block": {
    "select_id": 1,
    "table": {
      "table_name": "sensor_data",
      "access_type": "range",      // ← "range" bagus (vs "ALL")
      "possible_keys": ["idx_device_time"],
      "key": "idx_device_time",    // ← Pakai index
      "key_length": "4,5",
      "rows": 1000,                // ← Rows yang scan
      "filtered": 100
    }
  }
}

// Interpretation:
// "access_type": range = Good! (vs ALL = Bad)
// "key": idx_device_time = Index used ✓
// "rows": 1000 = Only scan 1000 rows (fast!)
```

---

## 🛡️ 7. Backup & Recovery Strategy

### 7.1 Full Backup

```bash
# Backup full database
mysqldump -u root -p uniot_db > backup_full_2026_05_31.sql

# Backup dengan compression
mysqldump -u root -p uniot_db | gzip > backup_full_2026_05_31.sql.gz

# Backup only sensor_data (tabel besar)
mysqldump -u root -p uniot_db sensor_data > backup_sensor_2026_05_31.sql
```

### 7.2 Incremental Backup (Binary Log)

```sql
-- Enable binary logging (dalam my.cnf)
/*
[mysqld]
log_bin = /var/log/mysql/mysql-bin.log
expire_logs_days = 30
binlog_format = ROW
*/

-- Backup binary logs
mysqlbinlog /var/log/mysql/mysql-bin.000001 > incremental_2026_05_31.sql

-- Restore dari full + incremental
mysql -u root -p < backup_full_2026_05_31.sql
mysql -u root -p < incremental_2026_05_31.sql
```

### 7.3 Point-in-Time Recovery

```sql
-- Restore ke waktu tertentu
mysqlbinlog /var/log/mysql/mysql-bin.* \
  --stop-datetime='2026-05-31 10:00:00' \
  | mysql -u root -p
```

---

## ⚙️ 8. Database Configuration (my.cnf / my.ini)

### 8.1 Recommended Settings untuk Development

```ini
[mysqld]
# Memory
max_connections = 200
innodb_buffer_pool_size = 2G      # 50-80% dari system RAM
innodb_log_file_size = 512M

# Performance
slow_query_log = 1
long_query_time = 2
query_cache_size = 256M
query_cache_type = 1

# Logging & Backup
log_bin = /var/log/mysql/mysql-bin.log
expire_logs_days = 30
binlog_format = ROW

# Character set
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
```

### 8.2 Recommended Settings untuk Production

```ini
[mysqld]
# Memory
max_connections = 500
innodb_buffer_pool_size = 8G      # Untuk 10M rows

# Performance
slow_query_log = 1
long_query_time = 0.5              # Stricter
query_cache_size = 512M
innodb_flush_log_at_trx_commit = 2 # Balance safety & speed

# Monitoring
performance_schema = ON
log_queries_not_using_indexes = 1

# Backup
log_bin = /var/log/mysql/mysql-bin.log
expire_logs_days = 60
```

---

## 📈 9. Scaling Strategies

### 9.1 Horizontal Scaling (Multiple Servers)

```
Production Setup:
┌─────────────────────────────────────┐
│         Application Servers         │
│   (Node.js UNIOT - 3 instances)     │
└────────────────────┬────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ MySQL   │  │ MySQL   │  │ MySQL   │
   │ Master  │  │ Slave 1 │  │ Slave 2 │
   │ (Write) │  │ (Read)  │  │ (Read)  │
   └─────────┘  └─────────┘  └─────────┘
        ▲                         ▲
        └─────────────────────────┘
         Master-Slave Replication
```

**Implementation:**
```sql
-- Di Master MySQL:
SHOW MASTER STATUS;

-- Di Slave MySQL:
CHANGE MASTER TO
  MASTER_HOST='192.168.1.10',
  MASTER_USER='repl',
  MASTER_PASSWORD='password',
  MASTER_LOG_FILE='mysql-bin.000001',
  MASTER_LOG_POS=154;

START SLAVE;
```

### 9.2 Read/Write Splitting

```javascript
// Node.js UNIOT - Connection pooling
const mysql = require('mysql2/promise');

// Write pool (Master)
const writePool = mysql.createPool({
    host: 'master-db.example.com',
    user: 'root',
    password: 'password',
    database: 'uniot_db',
    waitForConnections: true,
    connectionLimit: 10
});

// Read pool (Slave)
const readPool = mysql.createPool({
    host: 'slave-db.example.com',
    user: 'root_readonly',
    password: 'password',
    database: 'uniot_db',
    waitForConnections: true,
    connectionLimit: 20
});

// Usage:
app.post('/api/devices', async (req, res) => {
    const conn = await writePool.getConnection();  // Write to Master
    // ... INSERT
});

app.get('/api/devices', async (req, res) => {
    const conn = await readPool.getConnection();   // Read from Slave
    // ... SELECT
});
```

---

## ✅ 10. Performance Checklist untuk Skripsi

- [ ] Index created di kolom frequently queried
- [ ] EXPLAIN analyze run dan optimized
- [ ] Batch insert implemented (sensor_data)
- [ ] Query cache enabled (if MySQL < 8.0)
- [ ] Slow query log analyzed
- [ ] Table sizes monitored
- [ ] Backup strategy documented
- [ ] Performa metrics recorded untuk laporan

---

**Tips:**
- Selalu test performa dengan dataset realista
- Monitor production metrics
- Backup reguler sebelum optimize
- Dokumentasikan semua optimization untuk skripsi

Good luck! 🚀
