import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createReference } from '../utils/crypto.js';
import {
  createPayUPaymentSignature,
  mapPayUState,
  parsePayUCOPToCents,
  verifyPayUConfirmation
} from '../utils/payu.js';
import { addDonationEvent } from '../services/timeline.js';

const router = Router();
const donationRouter = Router();

function cleanText(value, maxLength) {
  return String(value ?? '').trim().replace(/[\u0000-\u001f]/g, '').slice(0, maxLength);
}

function getPayUConfig() {
  if (process.env.PAYU_ENVIRONMENT !== 'sandbox') {
    throw new Error('Esta versión académica solo permite pagos PayU Sandbox.');
  }
  const merchantId = process.env.PAYU_MERCHANT_ID;
  const accountId = process.env.PAYU_ACCOUNT_ID;
  const apiKey = process.env.PAYU_API_KEY;
  if (!merchantId || !accountId || !apiKey) {
    throw new Error('Configura PAYU_MERCHANT_ID, PAYU_ACCOUNT_ID y PAYU_API_KEY.');
  }
  let baseUrl;
  try {
    baseUrl = new URL(process.env.APP_BASE_URL);
  } catch {
    throw new Error('APP_BASE_URL debe ser una URL válida.');
  }
  if (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:') {
    throw new Error('APP_BASE_URL debe utilizar HTTPS en producción.');
  }
  return {
    merchantId,
    accountId,
    baseUrl,
    checkoutUrl: 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/'
  };
}

donationRouter.post('/checkout', authenticate, requireRole('donante'), async (req, res, next) => {
  const campaignId = Number(req.body?.campaignId);
  const amountCop = Number(req.body?.amountCop);
  const documentType = cleanText(req.body?.documentType, 25).toUpperCase();
  const documentNumber = cleanText(req.body?.documentNumber, 25);
  const phone = cleanText(req.body?.phone, 20).replace(/[^0-9+]/g, '');

  if (!Number.isSafeInteger(campaignId) || campaignId < 1 ||
      !Number.isSafeInteger(amountCop) || amountCop < 1000 || amountCop > 50000000) {
    return res.status(400).json({ error: 'Selecciona una campaña y un monto entre $1.000 y $50.000.000 COP.' });
  }
  if (!['CC', 'CE', 'NIT', 'PP', 'TI'].includes(documentType) ||
      !/^[A-Za-z0-9.-]{5,25}$/.test(documentNumber) ||
      !/^\+?[0-9]{7,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Completa un tipo y número de documento válidos y un teléfono de 7 a 15 dígitos.' });
  }

  let config;
  try {
    config = getPayUConfig();
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }

  const amountInCents = amountCop * 100;
  const amount = String(amountCop);
  const reference = createReference().replace(/[^A-Za-z0-9]/g, '');
  let signature;
  let responseUrl;
  let confirmationUrl;
  try {
    signature = createPayUPaymentSignature({ referenceCode: reference, amount, currency: 'COP' });
    responseUrl = new URL('/pago-resultado.html', config.baseUrl);
    responseUrl.searchParams.set('reference', reference);
    confirmationUrl = new URL('/api/pagos/payu/confirmacion', config.baseUrl).toString();
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT c.id AS campaign_id, u.nombre_completo, u.email
       FROM campanas c CROSS JOIN usuarios u
       WHERE c.id = $1 AND c.activa = TRUE AND u.id = $2 AND u.activo = TRUE`,
      [campaignId, req.user.sub]
    );
    const donor = result.rows[0];
    if (!donor) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La campaña o la cuenta de donante no está disponible.' });
    }

    const inserted = await client.query(
      `INSERT INTO donaciones (usuario_id, campana_id, monto_en_centavos, proveedor_pago, referencia_pago)
       VALUES ($1, $2, $3, 'payu', $4) RETURNING id`,
      [req.user.sub, campaignId, amountInCents, reference]
    );
    await addDonationEvent(client, inserted.rows[0].id, 'publicada', 'Donación creada; esperando confirmación del pago en PayU Sandbox.');
    await client.query('COMMIT');

    const fullName = cleanText(donor.nombre_completo, 150);
    const email = cleanText(donor.email, 255);
    const fields = {
      lng: 'es',
      merchantId: config.merchantId,
      accountId: config.accountId,
      algorithmSignature: process.env.PAYU_SIGNATURE_ALGORITHM || 'SHA256',
      signature,
      description: `DonacionSobreMesa${inserted.rows[0].id}`,
      referenceCode: reference,
      amount,
      tax: '0',
      taxReturnBase: '0',
      currency: 'COP',
      test: '1',
      payerFullName: fullName.slice(0, 50),
      payerEmail: email,
      payerPhone: phone,
      payerDocumentType: documentType,
      payerDocument: documentNumber,
      buyerFullName: fullName,
      buyerEmail: email,
      buyerDocumentType: documentType,
      buyerDocument: documentNumber,
      telephone: phone,
      responseUrl: responseUrl.toString(),
      confirmationUrl
    };

    return res.status(201).json({
      donationId: inserted.rows[0].id,
      provider: 'payu',
      checkoutUrl: config.checkoutUrl,
      fields
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client.release();
  }
});

// Endpoint público servidor-a-servidor: PayU envía application/x-www-form-urlencoded.
router.post('/confirmacion', async (req, res, next) => {
  const event = req.body || {};
  try {
    const config = getPayUConfig();
    if (String(event.merchant_id || '') !== String(config.merchantId)) {
      return res.status(400).send('Merchant inválido');
    }
    if (!verifyPayUConfirmation(event)) {
      return res.status(401).send('Firma inválida');
    }

    const status = mapPayUState(event.state_pol);
    if (!status) return res.status(400).send('Estado de transacción no reconocido');
    const reference = cleanText(event.reference_sale, 255);
    const transactionId = cleanText(event.transaction_id || event.reference_pol, 150);
    const amountInCents = parsePayUCOPToCents(event.value);
    const currency = cleanText(event.currency, 3).toUpperCase();
    if (!reference || !transactionId || amountInCents === null || currency !== 'COP') {
      return res.status(400).send('Datos de transacción incompletos');
    }
    if (process.env.PAYU_ENVIRONMENT === 'sandbox' && String(event.test) !== '1') {
      return res.status(400).send('La notificación no pertenece al ambiente de pruebas');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT id, monto_en_centavos, moneda, estado_pago, campana_id, proveedor_pago
         FROM donaciones WHERE referencia_pago = $1 FOR UPDATE`,
        [reference]
      );
      const donation = result.rows[0];
      if (!donation || donation.proveedor_pago !== 'payu') {
        await client.query('ROLLBACK');
        return res.status(404).send('Referencia de donación desconocida');
      }
      if (Number(donation.monto_en_centavos) !== amountInCents || donation.moneda !== currency) {
        await client.query('ROLLBACK');
        return res.status(400).send('El monto o la moneda no coincide con la donación');
      }

      await client.query(
        `INSERT INTO transacciones_pago
          (donacion_id, proveedor, transaction_id, referencia, estado, monto_en_centavos, moneda, tipo_metodo_pago, payload)
         VALUES ($1, 'payu', $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (proveedor, transaction_id)
         DO UPDATE SET estado = EXCLUDED.estado, payload = EXCLUDED.payload, actualizada_en = NOW()`,
        [donation.id, transactionId, reference, status, amountInCents, currency,
          cleanText(event.payment_method_name || event.payment_method_type, 40) || null,
          JSON.stringify(event)]
      );

      const previousStatus = donation.estado_pago;
      // PayU puede enviar varios intentos para la misma referencia. Una aprobación previa es terminal.
      if (previousStatus !== 'APPROVED') {
        await client.query(
          'UPDATE donaciones SET estado_pago = $2, actualizada_en = NOW() WHERE id = $1',
          [donation.id, status]
        );
        if (status === 'APPROVED') {
          await client.query(
            `INSERT INTO solicitudes (donacion_id, organizacion_id)
             SELECT $1, organizacion_id FROM campanas WHERE id = $2
             ON CONFLICT (donacion_id) DO NOTHING`,
            [donation.id, donation.campana_id]
          );
          await client.query(
            'UPDATE campanas SET recaudado_en_centavos = recaudado_en_centavos + $2 WHERE id = $1',
            [donation.campana_id, donation.monto_en_centavos]
          );
          await client.query("UPDATE donaciones SET estado_entrega = 'solicitada' WHERE id = $1", [donation.id]);
          await addDonationEvent(client, donation.id, 'solicitada', 'Pago aprobado por PayU Sandbox. La solicitud quedó disponible para la organización.');
        } else if (previousStatus !== status) {
          await addDonationEvent(client, donation.id, 'pago_actualizado', `PayU reportó el estado ${status}.`);
        }
      }
      await client.query('COMMIT');
      return res.status(200).send('OK');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

export { donationRouter as payuDonationRoutes };
export default router;
