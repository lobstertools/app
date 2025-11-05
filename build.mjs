import { build } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

console.log('Starting esbuild for backend and electron...');

// This is the shared config for all our Node.js code
const sharedConfig = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    minify: true,
    // This plugin automatically marks all 'node_modules' as external
    plugins: [nodeExternalsPlugin()],
};

try {
    // We run all 3 builds in parallel
    await Promise.all([
        // 1. Backend Build
        build({
            ...sharedConfig,
            entryPoints: ['src/backend/main.ts'],
            outfile: 'dist/backend/index.cjs',
            format: 'cjs',
        }),

        // 2. Electron Main Build
        build({
            ...sharedConfig,
            entryPoints: ['src/electron/main.ts'],
            outfile: 'dist/electron/main.js',
            format: 'esm', // Keep this from your original script
            external: ['electron'], // We still need to manually exclude 'electron'
        }),

        // 3. Electron Preload Build
        build({
            ...sharedConfig,
            entryPoints: ['src/electron/preload.cts'],
            outfile: 'dist/electron/preload.cjs',
            format: 'cjs',
        }),
    ]);
    console.log('esbuild complete.');
} catch (error) {
    console.error('esbuild failed:', error);
    process.exit(1);
}
