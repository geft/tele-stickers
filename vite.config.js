import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tele-stickers/',
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/__tests__/**', 'src/counter.js'],
    },
  },
});
