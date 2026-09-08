import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';

import { createLocalRunArchivePlugin } from './server/localRunArchive.ts';

export default defineConfig({
    build: {
        assetsInlineLimit: 0,
    },
    plugins: [createLocalRunArchivePlugin(), createHtmlPlugin()],
    publicDir: 'public',
    base: './',
    assetsInclude: ['**/*.xml'],
});
