import { BaseCacheService } from '../../../../infrastructure/dist/redis/baseCacheService';
import { CacheKeys } from '../../../../infrastructure/dist/redis/cacheKeys';
import { createLogger } from '@shared/types';

const logger = createLogger('auth');

export interface SessionData {
  userId: string;
  email: string;
  username: string;
  role: string;
  permissions: string[];
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export interface RefreshTokenData {
  userId: string;
  tokenId: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
}

export interface AuthRateLimitData {
  attempts: number;
  windowStart: number;
  lockedUntil?: Date;
}

export class AuthCacheService extends BaseCacheService {
  private readonly SESSION_TTL = 86400; // 24 hours
  private readonly REFRESH_TTL = 2592000; // 30 days
  private readonly BLACKLIST_TTL = 86400; // 24 hours
  private readonly RATE_LIMIT_TTL = 900; // 15 minutes
  private readonly FAILED_ATTEMPTS_TTL = 3600; // 1 hour
  private readonly ACCOUNT_LOCKOUT_TTL = 1800; // 30 minutes

  constructor() {
    super('auth-service');
  }

  // Session Management
  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = CacheKeys.authSession(sessionId);
    return this.get<SessionData>(key);
  }

  async setSession(sessionId: string, sessionData: SessionData): Promise<boolean> {
    const key = CacheKeys.authSession(sessionId);
    return this.set(key, sessionData, { ttl: this.SESSION_TTL });
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const key = CacheKeys.authSession(sessionId);
    return this.del(key);
  }

  async getUserSessions(userId: string): Promise<string[]> {
    const key = CacheKeys.authUserSessions(userId);
    const sessions = await this.get<string[]>(key);
    return sessions || [];
  }

  async addUserSession(userId: string, sessionId: string): Promise<boolean> {
    const key = CacheKeys.authUserSessions(userId);
    const sessions = await this.getUserSessions(userId);
    sessions.push(sessionId);
    return this.set(key, sessions, { ttl: this.SESSION_TTL });
  }

  async removeUserSession(userId: string, sessionId: string): Promise<boolean> {
    const key = CacheKeys.authUserSessions(userId);
    const sessions = await this.getUserSessions(userId);
    const updatedSessions = sessions.filter(id => id !== sessionId);
    return this.set(key, updatedSessions, { ttl: this.SESSION_TTL });
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessions(userId);

    // Delete all user sessions
    await Promise.all(sessionIds.map(sessionId => this.deleteSession(sessionId)));

    // Clear user sessions list
    const key = CacheKeys.authUserSessions(userId);
    await this.del(key);

    logger.info('User sessions invalidated', { userId, sessionCount: sessionIds.length });
  }

  // Refresh Token Management
  async getRefreshToken(tokenId: string): Promise<RefreshTokenData | null> {
    const key = CacheKeys.authRefreshToken(tokenId);
    return this.get<RefreshTokenData>(key);
  }

  async setRefreshToken(tokenId: string, tokenData: RefreshTokenData): Promise<boolean> {
    const key = CacheKeys.authRefreshToken(tokenId);
    return this.set(key, tokenData, { ttl: this.REFRESH_TTL });
  }

  async deleteRefreshToken(tokenId: string): Promise<boolean> {
    const key = CacheKeys.authRefreshToken(tokenId);
    return this.del(key);
  }

  async revokeRefreshToken(tokenId: string): Promise<boolean> {
    const tokenData = await this.getRefreshToken(tokenId);
    if (tokenData) {
      tokenData.isRevoked = true;
      return this.setRefreshToken(tokenId, tokenData);
    }
    return false;
  }

  // Token Blacklisting
  async blacklistToken(tokenHash: string): Promise<boolean> {
    const key = CacheKeys.authBlacklist(tokenHash);
    return this.set(key, true, { ttl: this.BLACKLIST_TTL });
  }

  async isTokenBlacklisted(tokenHash: string): Promise<boolean> {
    const key = CacheKeys.authBlacklist(tokenHash);
    const result = await this.get<boolean>(key);
    return result === true;
  }

  // Rate Limiting
  async checkLoginRateLimit(
    ipAddress: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = CacheKeys.rateLimit('login', ipAddress);
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;

    try {
      // Get current rate limit data
      const rateLimitData = await this.get<AuthRateLimitData>(key);

      if (!rateLimitData || now > rateLimitData.windowStart + windowMs) {
        // New window or no data
        const newData: AuthRateLimitData = {
          attempts: 1,
          windowStart: now,
        };
        await this.set(key, newData, { ttl: this.RATE_LIMIT_TTL });

        return {
          allowed: true,
          remaining: maxAttempts - 1,
          resetTime: now + windowMs,
        };
      }

      if (rateLimitData.attempts >= maxAttempts) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: rateLimitData.windowStart + windowMs,
        };
      }

      // Increment attempts
      rateLimitData.attempts++;
      await this.set(key, rateLimitData, { ttl: this.RATE_LIMIT_TTL });

      return {
        allowed: true,
        remaining: maxAttempts - rateLimitData.attempts,
        resetTime: rateLimitData.windowStart + windowMs,
      };
    } catch (error) {
      logger.error('Rate limit check error', { ipAddress, error: (error as Error).message });
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: maxAttempts,
        resetTime: now + windowMs,
      };
    }
  }

  async checkPasswordResetRateLimit(
    email: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = CacheKeys.rateLimit('password_reset', email);
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxAttempts = 3;

    try {
      const rateLimitData = await this.get<AuthRateLimitData>(key);

      if (!rateLimitData || now > rateLimitData.windowStart + windowMs) {
        const newData: AuthRateLimitData = {
          attempts: 1,
          windowStart: now,
        };
        await this.set(key, newData, { ttl: 3600 });

        return {
          allowed: true,
          remaining: maxAttempts - 1,
          resetTime: now + windowMs,
        };
      }

      if (rateLimitData.attempts >= maxAttempts) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: rateLimitData.windowStart + windowMs,
        };
      }

      rateLimitData.attempts++;
      await this.set(key, rateLimitData, { ttl: 3600 });

      return {
        allowed: true,
        remaining: maxAttempts - rateLimitData.attempts,
        resetTime: rateLimitData.windowStart + windowMs,
      };
    } catch (error) {
      logger.error('Password reset rate limit check error', {
        email,
        error: (error as Error).message,
      });
      return {
        allowed: true,
        remaining: maxAttempts,
        resetTime: now + windowMs,
      };
    }
  }

  // Failed Login Attempts Tracking
  async incrementFailedAttempts(
    userId: string
  ): Promise<{ attempts: number; isLocked: boolean; lockoutUntil?: Date }> {
    const key = `auth:failed_attempts:${userId}`;
    const now = Date.now();
    const maxAttempts = 5;
    const lockoutDuration = 30 * 60 * 1000; // 30 minutes

    try {
      const attemptsData = await this.get<{ attempts: number; lastAttempt: number }>(key);

      if (!attemptsData || now > attemptsData.lastAttempt + lockoutDuration) {
        // Reset attempts after lockout period
        const newData = { attempts: 1, lastAttempt: now };
        await this.set(key, newData, { ttl: this.FAILED_ATTEMPTS_TTL });

        return {
          attempts: 1,
          isLocked: false,
        };
      }

      const newAttempts = attemptsData.attempts + 1;
      const isLocked = newAttempts >= maxAttempts;

      await this.set(
        key,
        { attempts: newAttempts, lastAttempt: now },
        { ttl: this.FAILED_ATTEMPTS_TTL }
      );

      if (isLocked) {
        const lockoutUntil = new Date(now + lockoutDuration);
        await this.setAccountLockout(userId, lockoutUntil);

        return {
          attempts: newAttempts,
          isLocked: true,
          lockoutUntil,
        };
      }

      return {
        attempts: newAttempts,
        isLocked: false,
      };
    } catch (error) {
      logger.error('Failed to track login attempts', { userId, error: (error as Error).message });
      return {
        attempts: 1,
        isLocked: false,
      };
    }
  }

  async clearFailedAttempts(userId: string): Promise<void> {
    const key = `auth:failed_attempts:${userId}`;
    await this.del(key);
    await this.clearAccountLockout(userId);
    logger.info('Failed login attempts cleared', { userId });
  }

  // Account Lockout
  async setAccountLockout(userId: string, lockoutUntil: Date): Promise<boolean> {
    const key = `auth:account_lockout:${userId}`;
    return this.set(key, { lockoutUntil }, { ttl: this.ACCOUNT_LOCKOUT_TTL });
  }

  async getAccountLockout(userId: string): Promise<{ lockoutUntil: Date } | null> {
    const key = `auth:account_lockout:${userId}`;
    return this.get<{ lockoutUntil: Date }>(key);
  }

  async clearAccountLockout(userId: string): Promise<boolean> {
    const key = `auth:account_lockout:${userId}`;
    return this.del(key);
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    const lockoutData = await this.getAccountLockout(userId);
    if (!lockoutData) return false;

    return new Date() < new Date(lockoutData.lockoutUntil);
  }

  // Utility Methods
  async invalidateUserCache(userId: string): Promise<void> {
    await Promise.all([this.invalidateUserSessions(userId), this.clearFailedAttempts(userId)]);
    logger.info('User auth cache invalidated', { userId });
  }

  override getCacheKeyPrefix(): string {
    return 'auth';
  }

  // Health Check
  override async healthCheck(): Promise<boolean> {
    try {
      return await this.redis.ping();
    } catch (error) {
      logger.error('Auth cache health check failed', { error: (error as Error).message });
      return false;
    }
  }
}
