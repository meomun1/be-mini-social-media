/**
 * Centralized cache key naming convention for all microservices
 * Ensures consistent key patterns and prevents conflicts
 */

export class CacheKeys {
  // Service prefixes to avoid key conflicts
  private static readonly SERVICE_PREFIXES = {
    AUTH: 'auth',
    USER: 'users',
    POST: 'posts',
    MESSAGE: 'messages',
    MEDIA: 'media',
    SEARCH: 'search',
    NOTIFICATION: 'notifications',
    GLOBAL: 'global',
  };

  // Auth Service Keys
  static authUser(id: string): string {
    return `${this.SERVICE_PREFIXES.AUTH}:user:${id}`;
  }

  static authSession(id: string): string {
    return `${this.SERVICE_PREFIXES.AUTH}:session:${id}`;
  }

  static authRefreshToken(id: string): string {
    return `${this.SERVICE_PREFIXES.AUTH}:refresh:${id}`;
  }

  static authBlacklist(tokenHash: string): string {
    return `${this.SERVICE_PREFIXES.AUTH}:blacklist:${tokenHash}`;
  }

  static authUserSessions(userId: string): string {
    return `${this.SERVICE_PREFIXES.AUTH}:user_sessions:${userId}`;
  }

  // User Service Keys
  static userProfile(id: string): string {
    return `${this.SERVICE_PREFIXES.USER}:profile:${id}`;
  }

  static userFriends(id: string): string {
    return `${this.SERVICE_PREFIXES.USER}:friends:${id}`;
  }

  static userPrivacySettings(id: string): string {
    return `${this.SERVICE_PREFIXES.USER}:privacy:${id}`;
  }

  static userSearch(query: string): string {
    const encodedQuery = Buffer.from(query.toLowerCase().replace(/\s+/g, '_')).toString('base64');
    return `${this.SERVICE_PREFIXES.USER}:search:${encodedQuery}`;
  }

  static userFriendRequests(id: string): string {
    return `${this.SERVICE_PREFIXES.USER}:friend_requests:${id}`;
  }

  static userMutualFriends(userId1: string, userId2: string): string {
    const sortedIds = [userId1, userId2].sort();
    return `${this.SERVICE_PREFIXES.USER}:mutual:${sortedIds[0]}:${sortedIds[1]}`;
  }

  // Post Service Keys
  static post(id: string): string {
    return `${this.SERVICE_PREFIXES.POST}:post:${id}`;
  }

  static postComments(id: string): string {
    return `${this.SERVICE_PREFIXES.POST}:comments:${id}`;
  }

  static postReactions(id: string): string {
    return `${this.SERVICE_PREFIXES.POST}:reactions:${id}`;
  }

  static userFeed(userId: string, page: number): string {
    return `${this.SERVICE_PREFIXES.POST}:feed:${userId}:page:${page}`;
  }

  static trendingPosts(): string {
    return `${this.SERVICE_PREFIXES.POST}:trending`;
  }

  static userPosts(userId: string, page: number): string {
    return `${this.SERVICE_PREFIXES.POST}:user:${userId}:page:${page}`;
  }

  // Message Service Keys
  static conversation(id: string): string {
    return `${this.SERVICE_PREFIXES.MESSAGE}:conversation:${id}`;
  }

  static conversationMessages(id: string, page: number): string {
    return `${this.SERVICE_PREFIXES.MESSAGE}:conversation:${id}:messages:page:${page}`;
  }

  static userConversations(userId: string): string {
    return `${this.SERVICE_PREFIXES.MESSAGE}:user:${userId}:conversations`;
  }

  static conversationParticipants(id: string): string {
    return `${this.SERVICE_PREFIXES.MESSAGE}:conversation:${id}:participants`;
  }

  // Media Service Keys
  static mediaFile(id: string): string {
    return `${this.SERVICE_PREFIXES.MEDIA}:file:${id}`;
  }

  static userMedia(userId: string, page: number): string {
    return `${this.SERVICE_PREFIXES.MEDIA}:user:${userId}:page:${page}`;
  }

  static mediaCollection(id: string): string {
    return `${this.SERVICE_PREFIXES.MEDIA}:collection:${id}`;
  }

  static mediaThumbnail(id: string): string {
    return `${this.SERVICE_PREFIXES.MEDIA}:thumbnail:${id}`;
  }

  // Notification Service Keys
  static userNotifications(userId: string): string {
    return `${this.SERVICE_PREFIXES.NOTIFICATION}:user:${userId}`;
  }

  static unreadCount(userId: string): string {
    return `${this.SERVICE_PREFIXES.NOTIFICATION}:unread:${userId}`;
  }

  static notificationPreferences(userId: string): string {
    return `${this.SERVICE_PREFIXES.NOTIFICATION}:preferences:${userId}`;
  }

  static notificationSettings(userId: string): string {
    return `${this.SERVICE_PREFIXES.NOTIFICATION}:settings:${userId}`;
  }

  // Search Service Keys
  static searchSuggestions(query: string): string {
    const encodedQuery = Buffer.from(query.toLowerCase()).toString('base64');
    return `${this.SERVICE_PREFIXES.SEARCH}:suggestions:${encodedQuery}`;
  }

  static searchResults(query: string, filters: string): string {
    const combined = query + filters;
    const encoded = Buffer.from(combined.toLowerCase()).toString('base64');
    return `${this.SERVICE_PREFIXES.SEARCH}:results:${encoded}`;
  }

  static trendingSearches(): string {
    return `${this.SERVICE_PREFIXES.SEARCH}:trending`;
  }

  static searchHistory(userId: string): string {
    return `${this.SERVICE_PREFIXES.SEARCH}:history:${userId}`;
  }

  // Global/Shared Keys
  static rateLimit(type: string, identifier: string): string {
    return `${this.SERVICE_PREFIXES.GLOBAL}:rate_limit:${type}:${identifier}`;
  }

  static lock(resource: string): string {
    return `${this.SERVICE_PREFIXES.GLOBAL}:lock:${resource}`;
  }

  static userOnlineStatus(userId: string): string {
    return `${this.SERVICE_PREFIXES.GLOBAL}:online:${userId}`;
  }

  static websocketConnections(): string {
    return `${this.SERVICE_PREFIXES.GLOBAL}:websocket:connections`;
  }

  static systemHealth(): string {
    return `${this.SERVICE_PREFIXES.GLOBAL}:health`;
  }

  static apiMetrics(): string {
    return `${this.SERVICE_PREFIXES.GLOBAL}:api_metrics`;
  }

  // Utility methods
  static getServicePrefix(service: string): string {
    return (
      this.SERVICE_PREFIXES[service.toUpperCase() as keyof typeof this.SERVICE_PREFIXES] ||
      'unknown'
    );
  }

  static getAllServicePrefixes(): string[] {
    return Object.values(this.SERVICE_PREFIXES);
  }

  static isValidKey(key: string): boolean {
    const prefixes = this.getAllServicePrefixes();
    return prefixes.some(prefix => key.startsWith(`${prefix}:`));
  }

  static extractServiceFromKey(key: string): string | null {
    const prefixes = this.getAllServicePrefixes();
    for (const prefix of prefixes) {
      if (key.startsWith(`${prefix}:`)) {
        return prefix;
      }
    }
    return null;
  }

  static getPatternForService(service: string): string {
    const prefix = this.getServicePrefix(service);
    return `${prefix}:*`;
  }

  static getPatternForUser(userId: string): string {
    return `*:user:${userId}*`;
  }

  static getPatternForGlobal(): string {
    return `${this.SERVICE_PREFIXES.GLOBAL}:*`;
  }
}
