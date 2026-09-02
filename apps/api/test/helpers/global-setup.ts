import { execSync } from 'node:child_process';

export default function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://bn:bn_dev_password@localhost:5433/bory_norbert_test?schema=public';
  // eslint-disable-next-line no-console
  console.log(`\n[e2e] migrate deploy -> ${url.replace(/:[^:@/]+@/, ':***@')}`);
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
