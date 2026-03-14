# IoT Monitoring Dashboard (Operator Guide)

Dokumen ini ditujukan untuk operator: mulai dari install Node.js sampai aplikasi bisa diakses dari perangkat lain melalui IP dan port.

## 1. Ringkasan

- Backend: Node.js + Express + Socket.IO
- Database: SQLite (file `database.sqlite`, otomatis dibuat/dipakai aplikasi)
- Frontend: file HTML statis yang disajikan langsung oleh server Node.js

Tidak perlu setup MySQL.

## 2. Prasyarat

- Node.js LTS (disarankan versi 18 ke atas)
- NPM (biasanya sudah ikut dengan Node.js)
- Git (opsional, jika ambil source dari repository)
- Windows: disarankan bisa buka PowerShell as Administrator (untuk auto-rule firewall)

## 3. Install Node.js

### Windows

1. Install Node.js LTS dari situs resmi.
2. Cek berhasil atau belum:

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

## 4. Ambil Kode dan Install Dependency

Jika dari git:

```bash
git clone <URL_REPOSITORY_KAMU>
cd skripsi
npm install
```

Jika project sudah ada di folder lokal, cukup masuk ke folder project lalu:

```bash
npm install
```

## 5. Jalankan Aplikasi

```bash
npm start
```

Saat startup, sistem otomatis:

1. Generate atau update file `.env`
2. Mengisi `LOCAL_IP` sesuai interface jaringan aktif
3. Mengisi `PORT` (default `3001`)
4. Mencoba membuat rule firewall Windows untuk port aplikasi
5. Menjalankan server Node.js

Contoh log sukses:

```text
.env diperbarui. LOCAL_IP=192.168.x.x, PORT=3001
Server (Express + Socket.IO) berjalan di http://localhost:3001
Akses dari jaringan lokal: http://192.168.x.x:3001
Successfully connected to database.sqlite!
```

## 6. Cara Akses

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

## 7. Tentang File .env

File `.env` dikelola otomatis saat `npm start`.
Isi minimal:

```env
LOCAL_IP=192.168.x.x
PORT=3001
```

Kamu boleh ubah `PORT`, tetapi pastikan akses URL mengikuti port tersebut.

## 8. Troubleshooting Operator

### A. Error EADDRINUSE: port already in use

Artinya port 3001 dipakai proses lain.

Windows (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen
```

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