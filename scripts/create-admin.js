import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';

const [nombre, email, password] = process.argv.slice(2);
if (!nombre || !email || !password || password.length < 12) {
  console.error('Uso: npm run create:admin -- "Nombre" correo@example.com "contraseña-de-12-o-mas"');
  process.exit(1);
}
try {
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO usuarios (nombre_completo, email, password_hash, rol)
     VALUES ($1, LOWER($2), $3, 'admin')`,
    [nombre, email, hash]
  );
  console.log('Usuario administrador creado.');
} catch (error) {
  console.error('No se pudo crear el administrador:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
