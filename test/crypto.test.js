import test from 'node:test';
import assert from 'node:assert/strict';
import { createJti, createReference } from '../src/utils/crypto.js';

test('crea identificadores únicos para referencias y tokens QR', () => {
  const firstReference = createReference();
  const secondReference = createReference();
  const firstJti = createJti();
  const secondJti = createJti();
  assert.match(firstReference, /^HC-[A-F0-9]{24}$/);
  assert.notEqual(firstReference, secondReference);
  assert.match(firstJti, /^[0-9a-f-]{36}$/i);
  assert.notEqual(firstJti, secondJti);
});
