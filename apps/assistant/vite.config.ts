import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Until Assistant moves off /, its root-scoped service worker must never
      // serve the Assistant offline shell for peer ALOHA applications.
      // Without an allowlist, /health/ and /settings/ navigations can render
      // a cached Assistant page even when Cloudflare Routes are correct.
      workbox: {
        navigateFallbackAllowlist: [/^\/$/],
      },
      manifest: {
        name: 'ALOHA Assistant',
        short_name: 'Assistant',
        description: 'Personal AI assistant',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7f8fb',
        theme_color: '#2859d8',
        icons: [
          {
            src: 'app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
