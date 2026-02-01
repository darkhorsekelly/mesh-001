// ===============================================
// VITEST CONFIGURATION
// ===============================================
// test configuration for the MESH 95 engine test suite.

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // run tests in the engine directory
        include: ['src/engine/**/*.test.ts'],

        // exclude node_modules and dist
        exclude: ['node_modules', 'dist'],

        // enable globals for describe, it, expect without imports
        globals: true,

        // no DOM environment needed for engine tests
        environment: 'node',

        // verbose output for CI/CD clarity
        reporters: ['verbose'],

        // coverage configuration (optional, run with --coverage)
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/engine/**/*.ts'],
            exclude: [
                'src/engine/**/*.test.ts',
                'src/engine/test/**',
                'src/engine/scripts/**',
            ],
        },
    },
});
