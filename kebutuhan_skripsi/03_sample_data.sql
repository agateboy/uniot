-- ============================================================
-- SAMPLE DATA UNTUK TESTING & DOKUMENTASI
-- ============================================================
-- File ini berisi contoh data yang bisa diinsert untuk testing
-- Jangan jalankan di production - hanya untuk development/demo
-- ============================================================

-- ============================================================
-- 1. INSERT SAMPLE USERS
-- ============================================================
INSERT INTO users (username, email, password_hash) VALUES
('admin', 'admin@uniot.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gBUSPm'),
('budi_santoso', 'budi@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gBUSPm'),
('siti_nurhaliza', 'siti@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gBUSPm'),
('agus_wijaya', 'agus@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gBUSPm');

-- Password untuk semua: password123
-- Verify: bcrypt hash untuk "password123"

-- ============================================================
-- 2. INSERT SAMPLE DEVICES
-- ============================================================
INSERT INTO devices (user_id, device_name, api_key, secret_key, public_slug, device_type, status, location) VALUES
-- Devices untuk user admin (user_id=1)
(1, 'Sensor Ruang 1', 'key_admin_sensor1', 'secret_admin_sensor1', 'ruang-1', 'sensor', 'active', 'Gedung A, Lantai 1'),
(1, 'Sensor Ruang 2', 'key_admin_sensor2', 'secret_admin_sensor2', 'ruang-2', 'sensor', 'active', 'Gedung A, Lantai 2'),
(1, 'Relay Pump', 'key_admin_pump', 'secret_admin_pump', 'pump-1', 'actuator', 'active', 'Ruang Mesin'),

-- Devices untuk user budi (user_id=2)
(2, 'Sensor Kebun', 'key_budi_kebun', 'secret_budi_kebun', 'kebunku', 'hybrid', 'active', 'Rumah Budi, Tangerang'),
(2, 'Soil Moisture', 'key_budi_soil', 'secret_budi_soil', NULL, 'sensor', 'inactive', 'Area Tanam 1'),

-- Devices untuk user siti (user_id=3)
(3, 'AC Monitor', 'key_siti_ac', 'secret_siti_ac', 'ac-kantor', 'sensor', 'active', 'Kantor, Ruang AC'),
(3, 'Power Meter', 'key_siti_power', 'secret_siti_power', NULL, 'sensor', 'maintenance', 'Ruang Listrik');

-- ============================================================
-- 3. INSERT SAMPLE WIDGETS
-- ============================================================
INSERT INTO widgets (user_id, device_id, sensor_type, widget_type, data_type, current_value, min_value, max_value, unit) VALUES
-- Widgets for "Sensor Ruang 1" (device_id=1)
(1, 1, 'temperature', 'number', 'float', '25.5', 15, 40, '°C'),
(1, 1, 'humidity', 'number', 'float', '65.2', 0, 100, '%'),
(1, 1, 'air_quality', 'gauge', 'integer', '120', 0, 500, 'ppm'),

-- Widgets for "Sensor Ruang 2" (device_id=2)
(1, 2, 'temperature', 'number', 'float', '24.8', 15, 40, '°C'),
(1, 2, 'humidity', 'number', 'float', '68.1', 0, 100, '%'),

-- Widgets for "Relay Pump" (device_id=3)
(1, 3, 'relay1', 'toggle', 'boolean', 'false', NULL, NULL, NULL),
(1, 3, 'pump_speed', 'slider', 'integer', '0', 0, 255, 'PWM'),

-- Widgets for "Sensor Kebun" (device_id=4)
(2, 4, 'temperature', 'number', 'float', '31.2', 20, 45, '°C'),
(2, 4, 'humidity', 'number', 'float', '72.5', 0, 100, '%'),
(2, 4, 'soil_moisture', 'gauge', 'integer', '580', 0, 1024, 'ADC'),
(2, 4, 'sprinkler', 'toggle', 'boolean', 'false', NULL, NULL, NULL),

-- Widgets for "AC Monitor" (device_id=6)
(3, 6, 'temperature', 'number', 'float', '22.1', 18, 28, '°C'),
(3, 6, 'humidity', 'number', 'float', '45.0', 30, 60, '%'),
(3, 6, 'compressor_status', 'toggle', 'boolean', 'true', NULL, NULL, NULL);

-- ============================================================
-- 4. INSERT SAMPLE SENSOR DATA (Historis 7 hari)
-- ============================================================
-- Untuk testing query dan grafik
-- Gunakan script generate data otomatis untuk dataset besar

INSERT INTO sensor_data (device_id, sensor_type, value, timestamp) VALUES
-- Data Ruang 1 - Temperature (hari ini)
(1, 'temperature', '22.5', DATE_SUB(NOW(), INTERVAL 0 HOUR)),
(1, 'temperature', '23.1', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(1, 'temperature', '24.2', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(1, 'temperature', '25.5', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(1, 'temperature', '26.1', DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(1, 'temperature', '25.8', DATE_SUB(NOW(), INTERVAL 5 HOUR)),
(1, 'temperature', '25.2', DATE_SUB(NOW(), INTERVAL 6 HOUR)),

-- Data Ruang 1 - Humidity (hari ini)
(1, 'humidity', '58.5', DATE_SUB(NOW(), INTERVAL 0 HOUR)),
(1, 'humidity', '61.2', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(1, 'humidity', '63.8', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(1, 'humidity', '65.2', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(1, 'humidity', '64.5', DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(1, 'humidity', '63.1', DATE_SUB(NOW(), INTERVAL 5 HOUR)),
(1, 'humidity', '62.0', DATE_SUB(NOW(), INTERVAL 6 HOUR)),

-- Data Ruang 1 - Air Quality (hari ini)
(1, 'air_quality', '95', DATE_SUB(NOW(), INTERVAL 0 HOUR)),
(1, 'air_quality', '102', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(1, 'air_quality', '110', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(1, 'air_quality', '120', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(1, 'air_quality', '118', DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(1, 'air_quality', '115', DATE_SUB(NOW(), INTERVAL 5 HOUR)),
(1, 'air_quality', '108', DATE_SUB(NOW(), INTERVAL 6 HOUR)),

-- Data Kebun - Temperature (minggu lalu)
(4, 'temperature', '28.5', DATE_SUB(NOW(), INTERVAL 24 HOUR)),
(4, 'temperature', '29.2', DATE_SUB(NOW(), INTERVAL 48 HOUR)),
(4, 'temperature', '30.1', DATE_SUB(NOW(), INTERVAL 72 HOUR)),
(4, 'temperature', '31.2', DATE_SUB(NOW(), INTERVAL 96 HOUR)),
(4, 'temperature', '30.8', DATE_SUB(NOW(), INTERVAL 120 HOUR)),

-- Data Kebun - Soil Moisture (minggu lalu)
(4, 'soil_moisture', '420', DATE_SUB(NOW(), INTERVAL 24 HOUR)),
(4, 'soil_moisture', '450', DATE_SUB(NOW(), INTERVAL 48 HOUR)),
(4, 'soil_moisture', '520', DATE_SUB(NOW(), INTERVAL 72 HOUR)),
(4, 'soil_moisture', '580', DATE_SUB(NOW(), INTERVAL 96 HOUR)),
(4, 'soil_moisture', '610', DATE_SUB(NOW(), INTERVAL 120 HOUR));

-- ============================================================
-- 5. INSERT SAMPLE ALERTS
-- ============================================================
INSERT INTO alerts (device_id, sensor_type, condition, threshold, is_active) VALUES
-- Alert untuk Ruang 1
(1, 'temperature', '>', 30, TRUE),
(1, 'temperature', '<', 18, TRUE),
(1, 'humidity', '>', 80, TRUE),
(1, 'humidity', '<', 30, FALSE),
(1, 'air_quality', '>', 300, TRUE),

-- Alert untuk Kebun Budi
(4, 'temperature', '>', 40, TRUE),
(4, 'soil_moisture', '<', 300, TRUE),
(4, 'humidity', '<', 40, FALSE),

-- Alert untuk AC Kantor
(6, 'temperature', '>', 26, TRUE),
(6, 'temperature', '<', 20, TRUE),
(6, 'humidity', '>', 70, TRUE);

-- ============================================================
-- 6. INSERT SAMPLE ACTIVITY LOGS
-- ============================================================
INSERT INTO activity_logs (user_id, action, details, ip_address, timestamp) VALUES
(1, 'login', JSON_OBJECT('browser', 'Chrome', 'os', 'Windows 10'), '192.168.1.100', DATE_SUB(NOW(), INTERVAL 0 HOUR)),
(1, 'create_device', JSON_OBJECT('device_name', 'Sensor Ruang 1', 'device_id', 1), '192.168.1.100', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, 'update_widget', JSON_OBJECT('widget_id', 1, 'old_value', '0', 'new_value', '25.5'), '192.168.1.100', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 'login', JSON_OBJECT('browser', 'Firefox', 'os', 'Ubuntu'), '10.0.0.50', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(2, 'create_device', JSON_OBJECT('device_name', 'Sensor Kebun', 'device_id', 4), '10.0.0.50', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(3, 'login', JSON_OBJECT('browser', 'Safari', 'os', 'iOS'), '203.0.113.25', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(3, 'send_command', JSON_OBJECT('device_id', 6, 'command', 'AC_OFF'), '203.0.113.25', DATE_SUB(NOW(), INTERVAL 30 MINUTE));

-- ============================================================
-- 7. INSERT SAMPLE CONTROL COMMANDS
-- ============================================================
INSERT INTO control_commands (device_id, user_id, sensor_type, command_value, status, created_at, executed_at) VALUES
-- Command untuk pump (relay1)
(3, 1, 'relay1', 'ON', 'executed', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR 55 MINUTE)),
(3, 1, 'relay1', 'OFF', 'executed', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 55 MINUTE)),
(3, 1, 'pump_speed', 'PWM:150', 'sent', NOW(), NULL),

-- Command untuk sprinkler (kebun)
(4, 2, 'sprinkler', 'ON', 'executed', DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR 50 MINUTE)),
(4, 2, 'sprinkler', 'OFF', 'executed', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR 55 MINUTE)),

-- Command untuk AC
(6, 3, 'compressor_status', 'ON', 'pending', NOW(), NULL);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verifikasi 1: Total data yang diinsert
SELECT 
    'users' AS table_name, COUNT(*) AS total_records FROM users
UNION ALL
SELECT 'devices', COUNT(*) FROM devices
UNION ALL
SELECT 'widgets', COUNT(*) FROM widgets
UNION ALL
SELECT 'sensor_data', COUNT(*) FROM sensor_data
UNION ALL
SELECT 'alerts', COUNT(*) FROM alerts
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL
SELECT 'control_commands', COUNT(*) FROM control_commands;

-- Verifikasi 2: Lihat data user dengan devices
SELECT 
    u.username,
    COUNT(d.device_id) AS total_devices,
    GROUP_CONCAT(d.device_name SEPARATOR ', ') AS device_names
FROM users u
LEFT JOIN devices d ON u.user_id = d.user_id
GROUP BY u.user_id, u.username;

-- Verifikasi 3: Lihat latest sensor data
SELECT 
    d.device_name,
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
)
ORDER BY d.device_name, sd.sensor_type;

-- ============================================================
-- END OF SAMPLE DATA
-- ============================================================
