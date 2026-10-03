import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/health/',
  build: {
    outDir: 'dist/health',
    emptyOutDir: true,
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ALOHA Health',
        short_name: 'Health',
        description: 'ALOHA personal health workspace',
        id: '/health/',
        start_url: '/health/',
        scope: '/health/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
      },
    }),
  ],
})
