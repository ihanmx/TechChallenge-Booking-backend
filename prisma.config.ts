import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // PRISMA_TARGET=test points the CLI (migrate/seed) at the test database.
    url:
      process.env.PRISMA_TARGET === 'test'
        ? env('TEST_DATABASE_URL')
        : env('DATABASE_URL'),
  },
});
