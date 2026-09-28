import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // src/lambda.ts initializes Sentry at module scope from this variable. lambda.test.ts
    // imports it unmocked, so a DSN exported in a developer's shell would spin up a live
    // client inside the test worker and ship local test crashes to the real project.
    // Pinning it empty here keeps that impossible; lambda.sentry.test.ts sets it per test.
    env: { SENTRY_DSN: '' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'build/',
        '*.config.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});