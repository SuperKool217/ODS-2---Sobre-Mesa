import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/registro', async (req, res, next) => {
  const { nombre, email, password, rol = 'donante', nombreOrganizacion, ubicacion, documentoLegal } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const passwordValue = String(password || '');
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  if (!nombre || !emailIsValid || Buffer.byteLength(passwordValue, 'utf8') < 10 || Buffer.byteLength(passwordValue, 'utf8') > 72) {
    return res.status(400).json({ error: 'Indica un nombre, un correo válido y una contraseña de entre 10 y 72 bytes.' });
  }
  if (!['donante', 'organizacion'].includes(rol)) {
    return res.status(400).json({ error: 'El rol solicitado no está permitido.' });
  }
  if (rol === 'organizacion' && (!nombreOrganizacion || !ubicacion || !documentoLegal)) {
    return res.status(400).json({ error: 'Para registrar una organización debes indicar nombre, ubicación y documento legal.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(String(password), 12);
    const inserted = await client.query(
      `INSERT INTO usuarios (nombre_completo, email, password_hash, rol)
       VALUES ($1, LOWER($2), $3, $4) RETURNING id, nombre_completo, email, rol`,
      [String(nombre).trim(), normalizedEmail, passwordHash, rol]
    );
    const user = inserted.rows[0];
    if (rol === 'organizacion') {
      await client.query(
        `INSERT INTO organizaciones (usuario_id, nombre, ubicacion, documento_legal)
         VALUES ($1, $2, $3, $4)`,
        [user.id, String(nombreOrganizacion).trim(), String(ubicacion).trim(), String(documentoLegal).trim()]
      );
    }
    await client.query('COMMIT');
    return res.status(201).json({
      message: rol === 'organizacion' ? 'Cuenta creada. La organización requiere verificación administrativa.' : 'Cuenta creada correctamente.',
      user
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'Ese correo o documento ya está registrado.' });
    next(error);
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    const result = await pool.query(
      `SELECT u.id, u.nombre_completo, u.email, u.password_hash, u.rol, u.activo,
              o.id AS organizacion_id, o.verificada
       FROM usuarios u LEFT JOIN organizaciones o ON o.usuario_id = u.id
       WHERE u.email = LOWER($1)`,
      [String(email).trim()]
    );
    const user = result.rows[0];
    if (!user || !user.activo || !(await bcrypt.compare(String(password), user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
    const token = jwt.sign(
      { sub: String(user.id), rol: user.rol, organizacionId: user.organizacion_id || null },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn }
    );
    res.cookie('ch_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000
    });
    return res.json({
      user: {
        id: user.id,
        nombre: user.nombre_completo,
        email: user.email,
        rol: user.rol,
        organizacionVerificada: user.verificada === true
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('ch_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
  res.sendStatus(204);
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre_completo, email, rol FROM usuarios WHERE id = $1 AND activo = TRUE`,
      [req.user.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
