import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Stamp the build with a version string Beacon can poll for cache-bust
// detection. The version is the build timestamp — unique per deploy and
// monotonically increasing — so a counselor running an older build sees
// /version.json return a newer string and gets the "Refresh" toast.
const BUILD_VERSION = new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'beacon-version-stamp',
      apply: 'build',
      writeBundle(options) {
        const outDir = options.dir || 'dist';
        writeFileSync(
          resolve(outDir, 'version.json'),
          JSON.stringify({ version: BUILD_VERSION, builtAt: BUILD_VERSION }, null, 2)
        );
      },
    },
  ],
  define: {
    __BEACON_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  optimizeDeps: {
    include: ['react-is'],
  },
});
