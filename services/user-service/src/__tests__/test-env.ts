// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.USER_SERVICE_PORT = '3003';
process.env.USER_SERVICE_HOST = 'localhost';
process.env.USER_DB_HOST = 'localhost';
process.env.USER_DB_PORT = '5433';
process.env.USER_DB_NAME = 'user_db_test';
process.env.USER_DB_USER = 'user_user';
process.env.USER_DB_PASSWORD = 'user_password';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_DB = '1'; // Use different DB for tests
process.env.RATE_LIMIT_MAX_REQUESTS = '1000'; // Relaxed for tests
