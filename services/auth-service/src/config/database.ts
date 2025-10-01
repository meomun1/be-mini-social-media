import { Pool, PoolConfig } from 'pg';
import { DatabaseConfig } from '@shared/types';

// database connection for auth service

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;

  private constructor() {
    const config: DatabaseConfig = {
      host: process.env.AUTH_DB_HOST || 'localhost',
      port: parseInt(process.env.AUTH_DB_PORT || '5432'),
      database: process.env.AUTH_DB_NAME || 'auth_db',
      username: process.env.AUTH_DB_USER || 'auth_user',
      password: process.env.AUTH_DB_PASSWORD || 'auth_password',
      ssl: process.env.NODE_ENV === 'production',
      pool: {
        min: 2,
        max: 10,
      },
    };

    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
      min: config.pool?.min || 2,
      max: config.pool?.max || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', err => {
      console.error('Unexpected error on idle client', err);
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
