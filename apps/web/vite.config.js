import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // strictPort: si el 3000 está ocupado, falla en vez de saltar al 3001 de la API.
  server: { port: 3000, strictPort: true },
  resolve: {
    // Con ES modules no existe __dirname: la ruta se calcula desde este archivo.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
