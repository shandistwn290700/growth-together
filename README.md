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

## Tahapan

- [x] Tahap 1: setup proyek, database, model
- [x] Tahap 2: login + panel admin (import Excel, kelas, naik kelas)
- [x] Tahap 3: Beranda — postingan, upload foto/video, reaksi, komentar
- [x] Tahap 4: Profil — timeline per kelas, galeri, foto profil
- [ ] Tahap 5: Chat live terenkripsi end-to-end
- [ ] Tahap 6: rapikan dan deploy
