import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.get('/mias', authenticate, requireRole('donante'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.monto_en_centavos, d.moneda, d.estado_pago, d.estado_entrega, d.creada_en,
              c.titulo AS campana, e.id AS entrega_id
       FROM donaciones d JOIN campanas c ON c.id = d.campana_id
       LEFT JOIN solicitudes s ON s.donacion_id = d.id LEFT JOIN entregas e ON e.solicitud_id = s.id
       WHERE d.usuario_id = $1 ORDER BY d.creada_en DESC`,
      [req.user.sub]
    );
    res.json({ donations: result.rows });
  } catch (error) { next(error); }
});

router.get('/:id/trazabilidad', authenticate, async (req, res, next) => {
  const donationId = Number(req.params.id);
  if (!Number.isSafeInteger(donationId)) return res.status(400).json({ error: 'Identificador inválido.' });
  try {
    const donation = await pool.query(
      `SELECT d.id, d.usuario_id, d.estado_pago, d.estado_entrega, c.titulo AS campana,
              s.organizacion_id, e.id AS entrega_id, e.estado AS entrega_estado, e.entregada_en, e.lat_entrega, e.lng_entrega,
              e.foto_mime, e.foto_evidencia IS NOT NULL AS tiene_foto
       FROM donaciones d
       JOIN campanas c ON c.id = d.campana_id
       LEFT JOIN solicitudes s ON s.donacion_id = d.id
       LEFT JOIN entregas e ON e.solicitud_id = s.id
       WHERE d.id = $1`,
      [donationId]
    );
    const row = donation.rows[0];
    if (!row) return res.status(404).json({ error: 'Donación no encontrada.' });
    const org = await pool.query('SELECT id FROM organizaciones WHERE usuario_id = $1', [req.user.sub]);
    const belongsToOrg = org.rows.some((item) => Number(item.id) === Number(row.organizacion_id));
    if (req.user.rol !== 'admin' && Number(row.usuario_id) !== Number(req.user.sub) && !belongsToOrg) {
      return res.status(403).json({ error: 'No tienes acceso a esta trazabilidad.' });
    }
    const events = await pool.query(
      'SELECT tipo, descripcion, creado_en FROM eventos_donacion WHERE donacion_id = $1 ORDER BY creado_en',
      [donationId]
    );
    res.json({ donation: row, events: events.rows });
  } catch (error) { next(error); }
});

export default router;
