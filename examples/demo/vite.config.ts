import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const src = (path: string) => decodeURIComponent(new URL(path, import.meta.url).pathname);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@frameable/core': src('../../packages/core/src/index.ts'),
      '@frameable/react': src('../../packages/react/src/index.ts'),
    },
  },
});
