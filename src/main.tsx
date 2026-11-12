import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { ToastProvider } from './contexts/ToastContext';
import App from './App.tsx';
import './index.css';
import './i18n';

// Dedicated, isolated demo server; never enabled in a production build.
if (import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true' && import.meta.env.VITE_DEMO_ADMIN === 'true' && window.location.pathname === '/') {
  window.history.replaceState(null, '', '/admin');
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker indisponible:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <App />
      </ToastProvider>
    </MotionConfig>
  </StrictMode>,
);
