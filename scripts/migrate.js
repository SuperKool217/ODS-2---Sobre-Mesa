import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const schema = await fs.readFile(path.join(root, 'db', 'schema.sql'), 'utf8');
try {
  await pool.query(schema);
  console.log('Esquema PostgreSQL aplicado correctamente.');
} catch (error) {
  console.error('No se pudo aplicar el esquema:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
