import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Whenever our app asks for '/pco-proxy', Vite will secretly fetch from Planning Center instead
      '/pco-proxy': {
        target: 'https://calendar.planningcenteronline.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/pco-proxy/, '')
      },
      // Route all backend API requests to our new Node/SQLite server proxy
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
