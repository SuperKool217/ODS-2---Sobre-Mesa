const form = document.querySelector('#register-form');
const message = document.querySelector('#message');
const role = document.querySelector('#role');
const organizationFields = document.querySelector('#organization-fields');
role?.addEventListener('change', () => {
  organizationFields.hidden = role.value !== 'organizacion';
});
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = 'Creando cuenta...';
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch('/api/auth/registro', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo completar el registro.');
    message.textContent = result.message;
    form.reset();
    organizationFields.hidden = true;
  } catch (error) { message.textContent = error.message; }
});
