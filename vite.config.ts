import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Nécessaire pour accéder au serveur depuis l'hôte quand Vite tourne dans Docker.
    host: '0.0.0.0',
    port: 5173,
    watch: {
      // Les bind mounts Docker (notamment sur macOS) ne propagent pas toujours
      // les événements inotify natifs : le polling garantit le hot reload.
      usePolling: true,
    },
  },
})
