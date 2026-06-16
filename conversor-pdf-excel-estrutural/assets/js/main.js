import { AppController } from './ui/appController.js';

const extraCss = document.createElement('link');
extraCss.rel = 'stylesheet';
extraCss.href = 'assets/css/tests.css';
document.head.appendChild(extraCss);

window.addEventListener('DOMContentLoaded', () => {
  try {
    new AppController();
  } catch (error) {
    console.error(error);
    const status = document.querySelector('#statusText');
    if (status) status.textContent = `Erro ao iniciar app: ${error.message}`;
  }
});
