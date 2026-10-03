import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ALOHA Assistant',
        short_name: 'Assistant',
        description: 'Personal AI assistant',
        display: 'standalone',
        // Transitional production scope. Move to /assistant/ when the
        // independent Assistant PWA deployment is activated.
        id: '/',
        start_url: '/',
        scope: '/',
        background_color: '#ffffff',
        theme_color: '#ffffff',
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
