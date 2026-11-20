import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const sha = (process.env.GITHUB_SHA ?? '').slice(0, 7);

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(sha ? `${pkg.version}+${sha}` : pkg.version),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
