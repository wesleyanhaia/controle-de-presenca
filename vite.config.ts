import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Encaminha as chamadas de /api para o backend (pasta /backend).
const proxy = {
  '/api': process.env.VITE_BACKEND_URL ?? 'http://localhost:3333',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
