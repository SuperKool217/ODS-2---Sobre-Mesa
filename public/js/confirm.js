import { apiFetch, requireSession } from './api.js';

requireSession('donante');
const params = new URLSearchParams(location.search);
const deliveryId = Number(params.get('entrega'));
const message = document.querySelector('#message');
const photoInput = document.querySelector('#photo');
const submitButton = document.querySelector('#submit');
let scannedToken = null;
let latitude = null;
let longitude = null;
let scanner = null;

if (!Number.isSafeInteger(deliveryId) || deliveryId < 1) {
  message.textContent = 'El enlace de confirmación no contiene una entrega válida.';
  submitButton.disabled = true;
} else {
  startScanner();
}

async function startScanner() {
  scanner = new window.Html5Qrcode('reader');
  try {
    await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, async (decodedText) => {
      scannedToken = decodedText;
      message.textContent = 'Código leído. Obteniendo ubicación...';
      await scanner.stop();
      navigator.geolocation.getCurrentPosition((position) => {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        message.textContent = 'Código y ubicación obtenidos. Selecciona o toma una fotografía de la entrega.';
      }, () => {
        message.textContent = 'No fue posible obtener la ubicación. Debes permitir el acceso al GPS.';
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
  } catch (error) {
    message.textContent = `No se pudo activar la cámara: ${error.message || error}`;
  }
}

submitButton.addEventListener('click', async () => {
  if (!scannedToken || latitude === null || longitude === null || !photoInput.files[0]) {
    message.textContent = 'Primero escanea el QR, permite obtener la ubicación y selecciona una foto.';
    return;
  }
  const form = new FormData();
  form.append('token', scannedToken);
  form.append('lat', String(latitude));
  form.append('lng', String(longitude));
  form.append('foto', photoInput.files[0]);
  submitButton.disabled = true;
  try {
    const result = await apiFetch(`/api/entregas/${deliveryId}/validar-qr`, { method: 'POST', body: form });
    message.textContent = result.message;
  } catch (error) {
    message.textContent = error.message;
    submitButton.disabled = false;
  }
});
