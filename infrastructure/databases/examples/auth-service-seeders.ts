#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { runServiceSeeders } from '../seeders';
import { createLogger } from '@shared/types';

const logger = createLogger('auth-seeders');

/**
 * Example script for running Auth Service seeders
 * This shows how to use the seeder utilities in a real service
 */
async function runAuthSeeders() {
  const pool = new Pool({
    host: process.env.AUTH_DB_HOST || 'localhost',
    port: parseInt(process.env.AUTH_DB_PORT || '5432'),
    database: process.env.AUTH_DB_NAME || 'auth_db',
    user: process.env.AUTH_DB_USER || 'auth_user',
    password: process.env.AUTH_DB_PASSWORD || 'auth_password',
    ssl: process.env.NODE_ENV === 'production',
  });

  try {
    await runServiceSeeders(pool, 'auth-service', './src/seeders');
    logger.info('Auth service seeders completed successfully');
  } catch (error) {
    logger.error('Failed to run auth service seeders:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seeders if this file is executed directly
if (require.main === module) {
  runAuthSeeders();
}
