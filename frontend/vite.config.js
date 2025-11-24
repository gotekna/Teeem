import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  // Extract backend URL from VITE_API_URL, default to 3000
  const apiUrl = env.VITE_API_URL || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Core vendor chunks
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'chart-vendor': ['recharts'],
            'gantt-vendor': ['dhtmlx-gantt'],
            'pdf-vendor': ['react-pdf', 'pdfjs-dist'],
            'map-vendor': ['leaflet', 'react-leaflet'],
            'flow-vendor': ['reactflow'],
            'ui-vendor': ['@headlessui/react', '@heroicons/react'],
            'form-vendor': ['axios'],
          },
        },
      },
      chunkSizeWarningLimit: 600, // Warn for chunks > 600KB
    },
  }
})
