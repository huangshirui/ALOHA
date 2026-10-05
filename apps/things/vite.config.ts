import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/things/',
  build: {
    outDir: 'dist/things',
    emptyOutDir: true,
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ALOHA Things',
        short_name: 'Things',
        description: 'ALOHA personal things and spaces workspace',
        id: '/things/',
        start_url: '/things/',
        scope: '/things/',
        display: 'standalone',
        background_color: '#f7f8fb',
        theme_color: '#6353d9',
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
})
