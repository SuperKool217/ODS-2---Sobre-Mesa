import { apiFetch, requireSession } from './api.js';

requireSession('organizacion');
const requestsNode = document.querySelector('#requests');
const deliveriesNode = document.querySelector('#deliveries');
const message = document.querySelector('#message');
const qrTimers = new Map();

function stopQrLoops() {
  for (const timer of qrTimers.values()) clearTimeout(timer);
  qrTimers.clear();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function load() {
  stopQrLoops();
  const [requests, deliveries] = await Promise.all([
    apiFetch('/api/organizacion/solicitudes'),
    apiFetch('/api/organizacion/entregas')
  ]);
  requestsNode.innerHTML = requests.requests.map((item) => `
    <article class="panel">
      <h3>${escapeHtml(item.campana)}</h3>
      <p>Donante: ${escapeHtml(item.donante)}</p>
      <p>Solicitud: ${escapeHtml(item.estado)}</p>
      ${item.estado === 'solicitada' ? `<button data-accept="${item.id}">Aceptar y crear entrega</button>` : ''}
    </article>`).join('') || '<p>No hay solicitudes pendientes.</p>';
  deliveriesNode.innerHTML = deliveries.deliveries.map((item) => `
    <article class="panel">
      <h3>Entrega #${item.id}: ${escapeHtml(item.campana)}</h3>
      <p>Donante: ${escapeHtml(item.donante)}</p>
      <p>Estado: ${escapeHtml(item.estado)}</p>
      ${item.estado === 'preparando' ? `<button data-transit="${item.id}">Marcar en camino</button>` : ''}
      ${item.estado === 'en_camino' ? `<div id="qr-${item.id}" class="qr-box">Generando QR dinámico...</div>` : ''}
    </article>`).join('') || '<p>No hay entregas registradas.</p>';
  for (const item of deliveries.deliveries.filter((delivery) => delivery.estado === 'en_camino')) {
    await refreshQr(Number(item.id));
  }
}

requestsNode.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-accept]');
  if (!button) return;
  try { await apiFetch(`/api/solicitudes/${button.dataset.accept}/aceptar`, { method: 'PATCH' }); await load(); }
  catch (error) { message.textContent = error.message; }
});

deliveriesNode.addEventListener('click', async (event) => {
  const transit = event.target.closest('[data-transit]');
  try {
    if (transit) {
      await apiFetch(`/api/entregas/${transit.dataset.transit}/en-camino`, { method: 'PATCH' });
      await load();
    }
  } catch (error) { message.textContent = error.message; }
});

async function refreshQr(deliveryId) {
  const target = document.querySelector(`#qr-${deliveryId}`);
  if (!target) return;
  try {
    const data = await apiFetch(`/api/entregas/${deliveryId}/qr-token`);
    target.innerHTML = '<div class="qr-image"></div><p>El código se renueva automáticamente cada 60 segundos.</p>';
    new window.QRCode(target.querySelector('.qr-image'), { text: data.token, width: 240, height: 240, correctLevel: window.QRCode.CorrectLevel.H });
    const timer = setTimeout(() => refreshQr(deliveryId), data.renovarEn * 1000);
    qrTimers.set(deliveryId, timer);
  } catch (error) {
    target.textContent = error.message;
  }
}

load().catch((error) => { message.textContent = error.message; });
