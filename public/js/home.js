import { apiFetch } from './api.js';

async function refreshCampaigns() {
  try {
    const data = await apiFetch('/api/campanas');
    document.querySelectorAll('[data-campaign-count]').forEach((node) => {
      node.textContent = String(data.campaigns.length);
    });
  } catch (error) {
    console.warn('No se pudieron actualizar las campañas:', error.message);
  }
}

refreshCampaigns();
