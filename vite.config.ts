import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mediaImportPlugin } from './server/mediaImportPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mediaImportPlugin()],
})
