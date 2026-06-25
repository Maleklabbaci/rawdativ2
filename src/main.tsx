import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './contexts/ToastContext';
import App from './App.tsx';
import './index.css';
import './i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
