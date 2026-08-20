import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Use a project-local cache directory to avoid writing to system temp paths
  cacheDir: resolve(__dirname, '.vite'),
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^es-toolkit\/compat\/(.*)$/,
        replacement: resolve(__dirname, 'src/es-toolkit/compat/$1.js')
      }
    ]
  },
  server: {
    proxy: {
      '/avatars': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
