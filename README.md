# Growth Together

Platform portofolio dan perkembangan siswa SDIT, dari kelas 1 sampai lulus. Guru dan orang tua berbagi foto/video dalam bentuk timeline.

- `client/` — React + Vite, Tailwind CSS, React Router, TanStack Query
- `server/` — Node.js + Express, PostgreSQL + Sequelize

## Setup

1. Instal PostgreSQL (sekali saja). Di PowerShell:
   ```powershell
   winget install PostgreSQL.PostgreSQL.18
   ```
   Atau unduh installer dari https://www.postgresql.org/download/windows/. Catat password user `postgres` yang dibuat saat instalasi.
2. Salin `server/.env.example` menjadi `server/.env`, lalu isi `DB_PASSWORD`, `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, dan kredensial Cloudinary. Cek Cloudinary dengan `npm run check:cloudinary`.
3. Buat database, tabel, dan akun admin pertama:
   ```bash
   cd server
   npm run db:setup
   ```
   Jika hanya pembuatan akun admin yang gagal (misalnya password kurang dari 8 karakter), perbaiki `.env` lalu jalankan `npm run db:seed`.
4. Jalankan backend dan frontend di dua terminal:
   ```bash
   cd server && npm run dev   # http://localhost:3000
   cd client && npm run dev   # http://localhost:5173
   ```

## Alur awal penggunaan (admin)

1. Login dengan akun admin dari `.env`, lalu ganti password.
2. **Admin → Tahun ajaran**: buat tahun ajaran (misal 2026/2027) lalu aktifkan.
3. **Admin → Import akun dari Excel**: unduh template, isi sheet Siswa dan Guru, lalu upload.
4. Unduh **daftar password awal** dan bagikan ke guru dan orang tua. Username orang tua adalah NIS anaknya.
5. Setiap pengguna wajib mengganti password saat login pertama.

## Kenaikan kelas

1. Admin membuat tahun ajaran berikutnya dan kelas-kelasnya (menu **Kelas → Tambah kelas**).
2. Wali kelas (atau admin) membuka kelasnya, lalu memilih untuk setiap siswa: naik kelas, tinggal kelas, lulus (kelas 6), atau pindah sekolah.
3. Setelah semua kelas diproses, admin mengaktifkan tahun ajaran baru.

Riwayat kelas lama tidak dihapus, sehingga timeline siswa tetap utuh dari kelas 1 sampai lulus.

## Tes

```bash
cd server
npm test
```

Tes menjalankan PostgreSQL sementara (unduhan pertama agak lama), menguji migrasi naik/turun, seluruh API, aturan privasi, dan chat terenkripsi lewat HTTP dan Socket.IO. Database aslimu tidak tersentuh.

## Produksi

📘 **Panduan deploy lengkap (Railway atau VPS + Docker, domain, backup, checklist): [docs/DEPLOY.md](docs/DEPLOY.md)**

Di produksi, satu server Node melayani API, Socket.IO, dan tampilan React sekaligus (satu alamat, tanpa CORS).

```bash
npm run build     # di folder root: instal dependency dan build client
npm run migrate   # jalankan migrasi database
npm start         # nyalakan server
```

Atau dengan Docker (migrasi otomatis dijalankan saat container menyala):

```bash
docker build -t growth-together .
docker run -p 3000:3000 --env-file server/.env.production growth-together
```

Variabel lingkungan produksi: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_*`, dan `DB_SSL=true` jika database mewajibkan SSL. Server menolak menyala jika ada yang kurang. Akun admin pertama dibuat sekali dengan `npm run db:seed --prefix server` (butuh `SEED_ADMIN_USERNAME` dan `SEED_ADMIN_PASSWORD`).

> Proyek ini berada di `htdocs`, tetapi **tidak** dijalankan lewat Apache. File `.htaccess` di root memblokir Apache agar `server/.env` tidak bisa dibuka dari browser. Jangan hapus file itu.

## Tahapan

- [x] Tahap 1: setup proyek, database, model
- [x] Tahap 2: login + panel admin (import Excel, kelas, naik kelas)
- [x] Tahap 3: Beranda — postingan, upload foto/video, reaksi, komentar
- [x] Tahap 4: Profil — timeline per kelas, galeri, foto profil
- [x] Tahap 5: Chat live terenkripsi end-to-end
- [x] Tahap 6: siap produksi + dokumentasi deploy (deploy ke hosting menunggu persetujuan sekolah)
