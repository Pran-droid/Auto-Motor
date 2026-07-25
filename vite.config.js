import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure only one copy of React is used — prevents @dnd-kit/core "Invalid hook call" errors
    dedupe: ['react', 'react-dom'],
  },
})
