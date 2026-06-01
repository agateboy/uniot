-- ============================================================
-- DATABASE SCHEMA UNTUK PLATFORM UNIOT
-- Compatible dengan MySQL 5.7+
-- ============================================================

-- Pilih/Buat Database
CREATE DATABASE IF NOT EXISTS uniot_db;
USE uniot_db;

-- ============================================================
-- TABEL 1: USERS (User Authentication & Management)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL COMMENT 'Nama pengguna untuk login',
    email VARCHAR(100) UNIQUE NOT NULL COMMENT 'Email pengguna',
    password_hash VARCHAR(255) NOT NULL COMMENT 'Hash password (bcrypt)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu akun dibuat',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Waktu update terakhir',
    
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabel pengguna/akun aplikasi';

-- ============================================================
-- TABEL 2: DEVICES (IoT Devices Management)
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
    device_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT 'Pemilik device',
    device_name VARCHAR(100) NOT NULL COMMENT 'Nama device (contoh: Sensor Ruang 1)',
    api_key VARCHAR(255) UNIQUE NOT NULL COMMENT 'API Key untuk akses REST',
    secret_key VARCHAR(255) UNIQUE NOT NULL COMMENT 'Secret Key untuk WebSocket',
    public_slug VARCHAR(100) UNIQUE COMMENT 'Custom URL untuk public view (contoh: kebunku)',
    device_type ENUM('sensor', 'actuator', 'hybrid') DEFAULT 'hybrid' COMMENT 'Tipe device',
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active' COMMENT 'Status device',
    location VARCHAR(255) COMMENT 'Lokasi fisik perangkat',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu device terdaftar',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Waktu update terakhir',
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_slug (public_slug),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabel perangkat IoT yang terhubung';

-- ============================================================
-- TABEL 3: WIDGETS (UI Components untuk Dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS widgets (
    widget_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT 'Pemilik widget',
    device_id INT NOT NULL COMMENT 'Device yang dipantau',
    sensor_type VARCHAR(100) NOT NULL COMMENT 'Tipe sensor (contoh: temperature, humidity)',
    widget_type ENUM('number', 'toggle', 'slider', 'gauge', 'chart') NOT NULL 
        COMMENT 'Tipe tampilan: number=angka, toggle=saklar, slider=penggeser, gauge=jarum, chart=grafik',
    data_type ENUM('float', 'integer', 'boolean', 'string') NOT NULL 
        COMMENT 'Tipe data nilai yang ditampilkan',
    current_value VARCHAR(255) COMMENT 'Nilai terkini sensor',
    min_value FLOAT COMMENT 'Nilai minimum (untuk validasi/display)',
    max_value FLOAT COMMENT 'Nilai maksimum (untuk validasi/display)',
    unit VARCHAR(50) COMMENT 'Satuan pengukuran (contoh: °C, %, mL/min)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu widget dibuat',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Waktu update terakhir',
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_user_id (user_id),
    INDEX idx_sensor_type (sensor_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabel widget/komponen UI untuk dashboard';

-- ============================================================
-- TABEL 4: SENSOR_DATA (Time Series Data - Data Historis)
-- ============================================================
CREATE TABLE IF NOT EXISTS sensor_data (
    data_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL COMMENT 'Device sumber data',
    sensor_type VARCHAR(100) NOT NULL COMMENT 'Tipe sensor',
    value VARCHAR(255) NOT NULL COMMENT 'Nilai sensor (disimpan sebagai string untuk fleksibilitas)',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu data diterima',
    
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    INDEX idx_device_time (device_id, timestamp),
    INDEX idx_sensor_time (sensor_type, timestamp),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabel data sensor (time series) untuk historis dan analisis';

-- ============================================================
-- TABEL 5: ALERTS (Sistem Alert/Notifikasi)
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
    alert_id INT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL COMMENT 'Device yang dipantau',
    sensor_type VARCHAR(100) COMMENT 'Tipe sensor untuk alert',
    condition VARCHAR(50) COMMENT 'Kondisi alert (contoh: >, <, ==, !=)',
    threshold FLOAT COMMENT 'Nilai ambang alert',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Status alert aktif/nonaktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu alert dibuat',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Waktu update terakhir',
    
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabel konfigurasi alert/notifikasi sensor';

-- ============================================================
-- TABEL 6: ACTIVITY_LOGS (Audit Trail & Logging)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT 'User yang melakukan action',
    action VARCHAR(255) NOT NULL COMMENT 'Jenis aksi (contoh: login, update_device, send_command)',
    details JSON COMMENT 'Detail tambahan dalam format JSON',
    ip_address VARCHAR(45) COMMENT 'IP address pengguna',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu aksi terjadi',
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_time (user_id, timestamp),
    INDEX idx_action (action),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabel audit trail untuk logging aktivitas pengguna';

-- ============================================================
-- TABEL 7: CONTROL_COMMANDS (Untuk Actuator Control)
-- ============================================================
CREATE TABLE IF NOT EXISTS control_commands (
    command_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL COMMENT 'Device target',
    user_id INT NOT NULL COMMENT 'User yang mengirim perintah',
    sensor_type VARCHAR(100) NOT NULL COMMENT 'Aktuator target',
    command_value VARCHAR(255) NOT NULL COMMENT 'Nilai/perintah yang dikirim',
    status ENUM('pending', 'sent', 'executed', 'failed') DEFAULT 'pending' COMMENT 'Status eksekusi',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu perintah dibuat',
    executed_at TIMESTAMP NULL COMMENT 'Waktu perintah dieksekusi',
    
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabel perintah kontrol untuk aktuator (relay, motor, dll)';

-- ============================================================
-- VIEWS (Optional - untuk query common)
-- ============================================================

-- View: Latest sensor data per device
CREATE OR REPLACE VIEW v_latest_sensor_data AS
SELECT 
    d.device_id,
    d.device_name,
    d.user_id,
    sd.sensor_type,
    sd.value,
    sd.timestamp,
    w.widget_type,
    w.unit
FROM sensor_data sd
INNER JOIN devices d ON sd.device_id = d.device_id
LEFT JOIN widgets w ON d.device_id = w.device_id AND sd.sensor_type = w.sensor_type
WHERE (sd.device_id, sd.timestamp) IN (
    SELECT device_id, MAX(timestamp)
    FROM sensor_data
    GROUP BY device_id
);

-- View: Device statistics
CREATE OR REPLACE VIEW v_device_statistics AS
SELECT 
    d.device_id,
    d.device_name,
    d.user_id,
    COUNT(DISTINCT sd.data_id) AS total_data_points,
    COUNT(DISTINCT sd.sensor_type) AS total_sensors,
    MAX(sd.timestamp) AS last_data_received,
    MIN(sd.timestamp) AS first_data_recorded
FROM devices d
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id
GROUP BY d.device_id;

-- ============================================================
-- STORED PROCEDURES (Optional - untuk operasi kompleks)
-- ============================================================

-- Procedure: Get sensor data range
DELIMITER //
CREATE PROCEDURE sp_get_sensor_range(
    IN p_device_id INT,
    IN p_sensor_type VARCHAR(100),
    IN p_start_date DATETIME,
    IN p_end_date DATETIME
)
BEGIN
    SELECT 
        sensor_type,
        value,
        timestamp
    FROM sensor_data
    WHERE device_id = p_device_id 
        AND sensor_type = p_sensor_type
        AND timestamp BETWEEN p_start_date AND p_end_date
    ORDER BY timestamp ASC;
END //
DELIMITER ;

-- ============================================================
-- INDEXES SUMMARY
-- ============================================================
-- idx_device_time: Query cepat sensor_data by device + waktu
-- idx_sensor_time: Query cepat sensor_data by sensor type + waktu
-- idx_timestamp: Query cepat data historis
-- idx_user_id: Akses semua data user
-- idx_status: Filter device aktif/nonaktif

-- ============================================================
-- PERFORMANCE TUNING RECOMMENDATIONS
-- ============================================================
/*
1. Untuk sensor_data dengan volume besar (jutaan record):
   - Pertimbangkan partitioning by month/year
   - SET GLOBAL binlog_format = 'ROW';
   
2. Backup strategy:
   - Daily incremental backup
   - Weekly full backup
   
3. Monitoring:
   - Monitor table size: SELECT table_name, ROUND((data_length+index_length)/1024/1024, 2) AS size_mb FROM information_schema.tables;
   - Monitor query performance: EXPLAIN SELECT ...;
*/

-- ============================================================
-- END OF SCHEMA
-- ============================================================
