# IoT Monitoring Dashboard (Operator Guide)

Dokumen ini ditujukan untuk operator: mulai dari install Node.js sampai aplikasi bisa diakses dari perangkat lain melalui IP dan port.

## 1. Ringkasan

- Backend: Node.js + Express + WebSocket
- Database: **MySQL 8.0** (containerized via Docker, otomatis diinisialisasi)
  - Fallback ke SQLite jika Docker tidak tersedia
- Frontend: file HTML statis yang disajikan langsung oleh server Node.js

**Keuntungan MySQL:**
- Scalable untuk jutaan sensor records
- Production-ready dengan backup built-in
- Compatible dengan berbagai tools monitoring

## 2. Prasyarat

### Wajib:
- Node.js LTS (disarankan versi 18 ke atas)
- NPM (biasanya sudah ikut dengan Node.js)
- Docker & Docker Compose (untuk MySQL containerized)
  - Windows/Mac: Install Docker Desktop
  - Linux: `sudo apt install docker.io docker-compose`

### Opsional:
- Git (jika ambil source dari repository)
- Windows: PowerShell as Administrator (untuk auto-rule firewall)

## 3. Install Docker

### Windows/Mac
Download dan install Docker Desktop dari: https://www.docker.com/products/docker-desktop

Cek instalasi:
```powershell
docker --version
docker-compose --version
```

### Ubuntu/Lubuntu
```bash
sudo apt update
sudo apt install -y docker.io docker-compose
docker --version
docker-compose --version
```

## 4. Install Node.js

### Windows
1. Download Node.js LTS dari https://nodejs.org
2. Run installer dengan Next > Next > Finish
3. Cek di PowerShell:
```powershell
node -v
npm -v
```

### Ubuntu/Lubuntu
```bash
sudo apt update
sudo apt install -y nodejs npm git
node -v
npm -v
```

## 5. Ambil Kode dan Install Dependency

Jika dari git:

```bash
git clone <URL_REPOSITORY_KAMU>
cd uniot
npm install
```

Jika project sudah ada di folder lokal, cukup masuk ke folder project lalu:

```bash
npm install
```

## 6. Jalankan Aplikasi

### Cara Tercepat (Recommended)

**Windows:**
```powershell
.\start.bat
```

**Linux/Mac:**
```bash
./start.sh
```

Script otomatis akan:
1. ✓ Cek Docker installed
2. ✓ Start MySQL container via docker-compose
3. ✓ Wait MySQL ready (polling 60 detik)
4. ✓ npm install dependencies
5. ✓ npm start aplikasi

### Manual (jika script gagal)

```bash
npm start
```

Saat startup, sistem otomatis:

1. Generate atau update file `.env`
2. Mengisi `LOCAL_IP` sesuai interface jaringan aktif
3. Mengisi `PORT` (default `3001`)
4. Mengisi MySQL credentials dari environment variables
5. Connect ke MySQL container

Contoh log sukses:

```text
.env diperbarui:
  LOCAL_IP=192.168.x.x
  PORT=3001
  DB_TYPE=mysql
✓ Successfully connected to MySQL!
  Host: localhost:3306
  Database: uniot_db
Server berjalan di http://localhost:3001
```

## 7. Cara Akses

### Dari server itu sendiri

```text
http://localhost:3001/login.html
```

### Dari perangkat lain di jaringan yang sama

```text
http://<LOCAL_IP>:3001/login.html
```

Contoh:

```text
http://192.168.18.244:3001/login.html
```

## 8. Tentang File .env

File `.env` dikelola otomatis saat startup.
Isi minimal:

```env
LOCAL_IP=192.168.x.x
PORT=3001
DB_TYPE=mysql
DB_HOST=localhost
DB_USER=uniot_user
DB_PASSWORD=uniot_pass
DB_NAME=uniot_db
```

Lihat `.env.example` untuk dokumentasi lengkap.

## 9. Troubleshooting Operator

### A. Error "Docker not found"

**Solusi:**
- Pastikan Docker Desktop sudah installed (Windows/Mac)
- Pastikan Docker daemon sedang berjalan
- Ubuntu: Cek dengan `docker ps`

### B. Error "port 3001 already in use"

Lalu hentikan proses yang memakai port itu, atau ganti `PORT` di `.env`.

### B. Bisa dibuka di localhost, tapi tidak bisa dari perangkat lain

Checklist:

1. Pastikan perangkat klien dan server ada di subnet yang sama.
2. Pastikan URL yang dipakai adalah `http://<LOCAL_IP>:3001/login.html`.
3. Pastikan firewall rule ada:

```powershell
netsh advfirewall firewall show rule name="Skripsi Node 3001"
```

4. Jika rule belum ada, jalankan PowerShell as Administrator lalu:

```powershell
node scripts/allow-firewall.js
```

5. Pastikan router/hotspot tidak mengaktifkan client isolation/AP isolation.

### C. LOCAL_IP tidak sesuai interface aktif

Regenerate env:

```powershell
node scripts/generate-env.js
Get-Content .env
```

Lalu restart aplikasi:

```powershell
npm start
```

## 9. Struktur File Penting

- `index.js`: server utama
- `scripts/generate-env.js`: deteksi IP lokal dan update `.env`
- `scripts/allow-firewall.js`: buka inbound firewall untuk port aplikasi
- `.env`: konfigurasi runtime lokal (otomatis)

## 10. Catatan Operasional

- Untuk akses lokal jaringan, cukup jalankan `npm start` pada komputer server.
- Jika pindah jaringan, jalankan ulang `npm start` agar `LOCAL_IP` diperbarui otomatis.
- Untuk domain publik (mis. tanpa IP), butuh DNS + router + reverse proxy, tidak cukup npm saja.