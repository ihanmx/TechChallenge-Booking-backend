import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// The e2e tests run against a REAL PostgreSQL database: TEST_DATABASE_URL (never the dev DB).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
}
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL: tests wipe their database');
}

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'], // applies migrations to the test DB once
    env: { DATABASE_URL: testDatabaseUrl }, // the app under test connects to the test DB
    fileParallelism: false, // test files share one database
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
