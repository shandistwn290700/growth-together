require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middlewares/errorHandler');
const router = require('./routes');

const app = express();

// Agar rate limit membaca IP asli pengguna saat nanti berada di belakang proxy hosting.
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Growth Together' });
});

app.use('/api', router);

app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));
app.use(errorHandler);

module.exports = app;
