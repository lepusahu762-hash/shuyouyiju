import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Optional local QA backend; never contains credentials or enters browser code.
const proxy = { '/api': { target: process.env.SYJ_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: false } }
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
