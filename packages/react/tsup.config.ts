import { copyFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react', 'frameable-core'],
  banner: { js: "'use client';" },
  onSuccess: async () => {
    await copyFile('src/transformer.css', 'dist/transformer.css');
  },
});
