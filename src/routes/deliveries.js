import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createJti } from '../utils/crypto.js';
import { addDonationEvent } from '../services/timeline.js';

const router = Router();
const maxPhotoBytes = Number(process.env.MAX_PHOTO_SIZE_MB || 5) * 1024 * 1024;
const qrLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxPhotoBytes, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) {
      const error = new Error('La foto debe ser JPG, PNG o WEBP.');
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  }
});

function validImageSignature(buffer, mime) {
  if (!buffer || buffer.length < 12) return false;
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

async function auditFailure({ deliveryId, userId, reason, lat, lng }) {
  await pool.query(
    `INSERT INTO auditoria_qr (entrega_id, usuario_id, resultado, motivo, lat, lng)
     VALUES ($1, $2, 'rechazado', $3, $4, $5)`,
    [deliveryId || null, userId || null, reason, Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null]
  );
}

router.get('/organizacion/solicitudes', authenticate, requireRole('organizacion'), async (req, res, next) => {
  try {
    const org = await pool.query('SELECT id, verificada FROM organizaciones WHERE usuario_id = $1', [req.user.sub]);
    if (!org.rows[0] || !org.rows[0].verificada) return res.status(403).json({ error: 'La organización todavía no está verificada.' });
    const result = await pool.query(
      `SELECT s.id, s.estado, s.creada_en, d.id AS donacion_id, d.monto_en_centavos,
              c.titulo AS campana, u.nombre_completo AS donante
       FROM solicitudes s JOIN donaciones d ON d.id = s.donacion_id
       JOIN campanas c ON c.id = d.campana_id JOIN usuarios u ON u.id = d.usuario_id
       WHERE s.organizacion_id = $1 ORDER BY s.creada_en DESC`,
      [org.rows[0].id]
    );
    res.json({ requests: result.rows });
  } catch (error) { next(error); }
});

router.patch('/solicitudes/:id/aceptar', authenticate, requireRole('organizacion'), async (req, res, next) => {
  const requestId = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const org = await client.query('SELECT id, verificada FROM organizaciones WHERE usuario_id = $1', [req.user.sub]);
    if (!org.rows[0] || !org.rows[0].verificada) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'La organización no está verificada.' });
    }
    const updated = await client.query(
      `UPDATE solicitudes SET estado = 'aceptada', aceptada_en = NOW()
       WHERE id = $1 AND organizacion_id = $2 AND estado = 'solicitada'
       RETURNING id, donacion_id`,
      [requestId, org.rows[0].id]
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no disponible para aceptar.' });
    }
    const delivery = await client.query(
      `INSERT INTO entregas (solicitud_id, organizacion_id)
       VALUES ($1, $2) RETURNING id`,
      [requestId, org.rows[0].id]
    );
    await client.query("UPDATE donaciones SET estado_entrega = 'aceptada' WHERE id = $1", [updated.rows[0].donacion_id]);
    await addDonationEvent(client, updated.rows[0].donacion_id, 'aceptada', 'La organización aceptó preparar la entrega.');
    await client.query('COMMIT');
    res.json({ message: 'Solicitud aceptada.', deliveryId: delivery.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

router.get('/organizacion/entregas', authenticate, requireRole('organizacion'), async (req, res, next) => {
  try {
    const org = await pool.query('SELECT id, verificada FROM organizaciones WHERE usuario_id = $1', [req.user.sub]);
    if (!org.rows[0] || !org.rows[0].verificada) return res.status(403).json({ error: 'La organización no está verificada.' });
    const result = await pool.query(
      `SELECT e.id, e.estado, e.creada_en, e.en_camino_en, d.id AS donacion_id,
              u.nombre_completo AS donante, c.titulo AS campana
       FROM entregas e JOIN solicitudes s ON s.id = e.solicitud_id
       JOIN donaciones d ON d.id = s.donacion_id JOIN usuarios u ON u.id = d.usuario_id
       JOIN campanas c ON c.id = d.campana_id
       WHERE e.organizacion_id = $1 ORDER BY e.creada_en DESC`,
      [org.rows[0].id]
    );
    res.json({ deliveries: result.rows });
  } catch (error) { next(error); }
});

router.patch('/entregas/:id/en-camino', authenticate, requireRole('organizacion'), async (req, res, next) => {
  const deliveryId = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const org = await client.query('SELECT id, verificada FROM organizaciones WHERE usuario_id = $1', [req.user.sub]);
    if (!org.rows[0] || !org.rows[0].verificada) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'La organización no está verificada.' });
    }
    const updated = await client.query(
      `UPDATE entregas SET estado = 'en_camino', en_camino_en = NOW()
       WHERE id = $1 AND organizacion_id = $2 AND estado = 'preparando'
       RETURNING id, solicitud_id`,
      [deliveryId, org.rows[0].id]
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Entrega no disponible para iniciar el traslado.' });
    }
    const donation = await client.query(
      'SELECT donacion_id FROM solicitudes WHERE id = $1',
      [updated.rows[0].solicitud_id]
    );
    await client.query("UPDATE donaciones SET estado_entrega = 'en_camino' WHERE id = $1", [donation.rows[0].donacion_id]);
    await addDonationEvent(client, donation.rows[0].donacion_id, 'en_camino', 'La entrega salió hacia el punto de recepción.');
    await client.query('COMMIT');
    res.json({ message: 'Entrega marcada como en camino.' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

router.get('/entregas/:id/qr-token', qrLimiter, authenticate, requireRole('organizacion'), async (req, res, next) => {
  const deliveryId = Number(req.params.id);
  try {
    const org = await pool.query('SELECT id, verificada FROM organizaciones WHERE usuario_id = $1', [req.user.sub]);
    if (!org.rows[0] || !org.rows[0].verificada) return res.status(403).json({ error: 'La organización no está verificada.' });
    const delivery = await pool.query(
      `SELECT id FROM entregas WHERE id = $1 AND organizacion_id = $2 AND estado = 'en_camino'`,
      [deliveryId, org.rows[0].id]
    );
    if (!delivery.rows[0]) return res.status(404).json({ error: 'La entrega no está disponible para generar un QR.' });
    const jti = createJti();
    const expiresIn = Number(process.env.QR_TOKEN_TTL_SECONDS || 90);
    const token = jwt.sign(
      { entregaId: deliveryId, jti },
      process.env.QR_SECRET,
      { algorithm: 'HS256', expiresIn }
    );
    res.json({ token, renovarEn: Number(process.env.QR_RENEW_SECONDS || 60), expiraEn: expiresIn });
  } catch (error) { next(error); }
});

router.post('/entregas/:id/validar-qr', qrLimiter, authenticate, requireRole('donante'), upload.single('foto'), async (req, res, next) => {
  const deliveryId = Number(req.params.id);
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const token = req.body?.token;
  const validLocation = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!Number.isSafeInteger(deliveryId) || deliveryId < 1) return res.status(400).json({ error: 'Identificador de entrega inválido.' });
  const fail = async (reason, status = 400) => {
    try { await auditFailure({ deliveryId, userId: req.user.sub, reason, lat, lng }); }
    catch (auditError) { console.error('No se pudo registrar auditoría QR:', auditError.message); }
    return res.status(status).json({ error: reason });
  };
  let payload;
  try {
    if (!token) return await fail('token_faltante');
    payload = jwt.verify(token, process.env.QR_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return await fail(error.name === 'TokenExpiredError' ? 'vencido' : 'firma_invalida');
  }
  if (Number(payload.entregaId) !== deliveryId) return await fail('otra_entrega');
  if (!validLocation) return await fail('ubicacion_invalida');
  if (!req.file) return await fail('foto_faltante');
  if (!validImageSignature(req.file.buffer, req.file.mimetype)) return await fail('foto_invalida');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rowResult = await client.query(
      `SELECT e.id, e.estado, s.id AS solicitud_id, s.donacion_id,
              d.usuario_id AS donante_id
       FROM entregas e JOIN solicitudes s ON s.id = e.solicitud_id
       JOIN donaciones d ON d.id = s.donacion_id
       WHERE e.id = $1 FOR UPDATE OF e`,
      [deliveryId]
    );
    const delivery = rowResult.rows[0];
    if (!delivery) {
      await client.query('ROLLBACK');
      return await fail('otra_entrega', 404);
    }
    if (Number(delivery.donante_id) !== Number(req.user.sub)) {
      await client.query('ROLLBACK');
      return await fail('donante_no_corresponde', 403);
    }
    if (delivery.estado !== 'en_camino') {
      await client.query('ROLLBACK');
      return await fail('entrega_no_en_camino');
    }
    try {
      await client.query(
        'INSERT INTO qr_tokens_usados (jti, entrega_id) VALUES ($1, $2)',
        [payload.jti, deliveryId]
      );
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') return await fail('reutilizado');
      throw error;
    }
    await client.query(
      `UPDATE entregas SET estado = 'entregada', entregada_en = NOW(),
       lat_entrega = $2, lng_entrega = $3, foto_evidencia = $4, foto_mime = $5, foto_bytes = $6
       WHERE id = $1`,
      [deliveryId, lat, lng, req.file.buffer, req.file.mimetype, req.file.size]
    );
    await client.query("UPDATE solicitudes SET estado = 'completada', completada_en = NOW() WHERE id = $1", [delivery.solicitud_id]);
    await client.query("UPDATE donaciones SET estado_entrega = 'entregado', actualizada_en = NOW() WHERE id = $1", [delivery.donacion_id]);
    await client.query(
      `INSERT INTO auditoria_qr (entrega_id, usuario_id, resultado, motivo, lat, lng)
       VALUES ($1, $2, 'valido', 'entrega_confirmada', $3, $4)`,
      [deliveryId, req.user.sub, lat, lng]
    );
    await addDonationEvent(client, delivery.donacion_id, 'entregado', 'Entrega confirmada mediante QR dinámico con evidencia fotográfica y ubicación.');
    await client.query('COMMIT');
    res.json({ ok: true, message: 'Entrega confirmada correctamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

router.get('/entregas/:id/evidencia', authenticate, async (req, res, next) => {
  const deliveryId = Number(req.params.id);
  try {
    const result = await pool.query(
      `SELECT e.foto_evidencia, e.foto_mime, d.usuario_id AS donante_id, e.organizacion_id, o.usuario_id AS org_user_id
       FROM entregas e JOIN solicitudes s ON s.id = e.solicitud_id
       JOIN donaciones d ON d.id = s.donacion_id JOIN organizaciones o ON o.id = e.organizacion_id
       WHERE e.id = $1 AND e.estado = 'entregada'`,
      [deliveryId]
    );
    const row = result.rows[0];
    if (!row?.foto_evidencia) return res.status(404).json({ error: 'Evidencia no encontrada.' });
    if (![Number(row.donante_id), Number(row.org_user_id)].includes(Number(req.user.sub)) && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes acceso a esta evidencia.' });
    }
    res.type(row.foto_mime).send(row.foto_evidencia);
  } catch (error) { next(error); }
});

export default router;
