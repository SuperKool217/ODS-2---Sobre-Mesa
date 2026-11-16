import { saveSession } from './api.js';

const form = document.querySelector('#login-form');
const message = document.querySelector('#message');
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = 'Validando acceso...';
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');
    saveSession(data.user);
    location.href = data.user.rol === 'organizacion' ? '/organizacion.html' : '/donaciones.html';
  } catch (error) {
    message.textContent = error.message;
  }
});
