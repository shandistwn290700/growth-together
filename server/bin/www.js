require('dotenv').config({ quiet: true });
const { validateEnv } = require('../helpers/env');

validateEnv();

const http = require('http');
const app = require('../app');
const { sequelize } = require('../models');
const { initSocket } = require('../socket');

const port = Number(process.env.PORT) || 3000;

// Express dan Socket.IO berjalan di server HTTP yang sama.
const server = http.createServer(app);
const io = initSocket(server);

sequelize
  .authenticate()
  .then(() => {
    server.listen(port, () => console.log(`Growth Together berjalan di http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Gagal terhubung ke database:', err.message);
    process.exit(1);
  });

// Hosting mengirim SIGTERM saat restart/deploy ulang: tutup koneksi dengan rapi.
function shutdown(signal) {
  console.log(`${signal} diterima, mematikan server…`);
  io.close();
  server.close(() => sequelize.close().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
