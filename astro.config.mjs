import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ul-dhc.github.io',
  base: '/teikas',
  output: 'static',
  outDir: './build',
  trailingSlash: 'always',
});
