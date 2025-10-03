import { RedisConnection } from './connection';
import { CacheKeys } from './cacheKeys';
import { createLogger } from '@shared/types';

const logger = createLogger('redis-cache');

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  nx?: boolean; // Only set if key doesn't exist
  xx?: boolean; // Only set if key exists
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * Base cache service that all microservices should extend
 * Provides common caching operations with proper error handling and monitoring
 */
export abstract class BaseCacheService {
  protected redis: RedisConnection;
  protected serviceName: string;
  protected stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.redis = RedisConnection.getInstance();
  }

  // Basic cache operations
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = this.redis.getClient();
      const value = await client.get(key);

      if (value === null) {
        this.stats.misses++;
        logger.debug(`Cache miss for key: ${key}`, { service: this.serviceName });
        return null;
      }

      this.stats.hits++;
      logger.debug(`Cache hit for key: ${key}`, { service: this.serviceName });
      return JSON.parse(value) as T;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache get error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const serialized = JSON.stringify(value);

      let result: string | number | null;
      if (options.ttl) {
        result = await client.setex(key, options.ttl, serialized);
      } else if (options.nx) {
        result = await client.setnx(key, serialized);
        // setnx returns 1 if key was set, 0 if key already existed
        const success = result === 1;
        if (success) {
          this.stats.sets++;
          logger.debug(`Cache set successful for key: ${key}`, { service: this.serviceName });
        }
        return success;
      } else if (options.xx) {
        result = await client.set(key, serialized, 'XX');
      } else {
        result = await client.set(key, serialized);
      }

      const success = result === 'OK';
      if (success) {
        this.stats.sets++;
        logger.debug(`Cache set successful for key: ${key}`, { service: this.serviceName });
      }
      return success;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache set error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const result = await client.del(key);
      const success = result > 0;

      if (success) {
        this.stats.deletes++;
        logger.debug(`Cache delete successful for key: ${key}`, { service: this.serviceName });
      }
      return success;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache delete error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache exists error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Batch operations
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const client = this.redis.getClient();
      const values = await client.mget(...keys);

      return values.map(value => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        this.stats.hits++;
        return JSON.parse(value) as T;
      });
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache mget error`, {
        service: this.serviceName,
        keys: keys.length,
        error: (error as Error).message,
      });
      return keys.map(() => null);
    }
  }

  async mset<T>(keyValuePairs: Record<string, T>, ttl?: number): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const serializedPairs: Record<string, string> = {};

      Object.entries(keyValuePairs).forEach(([key, value]) => {
        serializedPairs[key] = JSON.stringify(value);
      });

      const result = await client.mset(serializedPairs);

      if (ttl && result === 'OK') {
        const pipeline = client.pipeline();
        Object.keys(keyValuePairs).forEach(key => {
          pipeline.expire(key, ttl);
        });
        await pipeline.exec();
      }

      if (result === 'OK') {
        this.stats.sets += Object.keys(keyValuePairs).length;
        logger.debug(`Cache mset successful`, {
          service: this.serviceName,
          count: Object.keys(keyValuePairs).length,
        });
      }
      return result === 'OK';
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache mset error`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // TTL operations
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const result = await client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache expire error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const client = this.redis.getClient();
      return await client.ttl(key);
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache ttl error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return -1;
    }
  }

  // Pattern operations
  async keys(pattern: string): Promise<string[]> {
    try {
      const client = this.redis.getClient();
      return await client.keys(pattern);
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache keys error for pattern: ${pattern}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return [];
    }
  }

  async delPattern(pattern: string): Promise<number> {
    try {
      const client = this.redis.getClient();
      const keys = await this.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await client.del(...keys);
      this.stats.deletes += result;
      logger.debug(`Cache delete pattern successful`, {
        service: this.serviceName,
        pattern,
        deleted: result,
      });
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache delete pattern error for pattern: ${pattern}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  // Atomic operations
  async increment(key: string, value: number = 1): Promise<number> {
    try {
      const client = this.redis.getClient();
      return await client.incrby(key, value);
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache increment error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    try {
      const client = this.redis.getClient();
      return await client.decrby(key, value);
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache decrement error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  // List operations
  async lpush(key: string, ...values: unknown[]): Promise<number> {
    try {
      const client = this.redis.getClient();
      const serializedValues = values.map((value: unknown) => JSON.stringify(value));
      return await client.lpush(key, ...serializedValues);
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache lpush error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  async rpop<T>(key: string): Promise<T | null> {
    try {
      const client = this.redis.getClient();
      const value = await client.rpop(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache rpop error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return null;
    }
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    try {
      const client = this.redis.getClient();
      const values = await client.lrange(key, start, stop);
      return values.map(value => JSON.parse(value) as T);
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache lrange error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return [];
    }
  }

  // Hash operations
  async hset(key: string, field: string, value: unknown): Promise<number> {
    try {
      const client = this.redis.getClient();
      return await client.hset(key, field, JSON.stringify(value));
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache hset error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const client = this.redis.getClient();
      const value = await client.hget(key, field);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache hget error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return null;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    try {
      const client = this.redis.getClient();
      const hash = await client.hgetall(key);
      const result: Record<string, T> = {};

      Object.entries(hash).forEach(([field, value]) => {
        result[field] = JSON.parse(value as string) as T;
      });

      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache hgetall error for key: ${key}`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return {};
    }
  }

  // Utility methods
  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  getServiceName(): string {
    return this.serviceName;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      return await this.redis.ping();
    } catch (error) {
      logger.error(`Cache health check failed`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Abstract methods that each service should implement
  abstract invalidateUserCache(userId: string): Promise<void>;
  abstract getCacheKeyPrefix(): string;
}
