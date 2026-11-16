import { apiFetch, clearSession } from './api.js';

function createLink(label, href, className) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = label;
  link.className = className;
  return link;
}

function renderSessionNavigation() {
  const navigation = document.querySelector('#main-navigation');
  if (!navigation) return;

  let user;
  try {
    user = JSON.parse(sessionStorage.getItem('cerohambre_user') || 'null');
  } catch {
    sessionStorage.removeItem('cerohambre_user');
    return;
  }

  if (!user || !['donante', 'organizacion'].includes(user.rol)) return;

  const greeting = document.createElement('span');
  greeting.className = 'text-gray-600 text-sm font-medium';
  const firstName = String(user.nombre || '').trim().split(/\s+/)[0];
  greeting.textContent = firstName ? `Hola, ${firstName}` : 'Tu cuenta';

  const linkClass = 'text-gray-600 hover:text-orange-600 font-medium transition-colors';
  const actionClass = 'bg-orange-600 text-white px-6 py-2.5 rounded-full font-semibold shadow-lg shadow-orange-500/30 hover:bg-orange-500 hover:-translate-y-0.5 transition-all duration-200';

  const roleLink = user.rol === 'organizacion'
    ? createLink('Panel de organización', '/organizacion.html', linkClass)
    : createLink('Mis donaciones', '/donaciones.html', linkClass);

  const campaignLink = createLink('Campañas', '#campanas', linkClass);
  const primaryAction = user.rol === 'donante'
    ? createLink('Donar ahora', '/donar.html', actionClass)
    : createLink('Ver campañas', '#campanas', actionClass);

  const signOut = document.createElement('button');
  signOut.type = 'button';
  signOut.textContent = 'Cerrar sesión';
  signOut.className = 'text-gray-500 hover:text-red-600 font-medium transition-colors';
  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    signOut.textContent = 'Cerrando sesión...';
    try {
      await clearSession();
    } catch (error) {
      console.warn('No se pudo confirmar el cierre de sesión:', error.message);
    }
    location.assign('/');
  });

  navigation.replaceChildren(greeting, campaignLink, roleLink, primaryAction, signOut);
}

async function refreshCampaigns() {
  const counters = document.querySelectorAll('[data-campaign-count]');
  if (!counters.length) return;

  try {
    const data = await apiFetch('/api/campanas');
    counters.forEach((node) => {
      node.textContent = String(data.campaigns.length);
    });
  } catch (error) {
    console.warn('No se pudieron actualizar las campañas:', error.message);
  }
}

renderSessionNavigation();
refreshCampaigns();
