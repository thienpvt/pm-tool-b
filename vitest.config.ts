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
          include: ['{lib,app,eslint,modules}/**/*.test.ts'],
          exclude: ['lib/log.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: [
            '{components,app,modules}/**/*.test.tsx',
            '{components,app,modules}/**/*.component.test.tsx',
          ],
          setupFiles: ['./test/setup-jsdom.ts'],
        },
      },
    ],
  },
});
