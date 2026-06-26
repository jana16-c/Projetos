import { AppController } from './ui/appController.js';
import { resolveBackendBaseUrl } from './ui/backendClient.js';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    if (shouldRedirectToBackendApp()) {
      const backendBaseUrl = await resolveBackendBaseUrl();
      if (backendBaseUrl && backendBaseUrl !== window.location.origin) {
        renderBootMessage('Abrindo a aplicacao real em 127.0.0.1:8787...');
        window.location.replace(`${backendBaseUrl}/`);
        return;
      }

      renderBootMessage([
        'O Live Preview nao e estavel para esse processador.',
        'Inicie o backend e abra http://127.0.0.1:8787 .',
      ].join(' '));
      return;
    }

    new AppController();
  } catch (error) {
    console.error(error);
    renderBootMessage(`Erro ao iniciar app: ${error.message}`);
  }
});

function shouldRedirectToBackendApp() {
  if (window.location.protocol === 'file:') return false;
  if (String(window.location.port || '') === '8787') return false;

  const query = String(window.location.search || '').toLowerCase();
  return query.includes('vscode-livepreview=true')
    || String(window.location.port || '') === '3000'
    || /live-preview/i.test(window.location.href);
}

function renderBootMessage(message) {
  const status = document.querySelector('#statusText');
  if (status) status.textContent = message;

  const controls = document.querySelector('.controls');
  if (!controls) return;

  let note = document.querySelector('#bootNotice');
  if (!note) {
    note = document.createElement('div');
    note.id = 'bootNotice';
    note.className = 'panel';
    note.style.marginTop = '10px';
    note.style.fontSize = '12px';
    controls.prepend(note);
  }
  note.textContent = message;
}
