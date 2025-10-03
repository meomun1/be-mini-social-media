#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { runServiceMigrations } from '../migrations';
import { createLogger } from '@shared/types';

const logger = createLogger('auth-migrations');

/**
 * Example script for running Auth Service migrations
 * This shows how to use the migration utilities in a real service
 */
async function runAuthMigrations() {
  const pool = new Pool({
    host: process.env.AUTH_DB_HOST || 'localhost',
    port: parseInt(process.env.AUTH_DB_PORT || '5432'),
    database: process.env.AUTH_DB_NAME || 'auth_db',
    user: process.env.AUTH_DB_USER || 'auth_user',
    password: process.env.AUTH_DB_PASSWORD || 'auth_password',
    ssl: process.env.NODE_ENV === 'production',
  });

  try {
    await runServiceMigrations(pool, 'auth-service', './src/migrations');
    logger.info('Auth service migrations completed successfully');
  } catch (error) {
    logger.error('Failed to run auth service migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runAuthMigrations();
}
