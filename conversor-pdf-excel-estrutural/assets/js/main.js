window.addEventListener('DOMContentLoaded', () => {
  startApp();
});

async function startApp() {
  const version = window.__APP_VERSION__ ? `?v=${encodeURIComponent(window.__APP_VERSION__)}` : '';
  try {
    const { AppController } = await import(`./ui/appController.js${version}`);
    new AppController();
  } catch (error) {
    console.error(error);
    renderBootMessage(`Erro ao iniciar app: ${error.message}`);
  }
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
