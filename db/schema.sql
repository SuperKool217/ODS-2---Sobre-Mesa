BEGIN;

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('donante', 'organizacion', 'admin')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizaciones (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    ubicacion VARCHAR(255) NOT NULL,
    documento_legal VARCHAR(60) NOT NULL UNIQUE,
    verificada BOOLEAN NOT NULL DEFAULT FALSE,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campanas (
    id BIGSERIAL PRIMARY KEY,
    organizacion_id BIGINT NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    meta_en_centavos BIGINT NOT NULL CHECK (meta_en_centavos > 0),
    recaudado_en_centavos BIGINT NOT NULL DEFAULT 0 CHECK (recaudado_en_centavos >= 0),
    fecha_limite DATE,
    imagen_url TEXT,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donaciones (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    campana_id BIGINT NOT NULL REFERENCES campanas(id) ON DELETE RESTRICT,
    monto_en_centavos BIGINT NOT NULL CHECK (monto_en_centavos >= 100000),
    moneda CHAR(3) NOT NULL DEFAULT 'COP' CHECK (moneda = 'COP'),
    proveedor_pago VARCHAR(20) NOT NULL DEFAULT 'payu' CHECK (proveedor_pago IN ('payu', 'mercadopago', 'manual')),
    referencia_pago VARCHAR(255) NOT NULL UNIQUE,
    estado_pago VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (estado_pago IN ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')),
    estado_entrega VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado_entrega IN ('pendiente', 'solicitada', 'aceptada', 'en_camino', 'entregado')),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitudes (
    id BIGSERIAL PRIMARY KEY,
    donacion_id BIGINT NOT NULL UNIQUE REFERENCES donaciones(id) ON DELETE RESTRICT,
    organizacion_id BIGINT NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
    estado VARCHAR(20) NOT NULL DEFAULT 'solicitada'
        CHECK (estado IN ('solicitada', 'aceptada', 'completada', 'cancelada')),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aceptada_en TIMESTAMPTZ,
    completada_en TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS entregas (
    id BIGSERIAL PRIMARY KEY,
    solicitud_id BIGINT NOT NULL UNIQUE REFERENCES solicitudes(id) ON DELETE RESTRICT,
    organizacion_id BIGINT NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
    estado VARCHAR(20) NOT NULL DEFAULT 'preparando'
        CHECK (estado IN ('preparando', 'en_camino', 'entregada')),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    en_camino_en TIMESTAMPTZ,
    entregada_en TIMESTAMPTZ,
    lat_entrega NUMERIC(9,6) CHECK (lat_entrega BETWEEN -90 AND 90),
    lng_entrega NUMERIC(9,6) CHECK (lng_entrega BETWEEN -180 AND 180),
    foto_evidencia BYTEA,
    foto_mime VARCHAR(40),
    foto_bytes INTEGER CHECK (foto_bytes IS NULL OR foto_bytes <= 5242880)
);

CREATE TABLE IF NOT EXISTS qr_tokens_usados (
    jti UUID PRIMARY KEY,
    entrega_id BIGINT NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
    usado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria_qr (
    id BIGSERIAL PRIMARY KEY,
    entrega_id BIGINT REFERENCES entregas(id) ON DELETE SET NULL,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    resultado VARCHAR(10) NOT NULL CHECK (resultado IN ('valido', 'rechazado')),
    motivo VARCHAR(40),
    lat NUMERIC(9,6),
    lng NUMERIC(9,6),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eventos_donacion (
    id BIGSERIAL PRIMARY KEY,
    donacion_id BIGINT NOT NULL REFERENCES donaciones(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    descripcion VARCHAR(240) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transacciones_pago (
    id BIGSERIAL PRIMARY KEY,
    donacion_id BIGINT NOT NULL REFERENCES donaciones(id) ON DELETE RESTRICT,
    proveedor VARCHAR(20) NOT NULL CHECK (proveedor IN ('payu', 'mercadopago', 'manual')),
    transaction_id VARCHAR(150),
    referencia VARCHAR(255) NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')),
    monto_en_centavos BIGINT NOT NULL,
    moneda CHAR(3) NOT NULL,
    tipo_metodo_pago VARCHAR(40),
    payload JSONB,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (proveedor, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_campanas_activas ON campanas(activa, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_donaciones_usuario ON donaciones(usuario_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_org ON solicitudes(organizacion_id, estado, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_entregas_org ON entregas(organizacion_id, estado, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_donacion ON eventos_donacion(donacion_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_auditoria_qr_fecha ON auditoria_qr(creado_en DESC);

COMMIT;
