import { defineConfig } from 'vite';

export default defineConfig({
  // Keep asset URLs relative so the same production bundle works on Railway,
  // local static hosts, GitHub artifact branches, and CDN mirrors.
  base: './',
});
