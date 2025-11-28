import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx,vue}'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  },
})
