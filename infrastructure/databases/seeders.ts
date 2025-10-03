import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@shared/types';
import { SeederInfo } from './types';

const logger = createLogger('database-seeders');

export class SeederManager {
  private pool: Pool;
  private serviceName: string;

  constructor(pool: Pool, serviceName: string) {
    this.pool = pool;
    this.serviceName = serviceName;
  }

  /**
   * Initialize the seeders table
   */
  async initialize(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS seeders (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        data_count INTEGER DEFAULT 0
      );
    `;

    await this.pool.query(createTableQuery);
    logger.info(`Seeders table initialized for ${this.serviceName}`);
  }

  /**
   * Get list of executed seeders
   */
  async getExecutedSeeders(): Promise<SeederInfo[]> {
    const query = `
      SELECT id, name, executed_at as "executedAt", data_count as "dataCount"
      FROM seeders
      ORDER BY executed_at ASC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Check if a seeder has been executed
   */
  async isSeederExecuted(seederId: string): Promise<boolean> {
    const query = 'SELECT EXISTS(SELECT 1 FROM seeders WHERE id = $1)';
    const result = await this.pool.query(query, [seederId]);
    return result.rows[0].exists;
  }

  /**
   * Execute a single seeder
   */
  async executeSeeder(
    seederId: string,
    seederName: string,
    seederFunction: () => Promise<number>
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Execute the seeder function
      const dataCount = await seederFunction();

      // Record the seeder execution
      await client.query('INSERT INTO seeders (id, name, data_count) VALUES ($1, $2, $3)', [
        seederId,
        seederName,
        dataCount,
      ]);

      await client.query('COMMIT');
      logger.info(`Seeder executed: ${seederName} (${dataCount} records created)`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to execute seeder ${seederName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending seeders from a directory
   */
  async runSeeders(seedersPath: string): Promise<void> {
    await this.initialize();

    const seederFiles = this.getSeederFiles(seedersPath);
    const executedSeeders = await this.getExecutedSeeders();
    const executedIds = new Set(executedSeeders.map(s => s.id));

    let executedCount = 0;

    for (const file of seederFiles) {
      if (!executedIds.has(file.id)) {
        const seederFunction = require(file.path).default;
        if (typeof seederFunction === 'function') {
          await this.executeSeeder(file.id, file.name, seederFunction);
          executedCount++;
        } else {
          logger.warn(`Seeder ${file.name} does not export a default function`);
        }
      }
    }

    if (executedCount > 0) {
      logger.info(`Executed ${executedCount} seeders for ${this.serviceName}`);
    } else {
      logger.info(`No pending seeders for ${this.serviceName}`);
    }
  }

  /**
   * Run a specific seeder by name
   */
  async runSeeder(seedersPath: string, seederName: string): Promise<void> {
    await this.initialize();

    const seederFiles = this.getSeederFiles(seedersPath);
    const seeder = seederFiles.find(s => s.name === seederName);

    if (!seeder) {
      throw new Error(`Seeder not found: ${seederName}`);
    }

    if (await this.isSeederExecuted(seeder.id)) {
      logger.warn(`Seeder ${seederName} has already been executed`);
      return;
    }

    const seederFunction = require(seeder.path).default;
    if (typeof seederFunction !== 'function') {
      throw new Error(`Seeder ${seederName} does not export a default function`);
    }

    await this.executeSeeder(seeder.id, seeder.name, seederFunction);
  }

  /**
   * Cleanup all seeded data (for testing/development)
   */
  async cleanup(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // This is a generic cleanup - each service should implement its own cleanup logic
      const tables = await this.getTables();

      for (const table of tables) {
        if (table !== 'seeders' && table !== 'migrations') {
          await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        }
      }

      // Clear seeder records
      await client.query('DELETE FROM seeders');

      await client.query('COMMIT');
      logger.info(`Cleanup completed for ${this.serviceName}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to cleanup ${this.serviceName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get seeder files from directory
   */
  private getSeederFiles(seedersPath: string): Array<{
    id: string;
    name: string;
    path: string;
  }> {
    try {
      const files = readdirSync(seedersPath)
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .sort();

      return files.map(file => {
        const id = file.replace(/\.(ts|js)$/, '');
        const name = id;
        return {
          id,
          name,
          path: join(seedersPath, file),
        };
      });
    } catch (error) {
      logger.error(`Failed to read seeder files from ${seedersPath}:`, error);
      return [];
    }
  }

  /**
   * Get all table names in the database
   */
  private async getTables(): Promise<string[]> {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => row.table_name);
  }

  /**
   * Get seeder status
   */
  async getStatus(seedersPath: string): Promise<{
    total: number;
    executed: number;
    pending: number;
    lastExecuted?: string;
  }> {
    const seederFiles = this.getSeederFiles(seedersPath);
    const executedSeeders = await this.getExecutedSeeders();

    const lastExecuted =
      executedSeeders.length > 0 ? executedSeeders[executedSeeders.length - 1]?.name : undefined;

    return {
      total: seederFiles.length,
      executed: executedSeeders.length,
      pending: seederFiles.length - executedSeeders.length,
      ...(lastExecuted && { lastExecuted }),
    };
  }
}

/**
 * Utility function to run seeders for a service
 */
export async function runServiceSeeders(
  pool: Pool,
  serviceName: string,
  seedersPath: string
): Promise<void> {
  const seederManager = new SeederManager(pool, serviceName);
  await seederManager.runSeeders(seedersPath);
}

/**
 * Utility function to cleanup seeded data for a service
 */
export async function cleanupServiceData(pool: Pool, serviceName: string): Promise<void> {
  const seederManager = new SeederManager(pool, serviceName);
  await seederManager.cleanup();
}

/**
 * Utility function to get seeder status for a service
 */
export async function getSeederStatus(
  pool: Pool,
  serviceName: string,
  seedersPath: string
): Promise<{
  total: number;
  executed: number;
  pending: number;
  lastExecuted?: string;
}> {
  const seederManager = new SeederManager(pool, serviceName);
  return await seederManager.getStatus(seedersPath);
}
