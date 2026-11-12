import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

// Serve the parent HTML before Vite's SPA fallback in both dev and preview.
function parentEntry(): Plugin {
  const middleware = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url && /^\/espace-parent\/?(?:\?|$)/.test(req.url)) {
      req.url = req.url.replace(/^\/espace-parent\/?/, '/parent.html');
    }
    next();
  };
  return { name: 'parent-entry', configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } };
}

export default defineConfig(() => {
  return {
    plugins: [parentEntry(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2022',
      cssMinify: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        input: { index: path.resolve(__dirname, 'index.html'), parent: path.resolve(__dirname, 'parent.html') },
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n';
            if (id.includes('qrcode')) return 'vendor-qr';
            if (id.includes('pdfjs-dist')) return 'vendor-pdf-viewer';
            if (id.includes('pdf-lib') || id.includes('@pdf-lib') || id.includes('pako')) return 'vendor-pdf';
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
              return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      // Arena previews run on a proxied e2b.app host, not localhost.
      allowedHosts: ['.e2b.app'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
