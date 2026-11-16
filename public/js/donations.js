import { apiFetch, requireSession } from './api.js';

requireSession('donante');
const root = document.querySelector('#donations');
try {
  const data = await apiFetch('/api/donaciones/mias');
  root.innerHTML = data.donations.map((donation) => `
    <article class="panel">
      <h3>${escapeHtml(donation.campana)}</h3>
      <p>Monto: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(donation.monto_en_centavos) / 100)}</p>
      <p>Pago: ${escapeHtml(donation.estado_pago)} | Entrega: ${escapeHtml(donation.estado_entrega)}</p>
      <a href="/trazabilidad.html?donacion=${donation.id}">Ver trazabilidad</a>
      ${donation.estado_entrega === 'en_camino' ? `<a href="/confirmar-entrega.html?entrega=${donation.entrega_id || ''}">Confirmar entrega</a>` : ''}
    </article>`).join('') || '<p>Todavía no tienes donaciones.</p>';
} catch (error) { root.textContent = error.message; }

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
