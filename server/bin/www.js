const http = require('http');
const app = require('../app');
const { sequelize } = require('../models');

const port = Number(process.env.PORT) || 3000;

// Pakai http.createServer (bukan app.listen) agar Socket.IO bisa dipasang di server yang sama nanti.
const server = http.createServer(app);

sequelize
  .authenticate()
  .then(() => {
    server.listen(port, () => console.log(`Growth Together API berjalan di http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Gagal terhubung ke database:', err.message);
    process.exit(1);
  });
