import { apiFetch, requireSession } from './api.js';

requireSession('donante');
const form = document.querySelector('#donation-form');
const campaignSelect = document.querySelector('#campaignId');
const message = document.querySelector('#message');

async function loadCampaigns() {
  const data = await apiFetch('/api/campanas');
  campaignSelect.innerHTML = data.campaigns.map((campaign) =>
    `<option value="${campaign.id}">${escapeHtml(campaign.titulo)} — Meta: ${formatCop(campaign.meta_en_centavos)}</option>`
  ).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function formatCop(cents) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(cents) / 100);
}

await loadCampaigns();
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = 'Preparando el pago de prueba con PayU...';
  const campaignId = Number(campaignSelect.value);
  const amountCop = Number(document.querySelector('#amountCop').value);
  const documentType = document.querySelector('#documentType').value;
  const documentNumber = document.querySelector('#documentNumber').value.trim();
  const phone = document.querySelector('#phone').value.trim();

  try {
    const checkout = await apiFetch('/api/donaciones/checkout', {
      method: 'POST',
      body: JSON.stringify({ campaignId, amountCop, documentType, documentNumber, phone })
    });

    const paymentForm = document.createElement('form');
    paymentForm.method = 'POST';
    paymentForm.action = checkout.checkoutUrl;
    paymentForm.acceptCharset = 'UTF-8';
    paymentForm.hidden = true;
    for (const [name, value] of Object.entries(checkout.fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = String(value);
      paymentForm.appendChild(input);
    }
    document.body.appendChild(paymentForm);
    message.textContent = 'Redirigiendo a PayU Sandbox. No se realizará un cobro real.';
    paymentForm.submit();
  } catch (error) {
    message.textContent = error.message;
  }
});
