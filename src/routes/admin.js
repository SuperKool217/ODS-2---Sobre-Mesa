import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/organizaciones', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.nombre, o.ubicacion, o.documento_legal, o.verificada,
              u.nombre_completo, u.email
       FROM organizaciones o JOIN usuarios u ON u.id = o.usuario_id
       ORDER BY o.verificada ASC, o.creada_en DESC`
    );
    res.json({ organizations: result.rows });
  } catch (error) { next(error); }
});

router.patch('/organizaciones/:id/verificar', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE organizaciones SET verificada = TRUE WHERE id = $1 RETURNING id, nombre, verificada',
      [Number(req.params.id)]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Organización no encontrada.' });
    res.json({ organization: result.rows[0] });
  } catch (error) { next(error); }
});

router.post('/campanas', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { organizacionId, titulo, descripcion, metaCop, fechaLimite, imagenUrl } = req.body || {};
    const meta = Number(metaCop);
    if (!Number.isSafeInteger(Number(organizacionId)) || !titulo || !descripcion || !Number.isSafeInteger(meta) || meta < 1000) {
      return res.status(400).json({ error: 'Datos de campaña inválidos.' });
    }
    const result = await pool.query(
      `INSERT INTO campanas (organizacion_id, titulo, descripcion, meta_en_centavos, fecha_limite, imagen_url)
       SELECT id, $2, $3, $4 * 100, $5, $6 FROM organizaciones WHERE id = $1 AND verificada = TRUE
       RETURNING id, titulo, descripcion, meta_en_centavos`,
      [organizacionId, String(titulo).trim(), String(descripcion).trim(), meta * 100, fechaLimite || null, imagenUrl || null]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No existe una organización verificada con ese identificador.' });
    res.status(201).json({ campaign: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
