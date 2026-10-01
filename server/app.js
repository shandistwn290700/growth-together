require('dotenv').config({ quiet: true });

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const errorHandler = require('./middlewares/errorHandler');
const router = require('./routes');

const app = express();
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

// Agar rate limit membaca IP asli pengguna saat berada di belakang proxy hosting.
app.set('trust proxy', 1);

// Content Security Policy: browser hanya boleh memuat script dari server kita sendiri,
// gambar/video dari Cloudinary, dan font dari Google Fonts. Ini mempersempit dampak XSS.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        mediaSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'", 'https://api.cloudinary.com'],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null, // HTTPS diatur oleh hosting
      },
    },
  }),
);
app.use(compression());
// Saat produksi, client dan API berada di alamat yang sama sehingga CORS hanya perlu untuk development.
if (process.env.CLIENT_URL) app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Growth Together' });
});

app.use('/api', router);
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));

// Produksi: layani hasil build React (client/dist). Halaman apa pun selain /api dikembalikan ke
// index.html agar React Router yang menentukan tampilannya.
if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  // File di /assets punya nama ber-hash, jadi aman disimpan lama di cache browser.
  app.use('/assets', express.static(path.join(CLIENT_DIST, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(CLIENT_DIST, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/socket.io')) return next();
    res.set('Cache-Control', 'no-cache').sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));
app.use(errorHandler);

module.exports = app;
