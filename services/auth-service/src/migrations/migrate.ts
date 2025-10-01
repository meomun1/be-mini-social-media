import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { DatabaseConnection } from '../config/database';
import { createLogger } from '../utils/logger';

const logger = createLogger('migrations');

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

class MigrationRunner {
  private db = DatabaseConnection.getInstance().getPool();

  async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations...');

      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();

      // Get list of migration files
      const migrationFiles = this.getMigrationFiles();
      logger.info(`Found ${migrationFiles.length} migration files`);

      // Get already executed migrations
      const executedMigrations = await this.getExecutedMigrations();

      // Run pending migrations
      for (const migration of migrationFiles) {
        if (!executedMigrations.includes(migration.id)) {
          logger.info(`Running migration: ${migration.filename}`);
          await this.runMigration(migration);
          logger.info(`Migration completed: ${migration.filename}`);
        } else {
          logger.info(`Migration already executed: ${migration.filename}`);
        }
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error: (error as Error).message });
      throw error;
    }
  }

  private createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    return this.db.query(sql).then(() => {});
  }

  private getMigrationFiles(): Migration[] {
    const migrationsDir = join(__dirname, '.');
    const files = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && /^\d+_/.test(file))
      .sort();

    return files.map(filename => {
      const id = filename.split('_')[0];
      if (!id) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }
      const filePath = join(migrationsDir, filename);
      const sql = readFileSync(filePath, 'utf8');

      return { id, filename, sql };
    });
  }

  private async getExecutedMigrations(): Promise<string[]> {
    const result = await this.db.query('SELECT id FROM migrations ORDER BY id');
    return result.rows.map(row => row.id);
  }

  private async runMigration(migration: Migration): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Execute the migration SQL
      await client.query(migration.sql);

      // Record the migration as executed
      await client.query('INSERT INTO migrations (id, filename) VALUES ($1, $2)', [
        migration.id,
        migration.filename,
      ]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const runner = new MigrationRunner();
  runner
    .runMigrations()
    .then(() => {
      logger.info('Migration process completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Migration process failed', { error: error.message });
      process.exit(1);
    });
}

export { MigrationRunner };
