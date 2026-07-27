import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Forwards every real backend route prefix to the local Fastify API so the frontend and backend
// are reachable through one origin — lets a single tunnel (or just local dev) avoid CORS and
// cross-site cookie config entirely. Only affects `vite dev`/`vite preview`; has zero effect on
// `vite build`'s static output, so it's safe to leave in place after the app has a real backend
// host with its own absolute VITE_API_URL.
const apiProxy = {
  '/auth': 'http://localhost:4000',
  '/events': 'http://localhost:4000',
  '/workshops': 'http://localhost:4000',
  '/trainers': 'http://localhost:4000',
  '/participants': 'http://localhost:4000',
  '/feedback': 'http://localhost:4000',
  '/view': 'http://localhost:4000',
  '/files': 'http://localhost:4000',
  '/admin': 'http://localhost:4000',
  '/export': 'http://localhost:4000',
}

// Vite validates the Host header by default (DNS-rebinding protection) — a tunnel forwards the
// request with its own public hostname, which Vite otherwise rejects with a 403. Only relevant
// when deliberately exposing the dev/preview server (e.g. via a temporary tunnel); harmless
// once a real static host serves the build instead.
const allowedHosts = ['.trycloudflare.com']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: apiProxy, allowedHosts },
  preview: { proxy: apiProxy, allowedHosts },
})
