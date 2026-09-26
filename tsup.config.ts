import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.tsx' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
});
