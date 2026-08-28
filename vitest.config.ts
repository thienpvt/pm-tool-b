import { defineConfig } from 'vitest/config';
import path from 'node:path';

const alias = { '@': path.resolve(__dirname, '.') };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['{lib,app,eslint}/**/*.test.ts'],
          exclude: ['lib/log.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: [
            '{components,app}/**/*.test.tsx',
            '{components,app}/**/*.component.test.tsx',
          ],
          setupFiles: ['./test/setup-jsdom.ts'],
        },
      },
    ],
  },
});
