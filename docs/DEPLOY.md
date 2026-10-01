# Panduan Deploy Growth Together

Panduan ini menjelaskan cara menaruh Growth Together di internet agar bisa dibuka guru dan orang tua dari HP. Ada dua pilihan: **Railway** (paling mudah) dan **VPS dengan Docker** (data di Indonesia, kontrol penuh).

> **Status:** konfigurasi produksi sudah diuji di komputer lokal (`npm run build` + `npm start`). `Dockerfile` dan `deploy/docker-compose.yml` **belum pernah dijalankan di Docker sungguhan**, jadi deploy pertama perlu diawasi.

## Gambaran sistem

```
HP / laptop ──HTTPS──▶ [ Server Node.js ] ──▶ PostgreSQL
                         │  API + chat (Socket.IO) + tampilan React
                         └──▶ Cloudinary (foto & video, privat)
```

- Cukup **satu** server Node (API, chat real-time, dan tampilan React dalam satu alamat).
- Butuh hosting yang **menyala terus** (bukan serverless / paket gratis yang tertidur), karena chat memakai koneksi WebSocket.
- Jalankan **satu instance** saja. Status online chat dan pembatas login disimpan di memori server; jika nanti perlu banyak instance, tambahkan Redis.

## 1. Sebelum deploy

### Persetujuan dan privasi

Aplikasi ini menyimpan foto, video, dan data anak-anak. Sebelum dipakai:

- Minta **persetujuan sekolah** dan siapkan **kebijakan privasi** yang menjelaskan data apa yang disimpan, siapa yang bisa melihat, dan berapa lama disimpan.
- Data anak termasuk data pribadi yang perlu perlindungan khusus menurut UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Konsultasikan dengan pihak sekolah/yayasan mengenai **persetujuan orang tua**. (Ini bukan nasihat hukum.)

### Siapkan bahan

| Bahan | Keterangan |
|---|---|
| Repo GitHub **privat** | Push folder proyek ini. Pastikan `server/.env` **tidak** ikut (sudah diatur di `.gitignore`). |
| `JWT_SECRET` baru | Jangan pakai yang dari komputer development. Buat dengan `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| Cloudinary | Boleh akun yang sama, tetapi pakai `CLOUDINARY_FOLDER=growth-together-prod` agar terpisah dari file uji coba. |
| Password admin pertama | Minimal 8 karakter. Akan diminta diganti saat login pertama. |

### Variabel lingkungan produksi

| Nama | Wajib | Contoh / keterangan |
|---|---|---|
| `NODE_ENV` | ✓ | `production` |
| `DATABASE_URL` | ✓ | `postgres://user:password@host:5432/nama_db` |
| `JWT_SECRET` | ✓ | minimal 32 karakter acak |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | ✓ | dari console.cloudinary.com |
| `CLOUDINARY_FOLDER` | | `growth-together-prod` |
| `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` | saat pertama | admin dibuat otomatis **hanya jika belum ada admin** |
| `DB_SSL` | | `true` jika database berada di luar jaringan hosting dan mewajibkan SSL |
| `PORT` | | biasanya diisi otomatis oleh hosting; default `3000` |
| `CLIENT_URL` | | **kosongkan** di produksi (hanya untuk development) |

Server **menolak menyala** jika variabel wajib belum lengkap, dan menampilkan daftar yang kurang di log.

Saat menyala, container otomatis menjalankan **migrasi database** dan **membuat admin pertama jika belum ada**. Keduanya aman diulang.

## 2A. Deploy ke Railway

Tampilan Railway bisa berubah; nama menu di bawah mungkin sedikit berbeda.

1. Push proyek ke GitHub (repo privat).
2. Buka [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → pilih repo ini. Railway otomatis memakai `Dockerfile` di root.
3. Di project yang sama: **+ New** → **Database** → **PostgreSQL**.
4. Buka service aplikasi → **Variables**, lalu isi:
   ```
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=...
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   CLOUDINARY_FOLDER=growth-together-prod
   SEED_ADMIN_USERNAME=admin
   SEED_ADMIN_PASSWORD=...
   ```
   `${{Postgres.DATABASE_URL}}` adalah referensi ke database Railway (koneksi internal, tidak perlu `DB_SSL`).
5. **Settings** → pilih region **Southeast Asia (Singapore)** agar lebih cepat dari Indonesia.
6. **Settings → Networking → Generate Domain** untuk mendapat alamat seperti `growth-together.up.railway.app`.
7. Tunggu deploy selesai. Di **Logs** harus muncul `Growth Together berjalan di …`.
8. Lanjut ke [Setelah online](#4-setelah-online).

Setiap `git push` ke branch utama akan otomatis men-deploy ulang.

## 2B. Deploy ke VPS (Ubuntu) dengan Docker

Disarankan VPS **minimal 2 GB RAM** (proses build tampilan React butuh memori), Ubuntu 24.04. Semua file ada di folder `deploy/`.

1. **Arahkan domain** ke VPS: buat DNS record **A** (misalnya `app.namasekolah.sch.id`) yang menunjuk ke IP VPS. Tunggu hingga aktif.
2. Masuk ke VPS lewat SSH, lalu instal Docker dan buka firewall:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
   ```
3. Ambil kode (repo privat: pakai deploy key atau token GitHub):
   ```bash
   git clone https://github.com/<akun>/growth-together.git
   cd growth-together/deploy
   cp .env.example .env
   nano .env        # isi DOMAIN, POSTGRES_PASSWORD, JWT_SECRET, CLOUDINARY_*, SEED_ADMIN_*
   ```
4. Nyalakan:
   ```bash
   sudo docker compose up -d --build
   sudo docker compose logs -f app     # tunggu "Growth Together berjalan", lalu Ctrl+C
   ```
5. Buka `https://<domain>`. Caddy mengurus sertifikat HTTPS otomatis (butuh port 80 dan 443 terbuka dan DNS sudah benar).

Database tidak dibuka ke internet; hanya container aplikasi yang bisa mengaksesnya.

### Update aplikasi di VPS

```bash
cd growth-together && git pull
cd deploy && sudo docker compose up -d --build
```

### Backup database

Foto dan video tersimpan di Cloudinary; yang perlu di-backup adalah database.

```bash
# backup (jalankan dari folder deploy/)
sudo docker compose exec -T db pg_dump -U growth_together growth_together | gzip > ~/backup-$(date +%F).sql.gz

# restore ke database kosong
gunzip -c ~/backup-2026-10-01.sql.gz | sudo docker compose exec -T db psql -U growth_together growth_together
```

Jadwalkan backup harian dengan `crontab -e`, dan **salin file backup ke tempat lain** (misalnya Google Drive sekolah). Backup yang hanya ada di VPS yang sama ikut hilang jika VPS rusak.

Di Railway, gunakan fitur backup database bawaan (tab **Backups** pada service PostgreSQL), sesuai paket yang dipakai.

## 3. Menghubungkan domain sendiri

- **Railway:** service aplikasi → Settings → Networking → **Custom Domain**, lalu buat DNS record CNAME sesuai petunjuk Railway. HTTPS diurus otomatis.
- **VPS:** isi `DOMAIN` di `deploy/.env` dan DNS record A ke IP VPS (langkah 2B).

Domain `.sch.id` khusus untuk sekolah dan didaftarkan atas nama sekolah dengan dokumen resmi; tanyakan ke pihak sekolah apakah sudah punya.

## 4. Setelah online

Centang satu per satu:

- [ ] Buka alamat aplikasi, login sebagai admin, **ganti password**.
- [ ] Hapus `SEED_ADMIN_PASSWORD` dari variabel hosting (sudah tidak dipakai setelah admin dibuat).
- [ ] Buat tahun ajaran dan aktifkan, lalu import data dari Excel.
- [ ] Coba dari **HP**: login sebagai guru dan orang tua, posting foto **dan video**, beri reaksi dan komentar.
- [ ] Coba **chat** antara guru dan orang tua dari dua perangkat berbeda (titik hijau online, ✓✓ sudah dibaca).
- [ ] Pastikan alamat diawali `https://` dan ada ikon gembok di browser.
- [ ] Jadwalkan dan uji **backup** database (termasuk mencoba restore).

## 5. Kalau ada masalah

| Gejala | Kemungkinan penyebab |
|---|---|
| Log: `Pengaturan .env belum lengkap` | Ada variabel wajib yang belum diisi; daftarnya tertulis di log. |
| Log: `Gagal terhubung ke database` | `DATABASE_URL` salah, atau database butuh SSL (`DB_SSL=true`). |
| Log: `Isi SEED_ADMIN_PASSWORD…` | Belum ada admin dan `SEED_ADMIN_PASSWORD` kosong/kurang dari 8 karakter. |
| Foto/video tidak muncul | Kredensial Cloudinary salah. Uji dengan `npm run check:cloudinary --prefix server` memakai variabel yang sama. |
| Chat tidak tersambung / tidak real-time | Proxy tidak meneruskan WebSocket. Railway dan Caddy sudah mendukung; jika memakai proxy lain (Nginx, Cloudflare), aktifkan dukungan WebSocket. |
| `Terlalu banyak percobaan login` | Pembatas login: 10 percobaan per 15 menit per alamat IP. Tunggu 15 menit. |
| Semua pengguna tiba-tiba harus login ulang | `JWT_SECRET` berubah. Jangan ubah setelah aplikasi dipakai. |
