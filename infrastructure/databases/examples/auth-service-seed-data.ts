import { PoolClient } from 'pg';
import { createLogger } from '@shared/types';
import bcrypt from 'bcrypt';

const logger = createLogger('auth-seeder');

/**
 * Example seeder function for Auth Service
 * This shows how to create seed data for development and testing
 */
export default async function seed(pool: PoolClient): Promise<number> {
  try {
    // Create test users for development
    const testUsers = [
      {
        email: 'admin@example.com',
        username: 'admin',
        password_hash: await bcrypt.hash('admin123', 10),
        is_active: true,
      },
      {
        email: 'user@example.com',
        username: 'user',
        password_hash: await bcrypt.hash('user123', 10),
        is_active: true,
      },
      {
        email: 'test@example.com',
        username: 'testuser',
        password_hash: await bcrypt.hash('test123', 10),
        is_active: true,
      },
    ];

    let createdCount = 0;

    for (const user of testUsers) {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [user.email, user.username]
      );

      if (existingUser.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (id, email, username, password_hash, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())`,
          [user.email, user.username, user.password_hash, user.is_active]
        );
        createdCount++;
        logger.info(`Created test user: ${user.username}`);
      } else {
        logger.info(`User already exists: ${user.username}`);
      }
    }

    logger.info(`Seeded ${createdCount} test users`);
    return createdCount;
  } catch (error) {
    logger.error('Failed to seed auth data:', error);
    throw error;
  }
}
