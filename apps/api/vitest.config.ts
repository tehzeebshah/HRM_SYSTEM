import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Pure-logic tests don't touch the DB; cheap to run.
    pool: 'threads',
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/payroll.engine.ts', 'src/**/leave.engine.ts', 'src/common/csv.ts', 'src/common/crypto.ts'],
    },
  },
});
