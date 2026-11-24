import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so this also works from inside Docker
    // Lets the frontend talk to the API in server.js (`npm run dev` starts
    // both; `npm run dev:web` is Vite alone, e.g. the docker-compose `web`
    // service talking to the `api` service). Override with
    // API_PROXY_TARGET when the API isn't reachable at localhost:8787 (e.g.
    // running in a separate Docker container, where it's http://api:8787).
    // If nothing is running there, requests to /api/* just fail and the
    // frontend silently falls back to localStorage only — nothing breaks.
    proxy: {
      '/api': process.env.API_PROXY_TARGET || 'http://localhost:8787',
    },
  },
})
