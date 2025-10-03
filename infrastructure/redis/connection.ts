import Redis from 'ioredis';
import { createLogger } from '@shared/types';

const logger = createLogger('redis-connection');

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
}

export class RedisConnection {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private static instance: RedisConnection;
  private isConnected = false;

  private constructor(config: RedisConfig) {
    const redisOptions: any = {
      host: config.host,
      port: config.port,
      db: config.db,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      lazyConnect: config.lazyConnect,
    };

    if (config.password) {
      redisOptions.password = config.password;
    }

    // Main client for general operations
    this.client = new Redis(redisOptions);

    // Separate subscriber client for pub/sub
    this.subscriber = new Redis(redisOptions);

    // Separate publisher client for pub/sub
    this.publisher = new Redis(redisOptions);

    this.setupEventHandlers();
  }

  public static getInstance(config?: RedisConfig): RedisConnection {
    if (!RedisConnection.instance) {
      if (!config) {
        throw new Error('Redis configuration required for first initialization');
      }
      RedisConnection.instance = new RedisConnection(config);
    }
    return RedisConnection.instance;
  }

  private setupEventHandlers(): void {
    // Main client events
    this.client.on('connect', () => {
      logger.info('Redis main client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis main client ready');
      this.isConnected = true;
    });

    this.client.on('error', (err: Error) => {
      logger.error('Redis main client error:', err);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis main client connection closed');
      this.isConnected = false;
    });

    // Subscriber client events
    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber client connected');
    });

    this.subscriber.on('error', (err: Error) => {
      logger.error('Redis subscriber client error:', err);
    });

    // Publisher client events
    this.publisher.on('connect', () => {
      logger.info('Redis publisher client connected');
    });

    this.publisher.on('error', (err: Error) => {
      logger.error('Redis publisher client error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await Promise.all([
          this.client.connect(),
          this.subscriber.connect(),
          this.publisher.connect(),
        ]);
        logger.info('All Redis connections established');
      }
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  getClient(): Redis {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client;
  }

  getSubscriber(): Redis {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.subscriber;
  }

  getPublisher(): Redis {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.publisher;
  }

  isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([this.client.quit(), this.subscriber.quit(), this.publisher.quit()]);
      this.isConnected = false;
      logger.info('All Redis connections closed');
    } catch (error) {
      logger.error('Error closing Redis connections:', error);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  }
}

// Initialize with default configuration
export const initializeRedis = (): RedisConnection => {
  const config: RedisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  };

  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }

  return RedisConnection.getInstance(config);
};

export const redisConnection = initializeRedis();
