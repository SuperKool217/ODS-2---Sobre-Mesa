import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function createReference() {
  return `HC-${randomBytes(12).toString('hex').toUpperCase()}`;
}

export function createJti() {
  return randomUUID();
}
