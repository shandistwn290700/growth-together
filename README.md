# Growth Together

Platform portofolio dan perkembangan siswa SDIT, dari kelas 1 sampai lulus. Guru dan orang tua berbagi foto/video dalam bentuk timeline.

- `client/` — React + Vite, Tailwind CSS, React Router, TanStack Query
- `server/` — Node.js + Express, PostgreSQL + Sequelize

## Setup

1. Nyalakan PostgreSQL (PowerShell **sebagai Administrator**):
   ```powershell
   Start-Service postgresql-x64-18
   ```
2. Salin `server/.env.example` menjadi `server/.env`, lalu isi `DB_PASSWORD`, `JWT_SECRET`, dan `SEED_ADMIN_PASSWORD`.
3. Buat database, tabel, dan akun admin pertama:
   ```bash
   cd server
   npm run db:setup
   ```
4. Jalankan backend dan frontend di dua terminal:
   ```bash
   cd server && npm run dev   # http://localhost:3000
   cd client && npm run dev   # http://localhost:5173
   ```

## Tahapan

- [x] Tahap 1: setup proyek, database, model
- [ ] Tahap 2: login + panel admin (import Excel, kelas, naik kelas)
- [ ] Tahap 3: Beranda — postingan, upload foto/video, reaksi, komentar
- [ ] Tahap 4: Profil — timeline per kelas
- [ ] Tahap 5: Chat live terenkripsi end-to-end
- [ ] Tahap 6: rapikan dan deploy
