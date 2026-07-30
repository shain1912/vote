import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // NOTE: This must match the actual GitHub repository name once one exists,
  // e.g. if the repo is github.com/<org>/<repo>, base must be `/<repo>/`.
  // "/vote/" is a placeholder — update it before the first deploy if the
  // repo name ends up different.
  base: '/vote/',
})
