/* Loaded before every e2e test file (jest `setupFiles`). Fills in the env the
 * API config schema expects, pointing at the docker-compose.test.yml infra. */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://bn:bn_dev_password@localhost:5433/bory_norbert_test?schema=public';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6380';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-abcdefghijklmnop';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-abcdefghijklmnop';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.CRYPTO_PROVIDER = 'mock';
process.env.MOCK_PROVIDERS_ENABLED = 'true';
process.env.PAYMENT_WINDOW_SECONDS = '900';
process.env.QUOTE_SWEEP_INTERVAL_SECONDS = '3600';
process.env.CRYPTO_REQUIRED_CONFIRMATIONS = '3';
process.env.CORS_ORIGIN = 'http://localhost:3000';
