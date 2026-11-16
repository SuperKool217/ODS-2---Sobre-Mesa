import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPayUPaymentSignature,
  createPayUConfirmationSignature,
  formatPayUWebhookValue,
  mapPayUState,
  parsePayUCOPToCents,
  verifyPayUConfirmation
} from '../src/utils/payu.js';

process.env.PAYU_API_KEY = '4Vj8eK4rloUd272L48hsrarnUA';
process.env.PAYU_MERCHANT_ID = '508029';
process.env.PAYU_SIGNATURE_ALGORITHM = 'MD5';
process.env.PAYU_CONFIRMATION_SIGNATURE_ALGORITHM = 'HMAC-SHA256';
process.env.PAYU_SIGNATURE_SECRET = 'test123';

test('genera firma de formulario igual al ejemplo oficial de PayU', () => {
  const signature = createPayUPaymentSignature({
    referenceCode: 'TestPayU', amount: '20000', currency: 'COP'
  });
  assert.equal(signature, '7ee7cf808ce6a39b17481c54f2c57acc');
});

test('genera firma SHA256 del formulario según el ejemplo oficial de PayU', () => {
  process.env.PAYU_SIGNATURE_ALGORITHM = 'SHA256';
  const signature = createPayUPaymentSignature({
    referenceCode: 'TestPayU', amount: '20000', currency: 'COP'
  });
  assert.equal(signature, 'af3899a22336b79db46006491d15813158826f944599bf3bf601e2327f898022');
  process.env.PAYU_SIGNATURE_ALGORITHM = 'MD5';
});

test('formatea el monto del webhook según las reglas de PayU', () => {
  assert.equal(formatPayUWebhookValue('150.00'), '150.0');
  assert.equal(formatPayUWebhookValue('150.25'), '150.25');
  assert.equal(formatPayUWebhookValue('150'), '150.0');
});

test('convierte valores COP a centavos sin usar decimales de punto flotante', () => {
  assert.equal(parsePayUCOPToCents('10000.00'), 1000000);
  assert.equal(parsePayUCOPToCents('10000.5'), 1000050);
  assert.equal(parsePayUCOPToCents('abc'), null);
});

test('valida firma HMAC-SHA256 de confirmación con el formato documentado', () => {
  const payload = {
    merchant_id: '508029',
    reference_sale: 'PayUTest01',
    value: '150.00',
    currency: 'USD',
    state_pol: '4'
  };
  const signature = createPayUConfirmationSignature(payload);
  assert.equal(signature, '65fb2b3452572784e23e7d6480359fd2507c54dd285ca3c4dceffb8764cfb66f');
  assert.equal(verifyPayUConfirmation({ ...payload, sign: signature }), true);
  assert.equal(verifyPayUConfirmation({ ...payload, value: '151.00', sign: signature }), false);
});

test('traduce estados conocidos de PayU a estados internos', () => {
  assert.equal(mapPayUState('4'), 'APPROVED');
  assert.equal(mapPayUState('6'), 'DECLINED');
  assert.equal(mapPayUState('5'), 'VOIDED');
  assert.equal(mapPayUState('14'), 'PENDING');
  assert.equal(mapPayUState('999'), null);
});
