import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('Falta configurar DATABASE_URL.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Render Postgres permite TLS en conexiones internas con certificados
  // autofirmados. Se exige cifrado, pero no se valida el certificado contra
  // una CA pública. Mantén DATABASE_URL como variable secreta de Render.
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined
});

pool.on('error', (error) => {
  console.error('Error inesperado en el pool PostgreSQL:', error.message);
});
