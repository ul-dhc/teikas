import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://dhc.lu.lv',
  base: '/teikas',
  output: 'static',
  outDir: './build',
  trailingSlash: 'always',
});
