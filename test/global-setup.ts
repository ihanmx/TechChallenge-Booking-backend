import { execSync } from 'node:child_process';

// Runs once before all tests: bring the test database schema up to date.
// PRISMA_TARGET=test makes prisma.config.ts use TEST_DATABASE_URL.
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, PRISMA_TARGET: 'test' },
  });
}
