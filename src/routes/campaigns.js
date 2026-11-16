import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.titulo, c.descripcion, c.meta_en_centavos, c.recaudado_en_centavos,
              c.fecha_limite, c.imagen_url, o.nombre AS organizacion
       FROM campanas c JOIN organizaciones o ON o.id = c.organizacion_id
       WHERE c.activa = TRUE AND o.verificada = TRUE
       ORDER BY c.creada_en DESC`
    );
    res.json({ campaigns: result.rows });
  } catch (error) { next(error); }
});

export default router;
