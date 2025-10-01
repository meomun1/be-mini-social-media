import bcrypt from 'bcryptjs';
import { DatabaseConnection } from '../config/database';
import { createLogger } from '../utils/logger';
import { bcryptConfig } from '../config/app';

const logger = createLogger('seeders');

interface SeedUser {
  email: string;
  username: string;
  password: string;
}

class DatabaseSeeder {
  private db = DatabaseConnection.getInstance().getPool();

  async seed(): Promise<void> {
    try {
      // Safety check: Only run in development
      if (process.env.NODE_ENV === 'production') {
        logger.warn('Seeding is disabled in production environment');
        return;
      }

      logger.info('Starting database seeding...');

      // Check if we already have users
      const existingUsers = await this.db.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(existingUsers.rows[0].count);

      if (userCount > 0) {
        logger.info(`Database already has ${userCount} users. Skipping seeding.`);
        return;
      }

      // Define seed users
      const seedUsers: SeedUser[] = [
        {
          email: 'admin@example.com',
          username: 'admin',
          password: 'Admin123!@#',
        },
        {
          email: 'demo@example.com',
          username: 'demo',
          password: 'Demo123!@#',
        },
        {
          email: 'test@example.com',
          username: 'testuser',
          password: 'Test123!@#',
        },
      ];

      // Create seed users
      for (const userData of seedUsers) {
        await this.createSeedUser(userData);
      }

      logger.info(`Successfully seeded ${seedUsers.length} users`);
    } catch (error) {
      logger.error('Seeding failed', { error: (error as Error).message });
      throw error;
    }
  }

  private async createSeedUser(userData: SeedUser): Promise<void> {
    try {
      // Hash password using same config as service
      const passwordHash = await bcrypt.hash(userData.password, bcryptConfig.rounds);

      // Insert user
      const result = await this.db.query(
        `INSERT INTO users (email, username, password_hash, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, email, username`,
        [userData.email, userData.username, passwordHash, true]
      );

      const user = result.rows[0];
      logger.info(`Created seed user: ${user.username} (${user.email})`);
    } catch (error) {
      if ((error as any).code === '23505') {
        // Unique violation
        logger.warn(`User ${userData.username} already exists, skipping`);
      } else {
        throw error;
      }
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Safety check: Only run in development
      if (process.env.NODE_ENV === 'production') {
        logger.warn('Cleanup is disabled in production environment');
        return;
      }

      logger.info('Starting database cleanup...');

      // Delete seed users (only in development!)
      const seedEmails = ['admin@example.com', 'demo@example.com', 'test@example.com'];

      for (const email of seedEmails) {
        const result = await this.db.query('DELETE FROM users WHERE email = $1', [email]);

        if (result.rowCount && result.rowCount > 0) {
          logger.info(`Deleted seed user: ${email}`);
        }
      }

      logger.info('Database cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed', { error: (error as Error).message });
      throw error;
    }
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  const seeder = new DatabaseSeeder();

  const command = process.argv[2];

  if (command === 'cleanup') {
    seeder
      .cleanup()
      .then(() => {
        logger.info('Cleanup process completed');
        process.exit(0);
      })
      .catch(error => {
        logger.error('Cleanup process failed', { error: error.message });
        process.exit(1);
      });
  } else {
    seeder
      .seed()
      .then(() => {
        logger.info('Seeding process completed');
        process.exit(0);
      })
      .catch(error => {
        logger.error('Seeding process failed', { error: error.message });
        process.exit(1);
      });
  }
}

export { DatabaseSeeder };
