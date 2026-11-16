const form = document.querySelector('#register-form');
const roleInputs = document.querySelectorAll('input[name="rol"]');
const organizationFields = document.querySelector('#organization-fields');
const organizationInputs = organizationFields?.querySelectorAll('[data-organization-required]') || [];
const accountStep = document.querySelector('#account-step');
const detailsStep = document.querySelector('#details-step');
const stepper = document.querySelector('#register-stepper');
const nextButton = document.querySelector('#next-step');
const backButton = document.querySelector('#back-step');
const backToRoleButton = document.querySelector('#back-to-role');
const submitButton = document.querySelector('#submit-register');
const selectedRoleLabel = document.querySelector('#selected-role');
const message = document.querySelector('#message');
const detailsMessage = document.querySelector('#details-message');
const successPanel = document.querySelector('#success-panel');
const successMessage = document.querySelector('#success-message');

let activeStep = 1;

function selectedRole() {
  return document.querySelector('input[name="rol"]:checked')?.value || '';
}

function clearFeedback() {
  for (const region of [message, detailsMessage]) {
    if (!region) continue;
    region.textContent = '';
    region.hidden = true;
  }
}

function showFeedback(region, text) {
  if (!region) return;
  region.textContent = text;
  region.hidden = false;
}

function updateOrganizationFields() {
  const isOrganization = selectedRole() === 'organizacion';
  if (organizationFields) organizationFields.hidden = !isOrganization;
  for (const input of organizationInputs) {
    input.required = isOrganization;
  }
  if (selectedRoleLabel) {
    selectedRoleLabel.textContent = isOrganization ? 'Cuenta de organización' : 'Cuenta de donante';
  }
}

function showStep(step) {
  activeStep = step;
  accountStep.hidden = step !== 1;
  detailsStep.hidden = step !== 2;

  const firstIndicator = document.querySelector('#progress-step-1');
  const secondIndicator = document.querySelector('#progress-step-2');
  firstIndicator?.toggleAttribute('aria-current', step === 1);
  secondIndicator?.toggleAttribute('aria-current', step === 2);

  if (step === 1) {
    roleInputs[0]?.focus();
  } else {
    document.querySelector('#nombre')?.focus();
  }
  clearFeedback();
}

nextButton?.addEventListener('click', () => {
  if (!selectedRole()) {
    showFeedback(message, 'Selecciona si vas a participar como donante o como organización.');
    roleInputs[0]?.focus();
    return;
  }
  updateOrganizationFields();
  showStep(2);
});

for (const input of roleInputs) {
  input.addEventListener('change', () => {
    updateOrganizationFields();
    clearFeedback();
  });
}

backButton?.addEventListener('click', () => showStep(1));
backToRoleButton?.addEventListener('click', () => showStep(1));

form?.addEventListener('input', clearFeedback);

document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const shouldReveal = input.type === 'password';
    input.type = shouldReveal ? 'text' : 'password';
    button.textContent = shouldReveal ? 'Ocultar' : 'Mostrar';
    button.setAttribute('aria-pressed', String(shouldReveal));
  });
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (activeStep === 1) {
    if (!selectedRole()) {
      showFeedback(message, 'Selecciona un tipo de cuenta para continuar.');
      return;
    }
    updateOrganizationFields();
    showStep(2);
    return;
  }

  clearFeedback();
  if (!form.reportValidity()) return;

  const password = document.querySelector('#password')?.value || '';
  const passwordConfirmation = document.querySelector('#password-confirm')?.value || '';

  if (password !== passwordConfirmation) {
    showFeedback(detailsMessage, 'Las contraseñas no coinciden. Revisa ambos campos.');
    document.querySelector('#password-confirm')?.focus();
    return;
  }

  if (new TextEncoder().encode(password).length > 72) {
    showFeedback(detailsMessage, 'La contraseña es demasiado larga. Prueba con una contraseña más corta.');
    document.querySelector('#password')?.focus();
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  submitButton.disabled = true;
  submitButton.textContent = 'Creando cuenta...';

  try {
    const response = await fetch('/api/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'No se pudo completar el registro. Revisa los datos e inténtalo de nuevo.');
    }

    form.hidden = true;
    stepper.hidden = true;
    successMessage.textContent = result.message || 'Tu cuenta fue creada correctamente.';
    successPanel.hidden = false;
    successPanel.querySelector('a[href="/login.html"]')?.focus();
  } catch (error) {
    showFeedback(detailsMessage, error.message || 'Ocurrió un problema al crear la cuenta. Inténtalo nuevamente.');
    detailsMessage?.focus();
  } finally {
    if (!successPanel.hidden) {
      submitButton.disabled = true;
    } else {
      submitButton.disabled = false;
      submitButton.textContent = 'Crear cuenta';
    }
  }
});

updateOrganizationFields();
