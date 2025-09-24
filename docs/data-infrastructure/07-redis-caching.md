# Redis Caching Strategy

## 🔴 Overview

Redis serves as our primary caching layer, session store, and pub/sub messaging system for real-time features in our mini Facebook backend.

## 🏗️ Redis Architecture

### Connection Management
```typescript
// infrastructure/redis/connection.ts
import { createClient, RedisClientType } from 'redis';
import { logger } from '@/shared/utils/logger';

class RedisConnection {
  private client: RedisClientType;
  private subscriber: RedisClientType;
  private publisher: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
      }
    });

    this.subscriber = createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
      }
    });

    this.publisher = createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => logger.error('Redis Client Error:', err));
    this.client.on('connect', () => logger.info('Redis connected'));
    this.client.on('disconnect', () => logger.warn('Redis disconnected'));

    this.subscriber.on('error', (err) => logger.error('Redis Subscriber Error:', err));
    this.publisher.on('error', (err) => logger.error('Redis Publisher Error:', err));
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);
      
      this.isConnected = true;
      logger.info('All Redis connections established');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  getClient(): RedisClientType {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client;
  }

  getSubscriber(): RedisClientType {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.subscriber;
  }

  getPublisher(): RedisClientType {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.publisher;
  }

  async close(): Promise<void> {
    await Promise.all([
      this.client.quit(),
      this.subscriber.quit(),
      this.publisher.quit()
    ]);
    this.isConnected = false;
    logger.info('Redis connections closed');
  }
}

export const redisConnection = new RedisConnection();
export const connectRedis = () => redisConnection.connect();
```

## 🗂️ Cache Key Strategy

### Key Naming Convention
```typescript
// shared/utils/cacheKeys.ts
export class CacheKeys {
  // User related keys
  static user(id: string): string {
    return `user:${id}`;
  }

  static userFriends(id: string): string {
    return `user:${id}:friends`;
  }

  static userProfile(id: string): string {
    return `user:${id}:profile`;
  }

  static userSettings(id: string): string {
    return `user:${id}:settings`;
  }

  // Post related keys
  static post(id: string): string {
    return `post:${id}`;
  }

  static postComments(id: string): string {
    return `post:${id}:comments`;
  }

  static postReactions(id: string): string {
    return `post:${id}:reactions`;
  }

  static userFeed(userId: string, page: number): string {
    return `feed:${userId}:page:${page}`;
  }

  // Session keys
  static session(id: string): string {
    return `session:${id}`;
  }

  static userSession(userId: string): string {
    return `user:${userId}:session`;
  }

  // Message keys
  static conversation(id: string): string {
    return `conversation:${id}`;
  }

  static conversationMessages(id: string, page: number): string {
    return `conversation:${id}:messages:page:${page}`;
  }

  // Notification keys
  static userNotifications(userId: string): string {
    return `notifications:${userId}`;
  }

  static unreadCount(userId: string): string {
    return `notifications:${userId}:unread`;
  }

  // Search keys
  static searchSuggestions(query: string): string {
    return `search:suggestions:${Buffer.from(query).toString('base64')}`;
  }

  static trendingPosts(): string {
    return 'trending:posts';
  }

  // Rate limiting keys
  static rateLimit(type: string, identifier: string): string {
    return `rate_limit:${type}:${identifier}`;
  }

  // Lock keys for distributed operations
  static lock(resource: string): string {
    return `lock:${resource}`;
  }
}
```

## 🔧 Cache Service Implementation

### Base Cache Service
```typescript
// infrastructure/redis/cacheService.ts
import { redisConnection } from './connection';
import { logger } from '@/shared/utils/logger';

export class CacheService {
  private client = redisConnection.getClient();

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  async set<T>(
    key: string, 
    value: T, 
    ttlSeconds?: number
  ): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mGet(keys);
      return values.map(value => 
        value ? JSON.parse(value) as T : null
      );
    } catch (error) {
      logger.error('Cache mget error:', { keys, error });
      return keys.map(() => null);
    }
  }

  async mset<T>(keyValuePairs: Record<string, T>, ttlSeconds?: number): Promise<boolean> {
    try {
      const serializedPairs: Record<string, string> = {};
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        serializedPairs[key] = JSON.stringify(value);
      });

      await this.client.mSet(serializedPairs);
      
      if (ttlSeconds) {
        const pipeline = this.client.multi();
        Object.keys(keyValuePairs).forEach(key => {
          pipeline.expire(key, ttlSeconds);
        });
        await pipeline.exec();
      }
      
      return true;
    } catch (error) {
      logger.error('Cache mset error:', { error });
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result;
    } catch (error) {
      logger.error('Cache expire error:', { key, error });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Cache ttl error:', { key, error });
      return -1;
    }
  }

  async flushPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      return await this.client.del(keys);
    } catch (error) {
      logger.error('Cache flush pattern error:', { pattern, error });
      return 0;
    }
  }
}

export const cacheService = new CacheService();
```

### User Cache Service
```typescript
// infrastructure/redis/userCacheService.ts
import { cacheService } from './cacheService';
import { CacheKeys } from '@/shared/utils/cacheKeys';
import { User } from '@/shared/types/user';
import { logger } from '@/shared/utils/logger';

export class UserCacheService {
  private readonly USER_TTL = 3600; // 1 hour
  private readonly FRIENDS_TTL = 1800; // 30 minutes
  private readonly PROFILE_TTL = 7200; // 2 hours

  async getUser(userId: string): Promise<User | null> {
    const key = CacheKeys.user(userId);
    return await cacheService.get<User>(key);
  }

  async setUser(user: User): Promise<void> {
    const key = CacheKeys.user(user.id);
    await cacheService.set(key, user, this.USER_TTL);
  }

  async getUserFriends(userId: string): Promise<string[] | null> {
    const key = CacheKeys.userFriends(userId);
    return await cacheService.get<string[]>(key);
  }

  async setUserFriends(userId: string, friendIds: string[]): Promise<void> {
    const key = CacheKeys.userFriends(userId);
    await cacheService.set(key, friendIds, this.FRIENDS_TTL);
  }

  async getUserProfile(userId: string): Promise<User | null> {
    const key = CacheKeys.userProfile(userId);
    return await cacheService.get<User>(key);
  }

  async setUserProfile(user: User): Promise<void> {
    const key = CacheKeys.userProfile(user.id);
    await cacheService.set(key, user, this.PROFILE_TTL);
  }

  async invalidateUser(userId: string): Promise<void> {
    const keys = [
      CacheKeys.user(userId),
      CacheKeys.userFriends(userId),
      CacheKeys.userProfile(userId),
      CacheKeys.userSettings(userId)
    ];

    await Promise.all(keys.map(key => cacheService.del(key)));
    logger.info('User cache invalidated', { userId });
  }

  async invalidateUserFriends(userId: string): Promise<void> {
    const key = CacheKeys.userFriends(userId);
    await cacheService.del(key);
  }

  async warmUserCache(user: User): Promise<void> {
    await Promise.all([
      this.setUser(user),
      this.setUserProfile(user)
    ]);
  }
}

export const userCacheService = new UserCacheService();
```

### Post Cache Service
```typescript
// infrastructure/redis/postCacheService.ts
import { cacheService } from './cacheService';
import { CacheKeys } from '@/shared/utils/cacheKeys';
import { Post } from '@/shared/types/post';
import { logger } from '@/shared/utils/logger';

export class PostCacheService {
  private readonly POST_TTL = 1800; // 30 minutes
  private readonly FEED_TTL = 900; // 15 minutes
  private readonly COMMENTS_TTL = 600; // 10 minutes

  async getPost(postId: string): Promise<Post | null> {
    const key = CacheKeys.post(postId);
    return await cacheService.get<Post>(key);
  }

  async setPost(post: Post): Promise<void> {
    const key = CacheKeys.post(post.id);
    await cacheService.set(key, post, this.POST_TTL);
  }

  async getUserFeed(userId: string, page: number): Promise<Post[] | null> {
    const key = CacheKeys.userFeed(userId, page);
    return await cacheService.get<Post[]>(key);
  }

  async setUserFeed(userId: string, page: number, posts: Post[]): Promise<void> {
    const key = CacheKeys.userFeed(userId, page);
    await cacheService.set(key, posts, this.FEED_TTL);
  }

  async getPostComments(postId: string): Promise<any[] | null> {
    const key = CacheKeys.postComments(postId);
    return await cacheService.get<any[]>(key);
  }

  async setPostComments(postId: string, comments: any[]): Promise<void> {
    const key = CacheKeys.postComments(postId);
    await cacheService.set(key, comments, this.COMMENTS_TTL);
  }

  async getPostReactions(postId: string): Promise<any[] | null> {
    const key = CacheKeys.postReactions(postId);
    return await cacheService.get<any[]>(key);
  }

  async setPostReactions(postId: string, reactions: any[]): Promise<void> {
    const key = CacheKeys.postReactions(postId);
    await cacheService.set(key, reactions, this.POST_TTL);
  }

  async invalidatePost(postId: string): Promise<void> {
    const keys = [
      CacheKeys.post(postId),
      CacheKeys.postComments(postId),
      CacheKeys.postReactions(postId)
    ];

    await Promise.all(keys.map(key => cacheService.del(key)));
    
    // Invalidate all user feeds that might contain this post
    await this.invalidateAllFeeds();
    
    logger.info('Post cache invalidated', { postId });
  }

  async invalidateAllFeeds(): Promise<void> {
    const pattern = 'feed:*';
    await cacheService.flushPattern(pattern);
    logger.info('All user feeds invalidated');
  }

  async invalidateUserFeeds(userId: string): Promise<void> {
    const pattern = `feed:${userId}:*`;
    await cacheService.flushPattern(pattern);
    logger.info('User feeds invalidated', { userId });
  }

  async warmPostCache(post: Post): Promise<void> {
    await this.setPost(post);
  }
}

export const postCacheService = new PostCacheService();
```

## 🔐 Session Management

### Session Service
```typescript
// infrastructure/redis/sessionService.ts
import { cacheService } from './cacheService';
import { CacheKeys } from '@/shared/utils/cacheKeys';
import { logger } from '@/shared/utils/logger';

interface SessionData {
  userId: string;
  email: string;
  username: string;
  role: string;
  permissions: string[];
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
}

export class SessionService {
  private readonly SESSION_TTL = 86400; // 24 hours
  private readonly REFRESH_TTL = 2592000; // 30 days

  async createSession(sessionId: string, sessionData: SessionData): Promise<void> {
    const key = CacheKeys.session(sessionId);
    const userSessionKey = CacheKeys.userSession(sessionData.userId);
    
    await Promise.all([
      cacheService.set(key, sessionData, this.SESSION_TTL),
      cacheService.set(userSessionKey, sessionId, this.REFRESH_TTL)
    ]);
    
    logger.info('Session created', { sessionId, userId: sessionData.userId });
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = CacheKeys.session(sessionId);
    const session = await cacheService.get<SessionData>(key);
    
    if (session) {
      // Update last activity
      session.lastActivity = new Date();
      await cacheService.set(key, session, this.SESSION_TTL);
    }
    
    return session;
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      const updatedSession = { ...session, ...updates };
      const key = CacheKeys.session(sessionId);
      await cacheService.set(key, updatedSession, this.SESSION_TTL);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      const keys = [
        CacheKeys.session(sessionId),
        CacheKeys.userSession(session.userId)
      ];
      
      await Promise.all(keys.map(key => cacheService.del(key)));
      logger.info('Session deleted', { sessionId, userId: session.userId });
    }
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const userSessionKey = CacheKeys.userSession(userId);
    const sessionId = await cacheService.get<string>(userSessionKey);
    
    if (sessionId) {
      await this.deleteSession(sessionId);
    }
    
    // Delete all sessions for user
    const pattern = `session:*`;
    const sessions = await cacheService.get<SessionData[]>(pattern);
    
    for (const session of sessions || []) {
      if (session.userId === userId) {
        const key = CacheKeys.session(sessionId!);
        await cacheService.del(key);
      }
    }
  }

  async extendSession(sessionId: string): Promise<void> {
    const key = CacheKeys.session(sessionId);
    const ttl = await cacheService.ttl(key);
    
    if (ttl > 0) {
      await cacheService.expire(key, this.SESSION_TTL);
    }
  }

  async getActiveSessions(userId: string): Promise<SessionData[]> {
    const userSessionKey = CacheKeys.userSession(userId);
    const sessionId = await cacheService.get<string>(userSessionKey);
    
    if (sessionId) {
      const session = await this.getSession(sessionId);
      return session ? [session] : [];
    }
    
    return [];
  }
}

export const sessionService = new SessionService();
```

## 📡 Pub/Sub Messaging

### Message Broker Service
```typescript
// infrastructure/redis/messageBroker.ts
import { redisConnection } from './connection';
import { logger } from '@/shared/utils/logger';

interface Message {
  type: string;
  data: any;
  timestamp: Date;
  messageId: string;
}

export class MessageBroker {
  private subscriber = redisConnection.getSubscriber();
  private publisher = redisConnection.getPublisher();
  private subscriptions = new Map<string, Set<(message: Message) => void>>();

  async subscribe(channel: string, callback: (message: Message) => void): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel, this.handleMessage.bind(this));
    }
    
    this.subscriptions.get(channel)!.add(callback);
    logger.info('Subscribed to channel', { channel });
  }

  async unsubscribe(channel: string, callback: (message: Message) => void): Promise<void> {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.delete(callback);
      
      if (callbacks.size === 0) {
        this.subscriptions.delete(channel);
        await this.subscriber.unsubscribe(channel);
        logger.info('Unsubscribed from channel', { channel });
      }
    }
  }

  async publish(channel: string, message: Omit<Message, 'timestamp' | 'messageId'>): Promise<void> {
    const fullMessage: Message = {
      ...message,
      timestamp: new Date(),
      messageId: this.generateMessageId()
    };

    await this.publisher.publish(channel, JSON.stringify(fullMessage));
    logger.debug('Message published', { channel, messageId: fullMessage.messageId });
  }

  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const parsedMessage: Message = JSON.parse(message);
      const callbacks = this.subscriptions.get(channel);
      
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(parsedMessage);
          } catch (error) {
            logger.error('Message handler error:', { channel, error });
          }
        });
      }
    } catch (error) {
      logger.error('Message parsing error:', { channel, error });
    }
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const messageBroker = new MessageBroker();
```

## 🚦 Rate Limiting

### Rate Limiter Service
```typescript
// infrastructure/redis/rateLimiter.ts
import { cacheService } from './cacheService';
import { CacheKeys } from '@/shared/utils/cacheKeys';
import { logger } from '@/shared/utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export class RateLimiter {
  async checkLimit(
    identifier: string,
    type: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = CacheKeys.rateLimit(type, identifier);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Use Redis sorted set for sliding window
      const pipeline = this.client.multi();
      
      // Remove expired entries
      pipeline.zRemRangeByScore(key, 0, windowStart);
      
      // Count current requests
      pipeline.zCard(key);
      
      // Add current request
      pipeline.zAdd(key, { score: now, value: now.toString() });
      
      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));
      
      const results = await pipeline.exec();
      const currentCount = results[1][1] as number;
      
      const allowed = currentCount < config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - currentCount - 1);
      const resetTime = now + config.windowMs;

      if (!allowed) {
        logger.warn('Rate limit exceeded', { identifier, type, currentCount });
      }

      return { allowed, remaining, resetTime };
    } catch (error) {
      logger.error('Rate limiter error:', { identifier, type, error });
      // Fail open - allow request if Redis is down
      return { allowed: true, remaining: config.maxRequests, resetTime: now + config.windowMs };
    }
  }

  async resetLimit(identifier: string, type: string): Promise<void> {
    const key = CacheKeys.rateLimit(type, identifier);
    await cacheService.del(key);
  }
}

export const rateLimiter = new RateLimiter();
```

## 🔄 Cache Warming Strategies

### Cache Warming Service
```typescript
// infrastructure/redis/cacheWarmingService.ts
import { userCacheService } from './userCacheService';
import { postCacheService } from './postCacheService';
import { userRepository } from '@/infrastructure/database/repositories/userRepository';
import { postRepository } from '@/infrastructure/database/repositories/postRepository';
import { logger } from '@/shared/utils/logger';

export class CacheWarmingService {
  async warmUserCache(userIds: string[]): Promise<void> {
    const users = await userRepository.findByIds(userIds);
    
    await Promise.all(
      users.map(user => userCacheService.warmUserCache(user))
    );
    
    logger.info('User cache warmed', { count: users.length });
  }

  async warmPostCache(postIds: string[]): Promise<void> {
    const posts = await postRepository.findByIds(postIds);
    
    await Promise.all(
      posts.map(post => postCacheService.warmPostCache(post))
    );
    
    logger.info('Post cache warmed', { count: posts.length });
  }

  async warmPopularContent(): Promise<void> {
    // Warm cache for trending posts
    const trendingPosts = await postRepository.getTrendingPosts(100);
    await this.warmPostCache(trendingPosts.map(p => p.id));
    
    // Warm cache for active users
    const activeUsers = await userRepository.getActiveUsers(1000);
    await this.warmUserCache(activeUsers.map(u => u.id));
    
    logger.info('Popular content cache warmed');
  }

  async scheduleCacheWarming(): Promise<void> {
    // Run cache warming every 30 minutes
    setInterval(async () => {
      try {
        await this.warmPopularContent();
      } catch (error) {
        logger.error('Cache warming failed:', error);
      }
    }, 30 * 60 * 1000);
  }
}

export const cacheWarmingService = new CacheWarmingService();
```

## 🧪 Testing

### Redis Test Setup
```typescript
// tests/redis/setup.ts
import { createClient } from 'redis';

let testClient: any;

beforeAll(async () => {
  testClient = createClient({
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
  });
  await testClient.connect();
});

afterAll(async () => {
  await testClient.flushDb();
  await testClient.quit();
});

beforeEach(async () => {
  await testClient.flushDb();
});

export { testClient };
```

This Redis implementation provides comprehensive caching, session management, and real-time messaging for our mini Facebook backend.
