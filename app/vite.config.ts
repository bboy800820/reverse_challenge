import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages hosts this project below the repository name.
  base: '/reverse_challenge/',
  build: { rollupOptions: { input: { main: 'index.html', controller: 'controller.html' } } },
});
