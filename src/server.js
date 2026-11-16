import 'dotenv/config';
import app from './app.js';
import { pool } from './db/pool.js';

const required = ['DATABASE_URL', 'JWT_SECRET', 'QR_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Faltan variables de entorno: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32 || process.env.QR_SECRET.length < 32) {
  console.error('JWT_SECRET y QR_SECRET deben tener al menos 32 caracteres.');
  process.exit(1);
}

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Sobre-Mesa escucha en el puerto ${port}`);
});

async function shutdown(signal) {
  console.log(`Señal ${signal} recibida. Cerrando servicios.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
