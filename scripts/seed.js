import 'dotenv/config';
import { pool } from '../src/db/pool.js';

const client = await pool.connect();

try {
  await client.query('BEGIN');

  const user = await client.query(
    "SELECT id FROM usuarios WHERE email = 'demo.organizacion@cerohambre.local'"
  );

  let userId;

  if (user.rows[0]) {
    userId = user.rows[0].id;
  } else {
    const password = process.env.DEMO_ORG_PASSWORD;

    if (!password || password.length < 10) {
      throw new Error(
        'Define DEMO_ORG_PASSWORD (mínimo 10 caracteres) antes de ejecutar el seed.'
      );
    }

    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash(password, 12);

    const inserted = await client.query(
      `INSERT INTO usuarios
        (nombre_completo, email, password_hash, rol)
       VALUES (
        'Organización de demostración',
        'demo.organizacion@cerohambre.local',
        $1,
        'organizacion'
       )
       RETURNING id`,
      [hash]
    );

    userId = inserted.rows[0].id;
  }

  const org = await client.query(
    'SELECT id FROM organizaciones WHERE usuario_id = $1::bigint',
    [userId]
  );

  let orgId;

  if (org.rows[0]) {
    orgId = org.rows[0].id;
  } else {
    const inserted = await client.query(
      `INSERT INTO organizaciones
        (usuario_id, nombre, ubicacion, documento_legal, verificada)
       VALUES (
        $1::bigint,
        'Comedor Comunitario de Demostración',
        'Montería, Córdoba',
        'DEMO-CER0-2026',
        TRUE
       )
       RETURNING id`,
      [userId]
    );

    orgId = inserted.rows[0].id;
  }

  // Consultas con conversiones explícitas para evitar
  // conflictos de tipos en los parámetros de PostgreSQL.

  const campaignSql = `
    INSERT INTO campanas
      (organizacion_id, titulo, descripcion, meta_en_centavos, fecha_limite, imagen_url)
    SELECT
      $1::bigint,
      $2::varchar(200),
      $3::text,
      $4::bigint,
      CURRENT_DATE + INTERVAL '60 days',
      $5::text
    WHERE NOT EXISTS (
      SELECT 1
      FROM campanas
      WHERE organizacion_id = $1::bigint
        AND titulo = $2::varchar(200)
    )
  `;

  const campaigns = [
    [
      'Comedor Infantil',
      'Apoyo alimentario para niñas y niños de la comunidad.',
      1500000000,
      'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=900&q=80'
    ],
    [
      'Insumos Agrícolas Rurales',
      'Semillas y herramientas para fortalecer la autosuficiencia alimentaria.',
      1000000000,
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80'
    ],
    [
      'Rescate de Alimentos',
      'Logística para recuperar alimentos aptos para el consumo.',
      800000000,
      'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=900&q=80'
    ]
  ];

  for (const [title, description, goal, imageUrl] of campaigns) {
    await client.query(campaignSql, [
      orgId,
      title,
      description,
      goal,
      imageUrl
    ]);

    console.log(`Campaña verificada: ${title}`);
  }

  await client.query('COMMIT');

  console.log('Datos iniciales creados o ya existentes.');

} catch (error) {
  await client.query('ROLLBACK');

  console.error(
    'Error al inicializar los datos de demostración:',
    error
  );

  process.exitCode = 1;

} finally {
  client.release();
  await pool.end();
}
