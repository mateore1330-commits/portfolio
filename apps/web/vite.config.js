import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Con ES modules no existe __dirname: la ruta se calcula desde este archivo.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
