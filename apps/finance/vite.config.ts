import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/finance/',
  build: {
    outDir: 'dist/finance',
    emptyOutDir: true,
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ALOHA Finance',
        short_name: 'Finance',
        description: 'ALOHA personal finance workspace',
        id: '/finance/',
        start_url: '/finance/',
        scope: '/finance/',
        display: 'standalone',
        background_color: '#f7f8fb',
        theme_color: '#b86b00',
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
