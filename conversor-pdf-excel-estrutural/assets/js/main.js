import { AppController } from './ui/appController.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    new AppController();
  } catch (error) {
    console.error(error);
    const status = document.querySelector('#statusText');
    if (status) status.textContent = `Erro ao iniciar app: ${error.message}`;
  }
});
