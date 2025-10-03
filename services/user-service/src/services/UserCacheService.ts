import { BaseCacheService } from '../../../../infrastructure/dist/redis/baseCacheService';
import { CacheKeys } from '../../../../infrastructure/dist/redis/cacheKeys';
import { UserProfile, PrivacySettings, UserSearchResult } from '@shared/types';
import { createLogger } from '@shared/types';

const logger = createLogger('user');

export class UserCacheService extends BaseCacheService {
  private readonly PROFILE_TTL = 300; // 5 minutes
  private readonly FRIENDS_TTL = 600; // 10 minutes
  private readonly PRIVACY_TTL = 1800; // 30 minutes
  private readonly SEARCH_TTL = 60; // 1 minute

  constructor() {
    super('user-service');
  }

  // User Profile Cache Methods
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const key = CacheKeys.userProfile(userId);
    return this.get<UserProfile>(key);
  }

  async setUserProfile(userId: string, profile: UserProfile): Promise<boolean> {
    const key = CacheKeys.userProfile(userId);
    return this.set(key, profile, { ttl: this.PROFILE_TTL });
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    const key = CacheKeys.userProfile(userId);
    await this.del(key);
    logger.info('User profile cache invalidated', { userId });
  }

  // Privacy Settings Cache Methods
  async getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    const key = CacheKeys.userPrivacySettings(userId);
    return this.get<PrivacySettings>(key);
  }

  async setPrivacySettings(userId: string, settings: PrivacySettings): Promise<boolean> {
    const key = CacheKeys.userPrivacySettings(userId);
    return this.set(key, settings, { ttl: this.PRIVACY_TTL });
  }

  async invalidatePrivacySettings(userId: string): Promise<void> {
    const key = CacheKeys.userPrivacySettings(userId);
    await this.del(key);
    logger.info('Privacy settings cache invalidated', { userId });
  }

  // Friends Cache Methods
  async getFriends(userId: string): Promise<string[] | null> {
    const key = CacheKeys.userFriends(userId);
    return this.get<string[]>(key);
  }

  async setFriends(userId: string, friendIds: string[]): Promise<boolean> {
    const key = CacheKeys.userFriends(userId);
    return this.set(key, friendIds, { ttl: this.FRIENDS_TTL });
  }

  async invalidateFriends(userId: string): Promise<void> {
    const key = CacheKeys.userFriends(userId);
    await this.del(key);
    logger.info('Friends cache invalidated', { userId });
  }

  // Friend Requests Cache Methods
  async getFriendRequests(userId: string): Promise<any[] | null> {
    const key = CacheKeys.userFriendRequests(userId);
    return this.get<any[]>(key);
  }

  async setFriendRequests(userId: string, requests: any[]): Promise<boolean> {
    const key = CacheKeys.userFriendRequests(userId);
    return this.set(key, requests, { ttl: this.FRIENDS_TTL });
  }

  async invalidateFriendRequests(userId: string): Promise<void> {
    const key = CacheKeys.userFriendRequests(userId);
    await this.del(key);
    logger.info('Friend requests cache invalidated', { userId });
  }

  // User Search Cache Methods
  async getSearchResults(query: string): Promise<UserSearchResult[] | null> {
    const key = CacheKeys.userSearch(query);
    return this.get<UserSearchResult[]>(key);
  }

  async setSearchResults(query: string, results: UserSearchResult[]): Promise<boolean> {
    const key = CacheKeys.userSearch(query);
    return this.set(key, results, { ttl: this.SEARCH_TTL });
  }

  async invalidateSearchCache(): Promise<void> {
    const pattern = 'users:search:*';
    await this.delPattern(pattern);
    logger.info('User search cache invalidated');
  }

  // Comprehensive Cache Invalidation
  async invalidateUserCache(userId: string): Promise<void> {
    await Promise.all([
      this.invalidateUserProfile(userId),
      this.invalidatePrivacySettings(userId),
      this.invalidateFriends(userId),
      this.invalidateFriendRequests(userId),
    ]);
    logger.info('All user cache invalidated', { userId });
  }

  // Abstract method implementation from BaseCacheService
  getCacheKeyPrefix(): string {
    return 'users';
  }

  // Cache warming for performance
  async warmUserCache(
    userId: string,
    profile: UserProfile,
    friends?: string[],
    privacy?: PrivacySettings
  ): Promise<void> {
    await Promise.all([
      this.setUserProfile(userId, profile),
      ...(friends ? [this.setFriends(userId, friends)] : []),
      ...(privacy ? [this.setPrivacySettings(userId, privacy)] : []),
    ]);
    logger.info('User cache warmed', { userId });
  }

  // Batch operations for efficiency
  async getMultipleUserProfiles(userIds: string[]): Promise<(UserProfile | null)[]> {
    const keys = userIds.map(id => CacheKeys.userProfile(id));
    return this.mget<UserProfile>(keys);
  }

  async setMultipleUserProfiles(
    profiles: Array<{ userId: string; profile: UserProfile }>
  ): Promise<boolean> {
    const keyValuePairs: Record<string, UserProfile> = {};
    profiles.forEach(({ userId, profile }) => {
      keyValuePairs[CacheKeys.userProfile(userId)] = profile;
    });
    return this.mset(keyValuePairs, this.PROFILE_TTL);
  }
}
