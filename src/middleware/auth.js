import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = req.cookies?.ch_session || bearerToken;
  if (!token) return res.status(401).json({ error: 'Autenticación requerida.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o vencida.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta operación.' });
    }
    next();
  };
}

export async function getOrganizationForUser(userId) {
  const result = await pool.query(
    'SELECT id, verificada FROM organizaciones WHERE usuario_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}
