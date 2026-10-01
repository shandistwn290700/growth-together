require('dotenv').config({ quiet: true });

const base = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: { ...base, database: process.env.DB_NAME || 'growth_together_dev' },
  test: { ...base, database: process.env.DB_NAME_TEST || 'growth_together_test' },
  // Hosting biasanya memberi satu alamat database (DATABASE_URL). Isi DB_SSL=true jika
  // database berada di luar jaringan hosting dan mewajibkan koneksi terenkripsi.
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
    dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  },
};
