import { Pool, QueryResult } from 'pg';
import { createLogger } from '@shared/types';

const logger = createLogger('user');

export class DatabaseConnection {
  private pool: Pool;
  private static instance: DatabaseConnection;

  private constructor() {
    this.pool = new Pool({
      host: process.env.USER_DB_HOST || 'localhost',
      port: parseInt(process.env.USER_DB_PORT || '5433'),
      database: process.env.USER_DB_NAME || 'users_db',
      user: process.env.USER_DB_USER || 'users_user',
      password: process.env.USER_DB_PASSWORD || 'users_password',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
      connectionTimeoutMillis: 2000, // How long the pool will wait for a connection to be established
    });

    // Handle pool errors
    this.pool.on('error', err => {
      console.error('Unexpected error on idle client', err);
    });

    logger.info('PostgreSQL pool initialized');
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
      logger.info('PostgreSQL connected successfully');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL', { error: (error as Error).message });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('PostgreSQL disconnected');
    } catch (error) {
      logger.error('Error during PostgreSQL disconnection', { error: (error as Error).message });
      throw error;
    }
  }

  public async query(text: string, params?: any[]): Promise<QueryResult> {
    return this.pool.query(text, params);
  }
}
