import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unitaires/**/*.test.js', 'tests/api/**/*.test.js'],
    testTimeout: 20_000,
  },
});
