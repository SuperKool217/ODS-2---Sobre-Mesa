import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SUPPORTED_ALGORITHMS = new Set(['MD5', 'SHA1', 'SHA256', 'HMAC-SHA256']);

function digest(value, algorithm, secret) {
  const normalized = String(algorithm || 'SHA256').toUpperCase();
  if (!SUPPORTED_ALGORITHMS.has(normalized)) {
    throw new Error(`Algoritmo de firma PayU no compatible: ${normalized}`);
  }
  if (normalized === 'HMAC-SHA256') {
    return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
  }
  const hashName = normalized === 'SHA1' ? 'sha1' : normalized.toLowerCase();
  return createHash(hashName).update(value, 'utf8').digest('hex');
}

function safeEqualHex(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(received.trim().toLowerCase(), 'hex');
  const b = Buffer.from(expected.toLowerCase(), 'hex');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está configurada.`);
  return value;
}

export function createPayUPaymentSignature({ referenceCode, amount, currency = 'COP' }) {
  const apiKey = requiredEnv('PAYU_API_KEY');
  const merchantId = requiredEnv('PAYU_MERCHANT_ID');
  const algorithm = process.env.PAYU_SIGNATURE_ALGORITHM || 'SHA256';
  const base = `${apiKey}~${merchantId}~${referenceCode}~${amount}~${currency}`;
  const hmacSecret = process.env.PAYU_SIGNATURE_SECRET || apiKey;
  return digest(base, algorithm, hmacSecret);
}

export function formatPayUWebhookValue(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error('El valor informado por PayU tiene un formato inválido.');
  const whole = match[1];
  const decimals = match[2] || '';
  if (!decimals) return `${whole}.0`;
  if (decimals.length === 1) return `${whole}.${decimals}`;
  return decimals[1] === '0' ? `${whole}.${decimals[0]}` : `${whole}.${decimals}`;
}

export function parsePayUCOPToCents(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const fraction = (match[2] || '').padEnd(2, '0');
  const cents = Number(match[1]) * 100 + Number(fraction || 0);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function createPayUConfirmationSignature(payload) {
  const apiKey = requiredEnv('PAYU_API_KEY');
  const algorithm = process.env.PAYU_CONFIRMATION_SIGNATURE_ALGORITHM || 'MD5';
  const formattedValue = formatPayUWebhookValue(payload.value);
  const base = [
    apiKey,
    payload.merchant_id,
    payload.reference_sale,
    formattedValue,
    payload.currency,
    payload.state_pol
  ].join('~');
  const hmacSecret = process.env.PAYU_SIGNATURE_SECRET || apiKey;
  return digest(base, algorithm, hmacSecret);
}

export function verifyPayUConfirmation(payload) {
  if (!payload || typeof payload !== 'object' || !payload.sign) return false;
  try {
    return safeEqualHex(String(payload.sign), createPayUConfirmationSignature(payload));
  } catch {
    return false;
  }
}

export function mapPayUState(statePol) {
  const state = String(statePol);
  if (state === '4') return 'APPROVED';
  if (state === '6') return 'DECLINED';
  if (state === '5') return 'VOIDED';
  if (['7', '10', '12', '14', '15', '18'].includes(state)) return 'PENDING';
  return null;
}
