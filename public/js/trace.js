import { apiFetch, requireSession } from './api.js';

requireSession();
const donationId = Number(new URLSearchParams(location.search).get('donacion'));
const message = document.querySelector('#message');
const timeline = document.querySelector('#timeline');
try {
  const data = await apiFetch(`/api/donaciones/${donationId}/trazabilidad`);
  timeline.innerHTML = data.events.map((event) => `
    <li><strong>${escapeHtml(event.tipo)}</strong><p>${escapeHtml(event.descripcion)}</p><small>${new Date(event.creado_en).toLocaleString('es-CO')}</small></li>
  `).join('');
  if (data.donation.lat_entrega && data.donation.lng_entrega) {
    const map = L.map('map').setView([Number(data.donation.lat_entrega), Number(data.donation.lng_entrega)], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    L.marker([Number(data.donation.lat_entrega), Number(data.donation.lng_entrega)]).addTo(map).bindPopup('Punto de entrega confirmado');
  } else {
    document.querySelector('#map').textContent = 'El mapa estará disponible cuando se confirme la entrega.';
  }
} catch (error) { message.textContent = error.message; }

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
