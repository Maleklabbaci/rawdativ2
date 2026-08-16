import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './contexts/ToastContext';
import App from './App.tsx';
import './index.css';
import './i18n';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker indisponible:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
