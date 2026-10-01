const http = require('http');
const app = require('../app');
const { sequelize } = require('../models');
const { initSocket } = require('../socket');

const port = Number(process.env.PORT) || 3000;

// Express dan Socket.IO berjalan di server HTTP yang sama.
const server = http.createServer(app);
initSocket(server);

sequelize
  .authenticate()
  .then(() => {
    server.listen(port, () => console.log(`Growth Together API berjalan di http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Gagal terhubung ke database:', err.message);
    process.exit(1);
  });
