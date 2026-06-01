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

+---------+-----------+---------------+-------+---------------------+
| data_id | device_id | sensor_type   | value | timestamp           |
+---------+-----------+---------------+-------+---------------------+
|   26962 |         2 | pwm-led       | 72    | 2026-05-31 16:49:02 |
|   26961 |         2 | kondisi-led   | true  | 2026-05-31 16:48:52 |
|   26960 |         2 | pwm-led       | 50    | 2026-05-31 16:43:37 |
|   26959 |         2 | kondisi-led   | true  | 2026-05-31 16:41:21 |
|   26958 |         2 | potensiometer | 100   | 2026-05-31 16:37:50 |
|   26957 |         2 | potensiometer | 80    | 2026-05-31 16:37:45 |
|   26956 |         2 | kelembapan    | 80    | 2026-05-31 16:35:20 |
|   26955 |         2 | kelembapan    | 80    | 2026-05-31 16:35:19 |
|   26954 |         2 | suhu          | 25    | 2026-05-31 16:32:42 |
|   26953 |         2 | suhu          | 27    | 2026-05-31 16:23:09 |
+---------+-----------+---------------+-------+---------------------+


