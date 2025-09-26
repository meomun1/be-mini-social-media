# Redis Caching Strategy

## 🔴 Overview

Redis serves as our primary caching layer, session store, and pub/sub messaging system for real-time features in our mini Facebook backend microservices architecture. Each service has its own Redis cache namespace and strategies while sharing the same Redis instance for efficiency.

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

## 🗂️ Service-Specific Cache Key Strategy

### Microservices Cache Namespace
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Auth Service   │    │  User Service   │    │  Post Service   │
│  Port: 3100     │    │  Port: 3200     │    │  Port: 3300     │
│                 │    │                 │    │                 │
│  auth:user:123  │    │  users:123      │    │  posts:456      │
│  auth:session   │    │  users:friends  │    │  posts:feed     │
│  auth:tokens    │    │  users:profile  │    │  posts:comments │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Shared Redis   │
                    │  Instance       │
                    │  Port: 6379     │
                    │                 │
                    │  Rate Limiting  │
                    │  Pub/Sub        │
                    │  Global Cache   │
                    └─────────────────┘
```

### Service-Specific Key Naming Convention
```typescript
// shared/utils/cacheKeys.ts
export class CacheKeys {
  // Auth Service Keys
  static authUser(id: string): string {
    return `auth:user:${id}`;
  }

  static authSession(id: string): string {
    return `auth:session:${id}`;
  }

  static authRefreshToken(id: string): string {
    return `auth:refresh:${id}`;
  }

  static authBlacklist(tokenHash: string): string {
    return `auth:blacklist:${tokenHash}`;
  }

  // User Service Keys
  static userProfile(id: string): string {
    return `users:profile:${id}`;
  }

  static userFriends(id: string): string {
    return `users:friends:${id}`;
  }

  static userSettings(id: string): string {
    return `users:settings:${id}`;
  }

  static userSearch(query: string): string {
    return `users:search:${Buffer.from(query).toString('base64')}`;
  }

  // Post Service Keys
  static post(id: string): string {
    return `posts:post:${id}`;
  }

  static postComments(id: string): string {
    return `posts:comments:${id}`;
  }

  static postReactions(id: string): string {
    return `posts:reactions:${id}`;
  }

  static userFeed(userId: string, page: number): string {
    return `posts:feed:${userId}:page:${page}`;
  }

  static trendingPosts(): string {
    return 'posts:trending';
  }

  // Message Service Keys
  static conversation(id: string): string {
    return `messages:conversation:${id}`;
  }

  static conversationMessages(id: string, page: number): string {
    return `messages:conversation:${id}:messages:page:${page}`;
  }

  static userConversations(userId: string): string {
    return `messages:user:${userId}:conversations`;
  }

  // Media Service Keys
  static mediaFile(id: string): string {
    return `media:file:${id}`;
  }

  static userMedia(userId: string, page: number): string {
    return `media:user:${userId}:page:${page}`;
  }

  static mediaCollection(id: string): string {
    return `media:collection:${id}`;
  }

  // Notification Service Keys
  static userNotifications(userId: string): string {
    return `notifications:user:${userId}`;
  }

  static unreadCount(userId: string): string {
    return `notifications:unread:${userId}`;
  }

  static notificationPreferences(userId: string): string {
    return `notifications:preferences:${userId}`;
  }

  // Search Service Keys
  static searchSuggestions(query: string): string {
    return `search:suggestions:${Buffer.from(query).toString('base64')}`;
  }

  static searchResults(query: string, filters: string): string {
    return `search:results:${Buffer.from(query + filters).toString('base64')}`;
  }

  // Global/Shared Keys
  static rateLimit(type: string, identifier: string): string {
    return `global:rate_limit:${type}:${identifier}`;
  }

  static lock(resource: string): string {
    return `global:lock:${resource}`;
  }

  static userOnlineStatus(userId: string): string {
    return `global:online:${userId}`;
  }

  static websocketConnections(): string {
    return 'global:websocket:connections';
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

### Auth Service Cache
```typescript
// services/auth-service/cache/authCacheService.ts
import { cacheService } from '@/infrastructure/redis/cacheService';
import { CacheKeys } from '@/shared/utils/cacheKeys';
import { logger } from '@/shared/utils/logger';

export class AuthCacheService {
  private readonly SESSION_TTL = 86400; // 24 hours
  private readonly REFRESH_TTL = 2592000; // 30 days
  private readonly BLACKLIST_TTL = 86400; // 24 hours

  async getSession(sessionId: string): Promise<any | null> {
    const key = CacheKeys.authSession(sessionId);
    return await cacheService.get(key);
  }

  async setSession(sessionId: string, sessionData: any): Promise<void> {
    const key = CacheKeys.authSession(sessionId);
    await cacheService.set(key, sessionData, this.SESSION_TTL);
  }

  async getRefreshToken(tokenId: string): Promise<any | null> {
    const key = CacheKeys.authRefreshToken(tokenId);
    return await cacheService.get(key);
  }

  async setRefreshToken(tokenId: string, tokenData: any): Promise<void> {
    const key = CacheKeys.authRefreshToken(tokenId);
    await cacheService.set(key, tokenData, this.REFRESH_TTL);
  }

  async blacklistToken(tokenHash: string): Promise<void> {
    const key = CacheKeys.authBlacklist(tokenHash);
    await cacheService.set(key, true, this.BLACKLIST_TTL);
  }

  async isTokenBlacklisted(tokenHash: string): Promise<boolean> {
    const key = CacheKeys.authBlacklist(tokenHash);
    const result = await cacheService.get(key);
    return result === true;
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    const pattern = `auth:session:*`;
    await cacheService.flushPattern(pattern);
    logger.info('User sessions invalidated', { userId });
  }
}

export const authCacheService = new AuthCacheService();
```

### User Service Cache
```typescript
// services/user-service/cache/userCacheService.ts
import { cacheService } from '@/infrastructure/redis/cacheService';
import { CacheKeys } from '@/shared/utils/cacheKeys';
import { UserProfile } from '@/shared/types/user';
import { logger } from '@/shared/utils/logger';

export class UserCacheService {
  private readonly PROFILE_TTL = 7200; // 2 hours
  private readonly FRIENDS_TTL = 1800; // 30 minutes
  private readonly SETTINGS_TTL = 3600; // 1 hour

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const key = CacheKeys.userProfile(userId);
    return await cacheService.get<UserProfile>(key);
  }

  async setUserProfile(profile: UserProfile): Promise<void> {
    const key = CacheKeys.userProfile(profile.id);
    await cacheService.set(key, profile, this.PROFILE_TTL);
  }

  async getUserFriends(userId: string): Promise<string[] | null> {
    const key = CacheKeys.userFriends(userId);
    return await cacheService.get<string[]>(key);
  }

  async setUserFriends(userId: string, friendIds: string[]): Promise<void> {
    const key = CacheKeys.userFriends(userId);
    await cacheService.set(key, friendIds, this.FRIENDS_TTL);
  }

  async getUserSettings(userId: string): Promise<any | null> {
    const key = CacheKeys.userSettings(userId);
    return await cacheService.get(key);
  }

  async setUserSettings(userId: string, settings: any): Promise<void> {
    const key = CacheKeys.userSettings(userId);
    await cacheService.set(key, settings, this.SETTINGS_TTL);
  }

  async invalidateUser(userId: string): Promise<void> {
    const keys = [
      CacheKeys.userProfile(userId),
      CacheKeys.userFriends(userId),
      CacheKeys.userSettings(userId)
    ];

    await Promise.all(keys.map(key => cacheService.del(key)));
    logger.info('User cache invalidated', { userId });
  }

  async warmUserCache(profile: UserProfile): Promise<void> {
    await this.setUserProfile(profile);
  }
}

export const userCacheService = new UserCacheService();
```

### Post Service Cache
```typescript
// services/post-service/cache/postCacheService.ts
import { cacheService } from '@/infrastructure/redis/cacheService';
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
    const pattern = 'posts:feed:*';
    await cacheService.flushPattern(pattern);
    logger.info('All user feeds invalidated');
  }

  async invalidateUserFeeds(userId: string): Promise<void> {
    const pattern = `posts:feed:${userId}:*`;
    await cacheService.flushPattern(pattern);
    logger.info('User feeds invalidated', { userId });
  }

  async warmPostCache(post: Post): Promise<void> {
    await this.setPost(post);
  }
}

export const postCacheService = new PostCacheService();
```

### Message Service Cache
```typescript
// services/message-service/cache/messageCacheService.ts
import { cacheService } from '@/infrastructure/redis/cacheService';
import { CacheKeys } from '@/shared/utils/cacheKeys';
import { logger } from '@/shared/utils/logger';

export class MessageCacheService {
  private readonly CONVERSATION_TTL = 3600; // 1 hour
  private readonly MESSAGES_TTL = 1800; // 30 minutes
  private readonly USER_CONVERSATIONS_TTL = 900; // 15 minutes

  async getConversation(conversationId: string): Promise<any | null> {
    const key = CacheKeys.conversation(conversationId);
    return await cacheService.get(key);
  }

  async setConversation(conversation: any): Promise<void> {
    const key = CacheKeys.conversation(conversation.id);
    await cacheService.set(key, conversation, this.CONVERSATION_TTL);
  }

  async getConversationMessages(conversationId: string, page: number): Promise<any[] | null> {
    const key = CacheKeys.conversationMessages(conversationId, page);
    return await cacheService.get<any[]>(key);
  }

  async setConversationMessages(conversationId: string, page: number, messages: any[]): Promise<void> {
    const key = CacheKeys.conversationMessages(conversationId, page);
    await cacheService.set(key, messages, this.MESSAGES_TTL);
  }

  async getUserConversations(userId: string): Promise<any[] | null> {
    const key = CacheKeys.userConversations(userId);
    return await cacheService.get<any[]>(key);
  }

  async setUserConversations(userId: string, conversations: any[]): Promise<void> {
    const key = CacheKeys.userConversations(userId);
    await cacheService.set(key, conversations, this.USER_CONVERSATIONS_TTL);
  }

  async invalidateConversation(conversationId: string): Promise<void> {
    const keys = [
      CacheKeys.conversation(conversationId),
      CacheKeys.userConversations('*') // Will need to invalidate for all participants
    ];

    await Promise.all(keys.map(key => cacheService.del(key)));
    logger.info('Conversation cache invalidated', { conversationId });
  }

  async invalidateUserConversations(userId: string): Promise<void> {
    const key = CacheKeys.userConversations(userId);
    await cacheService.del(key);
    logger.info('User conversations cache invalidated', { userId });
  }
}

export const messageCacheService = new MessageCacheService();
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
