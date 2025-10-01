// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.AUTH_DB_HOST = 'localhost';
process.env.AUTH_DB_PORT = '5432';
process.env.AUTH_DB_NAME = 'auth_db_test';
process.env.AUTH_DB_USER = 'auth_user';
process.env.AUTH_DB_PASSWORD = 'auth_password';
process.env.AUTH_SERVICE_PORT = '3002';
process.env.BCRYPT_ROUNDS = '4'; // Faster for tests
process.env.RATE_LIMIT_MAX_REQUESTS = '1000'; // Relaxed for tests
