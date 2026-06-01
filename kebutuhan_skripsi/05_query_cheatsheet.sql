-- ============================================================
-- QUERY CHEATSHEET - Kumpulan Query Berguna untuk UNIOT
-- ============================================================
-- File ini berisi template query yang sering digunakan
-- Gunakan untuk development & testing
-- ============================================================

-- ============================================================
-- SECTION 1: DATA RETRIEVAL - Query Pengambilan Data
-- ============================================================

-- 1.1 Lihat semua data user
SELECT user_id, username, email, created_at 
FROM users
ORDER BY created_at DESC;

-- 1.2 Lihat semua device milik user tertentu
SELECT 
    device_id,
    device_name,
    device_type,
    status,
    location,
    created_at
FROM devices
WHERE user_id = 1
ORDER BY created_at DESC;

-- 1.3 Lihat data sensor terkini (latest value per device)
SELECT 
    d.device_id,
    d.device_name,
    sd.sensor_type,
    sd.value,
    w.unit,
    sd.timestamp AS last_update
FROM sensor_data sd
INNER JOIN devices d ON sd.device_id = d.device_id
LEFT JOIN widgets w ON d.device_id = w.device_id AND sd.sensor_type = w.sensor_type
WHERE (sd.device_id, sd.timestamp) IN (
    SELECT device_id, MAX(timestamp)
    FROM sensor_data
    GROUP BY device_id
)
ORDER BY d.device_id, sd.sensor_type;

-- 1.4 Lihat semua widget beserta nilai terkini
SELECT 
    w.widget_id,
    d.device_name,
    w.sensor_type,
    w.widget_type,
    w.data_type,
    w.current_value,
    w.unit,
    w.min_value,
    w.max_value
FROM widgets w
INNER JOIN devices d ON w.device_id = d.device_id
WHERE w.user_id = 1
ORDER BY d.device_name, w.sensor_type;

-- 1.5 Lihat data sensor 7 hari terakhir untuk device tertentu
SELECT 
    sd.timestamp,
    sd.sensor_type,
    sd.value
FROM sensor_data sd
WHERE sd.device_id = 1
    AND sd.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY sd.timestamp DESC;

-- 1.6 Lihat alert yang aktif
SELECT 
    a.alert_id,
    d.device_name,
    a.sensor_type,
    a.condition,
    a.threshold,
    a.is_active
FROM alerts a
INNER JOIN devices d ON a.device_id = d.device_id
WHERE a.is_active = TRUE
ORDER BY d.device_name, a.sensor_type;

-- 1.7 Lihat activity log user dalam 30 hari terakhir
SELECT 
    log_id,
    action,
    details,
    ip_address,
    timestamp
FROM activity_logs
WHERE user_id = 1
    AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY timestamp DESC;

-- ============================================================
-- SECTION 2: AGGREGATION & STATISTICS
-- ============================================================

-- 2.1 Rata-rata sensor per jam (untuk graph)
SELECT 
    DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') AS hour,
    sensor_type,
    COUNT(*) AS data_points,
    AVG(CAST(value AS DECIMAL(10,2))) AS avg_value,
    MAX(CAST(value AS DECIMAL(10,2))) AS max_value,
    MIN(CAST(value AS DECIMAL(10,2))) AS min_value,
    STDDEV(CAST(value AS DECIMAL(10,2))) AS std_dev
FROM sensor_data
WHERE device_id = 1
    AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY hour, sensor_type
ORDER BY hour DESC;

-- 2.2 Rata-rata sensor per hari (daily average)
SELECT 
    DATE(timestamp) AS date,
    sensor_type,
    AVG(CAST(value AS DECIMAL(10,2))) AS avg_value,
    MAX(CAST(value AS DECIMAL(10,2))) AS max_value,
    MIN(CAST(value AS DECIMAL(10,2))) AS min_value,
    COUNT(*) AS samples
FROM sensor_data
WHERE device_id = 1
GROUP BY DATE(timestamp), sensor_type
ORDER BY date DESC;

-- 2.3 Total data points per sensor
SELECT 
    sensor_type,
    COUNT(*) AS total_readings,
    MAX(timestamp) AS last_reading,
    MIN(timestamp) AS first_reading,
    DATEDIFF(MAX(timestamp), MIN(timestamp)) AS days_span
FROM sensor_data
WHERE device_id = 1
GROUP BY sensor_type;

-- 2.4 Statistik per user (admin summary)
SELECT 
    u.username,
    COUNT(DISTINCT d.device_id) AS total_devices,
    COUNT(DISTINCT sd.data_id) AS total_readings,
    MAX(sd.timestamp) AS last_data,
    MIN(sd.timestamp) AS first_data,
    COUNT(DISTINCT a.alert_id) AS total_alerts
FROM users u
LEFT JOIN devices d ON u.user_id = d.user_id
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id
LEFT JOIN alerts a ON d.device_id = a.device_id
GROUP BY u.user_id, u.username
ORDER BY total_devices DESC;

-- 2.5 Device dengan aktivitas tinggi (busy devices)
SELECT 
    d.device_id,
    d.device_name,
    COUNT(sd.data_id) AS total_readings,
    COUNT(DISTINCT sd.sensor_type) AS sensor_count,
    MAX(sd.timestamp) AS last_update
FROM devices d
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id
WHERE sd.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY d.device_id
ORDER BY total_readings DESC
LIMIT 10;

-- ============================================================
-- SECTION 3: TIME SERIES ANALYSIS
-- ============================================================

-- 3.1 Trend detection (data naik/turun)
SELECT 
    DATE(timestamp) AS date,
    sensor_type,
    AVG(CAST(value AS DECIMAL(10,2))) AS daily_avg,
    LAG(AVG(CAST(value AS DECIMAL(10,2)))) 
        OVER (PARTITION BY sensor_type ORDER BY DATE(timestamp)) AS prev_day_avg,
    ROUND(
        (AVG(CAST(value AS DECIMAL(10,2))) - 
         LAG(AVG(CAST(value AS DECIMAL(10,2)))) 
         OVER (PARTITION BY sensor_type ORDER BY DATE(timestamp))) / 
        LAG(AVG(CAST(value AS DECIMAL(10,2)))) 
        OVER (PARTITION BY sensor_type ORDER BY DATE(timestamp)) * 100, 2
    ) AS percent_change
FROM sensor_data
WHERE device_id = 1
GROUP BY DATE(timestamp), sensor_type
ORDER BY date DESC;

-- 3.2 Alert triggered count (berapa kali sensor exceed threshold)
SELECT 
    a.alert_id,
    a.sensor_type,
    a.condition,
    a.threshold,
    COUNT(sd.data_id) AS times_exceeded,
    MAX(sd.timestamp) AS last_triggered
FROM alerts a
LEFT JOIN sensor_data sd ON a.device_id = sd.device_id 
    AND a.sensor_type = sd.sensor_type
    AND CASE 
        WHEN a.condition = '>' THEN CAST(sd.value AS DECIMAL(10,2)) > a.threshold
        WHEN a.condition = '<' THEN CAST(sd.value AS DECIMAL(10,2)) < a.threshold
        WHEN a.condition = '=' THEN CAST(sd.value AS DECIMAL(10,2)) = a.threshold
        WHEN a.condition = '!=' THEN CAST(sd.value AS DECIMAL(10,2)) != a.threshold
        ELSE FALSE
    END
    AND sd.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
WHERE a.device_id = 1
GROUP BY a.alert_id, a.sensor_type
ORDER BY times_exceeded DESC;

-- 3.3 Missing data detection (data gaps)
SELECT 
    sd1.device_id,
    sd1.sensor_type,
    sd1.timestamp AS last_data,
    sd2.timestamp AS next_data,
    TIMESTAMPDIFF(MINUTE, sd1.timestamp, sd2.timestamp) AS gap_minutes
FROM sensor_data sd1
LEFT JOIN sensor_data sd2 ON 
    sd1.device_id = sd2.device_id 
    AND sd1.sensor_type = sd2.sensor_type
    AND sd1.timestamp < sd2.timestamp
WHERE sd1.device_id = 1
    AND sd1.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    AND TIMESTAMPDIFF(MINUTE, sd1.timestamp, sd2.timestamp) > 5
ORDER BY gap_minutes DESC;

-- ============================================================
-- SECTION 4: CONTROL COMMANDS - Query Perintah
-- ============================================================

-- 4.1 Lihat semua perintah yang pending (belum diexecute)
SELECT 
    cc.command_id,
    d.device_name,
    cc.sensor_type,
    cc.command_value,
    cc.status,
    cc.created_at
FROM control_commands cc
INNER JOIN devices d ON cc.device_id = d.device_id
WHERE cc.status = 'pending'
ORDER BY cc.created_at ASC;

-- 4.2 Lihat history perintah per device
SELECT 
    command_id,
    user_id,
    sensor_type,
    command_value,
    status,
    created_at,
    executed_at,
    TIMESTAMPDIFF(SECOND, created_at, executed_at) AS execution_time_sec
FROM control_commands
WHERE device_id = 1
ORDER BY created_at DESC
LIMIT 50;

-- 4.3 Lihat failed commands
SELECT 
    cc.command_id,
    d.device_name,
    cc.sensor_type,
    cc.command_value,
    cc.created_at,
    cc.executed_at
FROM control_commands cc
INNER JOIN devices d ON cc.device_id = d.device_id
WHERE cc.status = 'failed'
    AND cc.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY cc.created_at DESC;

-- 4.4 Command success rate per device (dalam 30 hari)
SELECT 
    d.device_id,
    d.device_name,
    COUNT(*) AS total_commands,
    SUM(IF(cc.status = 'executed', 1, 0)) AS executed,
    SUM(IF(cc.status = 'failed', 1, 0)) AS failed,
    ROUND(
        SUM(IF(cc.status = 'executed', 1, 0)) / COUNT(*) * 100, 2
    ) AS success_rate
FROM control_commands cc
INNER JOIN devices d ON cc.device_id = d.device_id
WHERE cc.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY d.device_id
ORDER BY success_rate DESC;

-- ============================================================
-- SECTION 5: UPDATE & MODIFY - Modifikasi Data
-- ============================================================

-- 5.1 Update nilai terkini widget (mimic real-time update)
UPDATE widgets
SET current_value = '25.5', updated_at = NOW()
WHERE widget_id = 1;

-- 5.2 Enable/disable alert
UPDATE alerts
SET is_active = FALSE, updated_at = NOW()
WHERE alert_id = 1;

-- 5.3 Update status device menjadi inactive
UPDATE devices
SET status = 'inactive', updated_at = NOW()
WHERE device_id = 1;

-- 5.4 Mark command as executed
UPDATE control_commands
SET status = 'executed', executed_at = NOW()
WHERE command_id = 1;

-- 5.5 Bulk update: set semua alert active untuk device tertentu
UPDATE alerts
SET is_active = TRUE, updated_at = NOW()
WHERE device_id = 1;

-- ============================================================
-- SECTION 6: DELETE & CLEANUP - Penghapusan Data
-- ============================================================

-- 6.1 Delete device (cascade akan delete widgets, sensor_data, alerts)
DELETE FROM devices
WHERE device_id = 1;

-- 6.2 Delete old sensor data (cleanup untuk database besar)
DELETE FROM sensor_data
WHERE device_id = 1
    AND timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- 6.3 Delete failed commands older than 30 days
DELETE FROM control_commands
WHERE status = 'failed'
    AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- 6.4 Delete activity logs older than 6 months (untuk privacy)
DELETE FROM activity_logs
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 180 DAY);

-- 6.5 Delete widget
DELETE FROM widgets
WHERE widget_id = 1;

-- ============================================================
-- SECTION 7: DATABASE MAINTENANCE
-- ============================================================

-- 7.1 Check table sizes
SELECT 
    table_name,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb,
    table_rows,
    ROUND(data_length / 1024 / 1024, 2) AS data_mb,
    ROUND(index_length / 1024 / 1024, 2) AS index_mb
FROM information_schema.tables
WHERE table_schema = 'uniot_db'
ORDER BY (data_length + index_length) DESC;

-- 7.2 Check index usage
SELECT 
    object_schema,
    object_name,
    index_name,
    count_read,
    count_write,
    count_delete,
    count_update
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE object_schema = 'uniot_db'
ORDER BY count_read DESC;

-- 7.3 Optimize table (defrag)
OPTIMIZE TABLE users, devices, widgets, sensor_data, alerts;

-- 7.4 Analyze table (update index statistics)
ANALYZE TABLE users, devices, widgets, sensor_data, alerts;

-- 7.5 Check for duplicates
SELECT 
    device_id,
    sensor_type,
    COUNT(*) AS duplicate_count
FROM sensor_data
GROUP BY device_id, sensor_type
HAVING COUNT(*) > 1;

-- ============================================================
-- SECTION 8: BACKUP & EXPORT
-- ============================================================

-- 8.1 Export sensor data ke CSV
SELECT * FROM sensor_data
WHERE device_id = 1
    AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
INTO OUTFILE '/var/lib/mysql-files/sensor_export.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- 8.2 Export user activity logs ke CSV
SELECT * FROM activity_logs
WHERE user_id = 1
INTO OUTFILE '/var/lib/mysql-files/activity_logs.csv'
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n';

-- 8.3 Backup via command line (jalankan di terminal, bukan MySQL prompt):
-- mysqldump -u root -p uniot_db > backup_uniot_2026_05_31.sql

-- ============================================================
-- SECTION 9: USEFUL VIEW - Simpan Query sebagai VIEW
-- ============================================================

-- 9.1 View: Latest data per device per sensor
CREATE OR REPLACE VIEW v_latest_sensor_data AS
SELECT 
    d.device_id,
    d.device_name,
    d.user_id,
    sd.sensor_type,
    sd.value,
    w.unit,
    sd.timestamp
FROM sensor_data sd
INNER JOIN devices d ON sd.device_id = d.device_id
LEFT JOIN widgets w ON d.device_id = w.device_id AND sd.sensor_type = w.sensor_type
WHERE (sd.device_id, sd.timestamp) IN (
    SELECT device_id, MAX(timestamp)
    FROM sensor_data
    GROUP BY device_id
);

-- Gunakan VIEW:
SELECT * FROM v_latest_sensor_data WHERE device_id = 1;

-- 9.2 View: User dashboard summary
CREATE OR REPLACE VIEW v_user_dashboard AS
SELECT 
    u.user_id,
    u.username,
    COUNT(DISTINCT d.device_id) AS device_count,
    COUNT(DISTINCT w.widget_id) AS widget_count,
    COUNT(DISTINCT sd.data_id) AS sensor_readings,
    MAX(sd.timestamp) AS last_update
FROM users u
LEFT JOIN devices d ON u.user_id = d.user_id
LEFT JOIN widgets w ON u.user_id = w.user_id
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id
GROUP BY u.user_id;

-- ============================================================
-- SECTION 10: PERFORMANCE TESTING
-- ============================================================

-- 10.1 Test query speed dengan 100K records
-- Generate random data terlebih dahulu, kemudian:
SELECT SQL_NO_CACHE *
FROM sensor_data
WHERE device_id = 1 AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY timestamp DESC
LIMIT 1000;

-- Check execution plan
EXPLAIN SELECT * FROM sensor_data WHERE device_id = 1 
    AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 10.2 Compare dengan & tanpa index
-- Query tanpa index (slow):
SELECT * FROM sensor_data WHERE sensor_type = 'temperature' LIMIT 1000;

-- Query dengan index (fast):
SELECT * FROM sensor_data WHERE device_id = 1 AND timestamp >= NOW()-INTERVAL 7 DAY;

-- ============================================================
-- END OF QUERY CHEATSHEET
-- ============================================================
