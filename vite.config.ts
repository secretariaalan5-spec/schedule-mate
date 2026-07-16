import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  // The PWA/service worker must never be active outside a real production
  // build. Lovable preview and `vite dev` run with command === 'serve',
  // which is exactly the case that caused a stale, previously-broken
  // service worker to keep serving an old cached bundle forever.
  const isProdBuild = command === "build" && mode === "production";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        // Only ever emit/register the service worker for real production
        // builds. In dev/preview `disable: true` makes vite-plugin-pwa
        // fall back to a no-op stub for `virtual:pwa-register/react`,
        // so PWAHandler stays safe to import everywhere.
        disable: !isProdBuild,
        devOptions: { enabled: false },
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // Never let the SW answer navigations with a stale cached
          // index.html pointing at an old, deleted hashed bundle.
          navigateFallbackDenylist: [/\.[a-zA-Z0-9]+$/],
        },
        manifest: {
          name: 'Saúde da Mulher — Agendamento',
          short_name: 'Saúde Mulher',
          description: 'Sistema de Agendamento — Camocim',
          theme_color: '#0d4a7a',
          icons: [
            { src: 'logo.png', sizes: '192x192', type: 'image/png' },
            { src: 'logo.png', sizes: '512x512', type: 'image/png' },
            { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
