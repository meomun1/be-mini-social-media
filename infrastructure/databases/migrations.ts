import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@shared/types';
import { MigrationInfo } from './types';

const logger = createLogger('database-migrations');

export class MigrationManager {
  private pool: Pool;
  private serviceName: string;

  constructor(pool: Pool, serviceName: string) {
    this.pool = pool;
    this.serviceName = serviceName;
  }

  /**
   * Initialize the migrations table
   */
  async initialize(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(255) NOT NULL
      );
    `;

    await this.pool.query(createTableQuery);
    logger.info(`Migrations table initialized for ${this.serviceName}`);
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationInfo[]> {
    const query = `
      SELECT id, name, applied_at as "appliedAt", checksum
      FROM migrations
      ORDER BY applied_at ASC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Check if a migration has been applied
   */
  async isMigrationApplied(migrationId: string): Promise<boolean> {
    const query = 'SELECT EXISTS(SELECT 1 FROM migrations WHERE id = $1)';
    const result = await this.pool.query(query, [migrationId]);
    return result.rows[0].exists;
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migrationId: string, migrationName: string, sql: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Execute the migration SQL
      await client.query(sql);

      // Record the migration
      const checksum = this.calculateChecksum(sql);
      await client.query('INSERT INTO migrations (id, name, checksum) VALUES ($1, $2, $3)', [
        migrationId,
        migrationName,
        checksum,
      ]);

      await client.query('COMMIT');
      logger.info(`Migration applied: ${migrationName} (${migrationId})`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to apply migration ${migrationName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations from a directory
   */
  async runMigrations(migrationsPath: string): Promise<void> {
    await this.initialize();

    const migrationFiles = this.getMigrationFiles(migrationsPath);
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));

    let appliedCount = 0;

    for (const file of migrationFiles) {
      if (!appliedIds.has(file.id)) {
        const sql = readFileSync(file.path, 'utf8');
        await this.applyMigration(file.id, file.name, sql);
        appliedCount++;
      }
    }

    if (appliedCount > 0) {
      logger.info(`Applied ${appliedCount} migrations for ${this.serviceName}`);
    } else {
      logger.info(`No pending migrations for ${this.serviceName}`);
    }
  }

  /**
   * Rollback the last migration (if supported)
   */
  async rollbackLastMigration(): Promise<void> {
    const query = `
      SELECT id, name 
      FROM migrations 
      ORDER BY applied_at DESC 
      LIMIT 1
    `;

    const result = await this.pool.query(query);

    if (result.rows.length === 0) {
      logger.warn(`No migrations to rollback for ${this.serviceName}`);
      return;
    }

    const migration = result.rows[0];
    logger.warn(`Rollback not implemented for migration: ${migration.name}`);
    // Note: Implementing rollback requires storing the reverse SQL
    // This is a placeholder for future implementation
  }

  /**
   * Get migration files from directory
   */
  private getMigrationFiles(migrationsPath: string): Array<{
    id: string;
    name: string;
    path: string;
  }> {
    try {
      const files = readdirSync(migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      return files.map(file => {
        const parts = file.split('_');
        const id = parts[0];
        if (!id) {
          throw new Error(`Invalid migration file name: ${file}`);
        }
        const name = file.replace('.sql', '');
        return {
          id,
          name,
          path: join(migrationsPath, file),
        };
      });
    } catch (error) {
      logger.error(`Failed to read migration files from ${migrationsPath}:`, error);
      return [];
    }
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate migration files integrity
   */
  async validateMigrations(migrationsPath: string): Promise<boolean> {
    const migrationFiles = this.getMigrationFiles(migrationsPath);
    const appliedMigrations = await this.getAppliedMigrations();

    for (const applied of appliedMigrations) {
      const file = migrationFiles.find(f => f.id === applied.id);
      if (!file) {
        logger.error(`Migration file not found for applied migration: ${applied.name}`);
        return false;
      }

      const sql = readFileSync(file.path, 'utf8');
      const checksum = this.calculateChecksum(sql);

      if (checksum !== applied.checksum) {
        logger.error(`Migration checksum mismatch for: ${applied.name}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get migration status
   */
  async getStatus(migrationsPath: string): Promise<{
    total: number;
    applied: number;
    pending: number;
    lastApplied?: string;
  }> {
    const migrationFiles = this.getMigrationFiles(migrationsPath);
    const appliedMigrations = await this.getAppliedMigrations();

    const lastApplied =
      appliedMigrations.length > 0
        ? appliedMigrations[appliedMigrations.length - 1]?.name
        : undefined;

    return {
      total: migrationFiles.length,
      applied: appliedMigrations.length,
      pending: migrationFiles.length - appliedMigrations.length,
      ...(lastApplied && { lastApplied }),
    };
  }
}

/**
 * Utility function to run migrations for a service
 */
export async function runServiceMigrations(
  pool: Pool,
  serviceName: string,
  migrationsPath: string
): Promise<void> {
  const migrationManager = new MigrationManager(pool, serviceName);
  await migrationManager.runMigrations(migrationsPath);
}

/**
 * Utility function to get migration status for a service
 */
export async function getMigrationStatus(
  pool: Pool,
  serviceName: string,
  migrationsPath: string
): Promise<{
  total: number;
  applied: number;
  pending: number;
  lastApplied?: string;
}> {
  const migrationManager = new MigrationManager(pool, serviceName);
  return await migrationManager.getStatus(migrationsPath);
}
