import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  base:'/settings/',
  build:{outDir:'dist',emptyOutDir:true},
  plugins:[vue()],
})
