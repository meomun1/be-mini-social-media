import { UserRepository } from '../repositories/UserRepository';
import { UserCacheService } from './UserCacheService';
import { createLogger } from '@shared/types';
import {
  UserProfile,
  PrivacySettings,
  FriendRequest,
  Friendship,
  UpdateProfileRequest,
  UpdatePrivacyRequest,
  SendFriendRequestRequest,
  RespondFriendRequestRequest,
  UserSearchResult,
} from '@shared/types';
import { UserError } from '../utils/UserError';

const logger = createLogger('user');

export class UserService {
  private userRepository: UserRepository;
  private cacheService: UserCacheService;

  constructor() {
    this.userRepository = new UserRepository();
    this.cacheService = new UserCacheService();
  }

  // User Profile Operations
  async createUserProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      logger.info('Creating user profile', { userId });

      const profile = await this.userRepository.createUserProfile(userId, profileData);

      // Cache the profile
      await this.cacheService.setUserProfile(userId, profile);

      // Create default privacy settings
      await this.userRepository.createPrivacySettings(userId, {});

      logger.info('User profile created successfully', { userId });
      return profile;
    } catch (error) {
      logger.error('Failed to create user profile', { userId, error: (error as Error).message });
      throw new Error('Failed to create user profile');
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Try cache first
      let profile = await this.cacheService.getUserProfile(userId);

      if (!profile) {
        // Cache miss - get from database
        profile = await this.userRepository.getUserProfile(userId);

        if (profile) {
          // Cache for next time
          await this.cacheService.setUserProfile(userId, profile);
        }
      }

      return profile;
    } catch (error) {
      logger.error('Failed to get user profile', { userId, error: (error as Error).message });
      throw new Error('Failed to get user profile');
    }
  }

  async updateUserProfile(
    userId: string,
    updates: UpdateProfileRequest
  ): Promise<UserProfile | null> {
    try {
      logger.info('Updating user profile', { userId, updates });

      const profile = await this.userRepository.updateUserProfile(userId, updates);

      if (profile) {
        // Invalidate cache
        await this.cacheService.invalidateUserProfile(userId);

        // Update cache with new data
        await this.cacheService.setUserProfile(userId, profile);

        logger.info('User profile updated successfully', { userId });
      }

      return profile;
    } catch (error) {
      logger.error('Failed to update user profile', { userId, error: (error as Error).message });
      throw new Error('Failed to update user profile');
    }
  }

  // Privacy Settings Operations
  async getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    try {
      // Try cache first
      let settings = await this.cacheService.getPrivacySettings(userId);

      if (!settings) {
        // Cache miss - get from database
        settings = await this.userRepository.getPrivacySettings(userId);

        if (settings) {
          // Cache for next time
          await this.cacheService.setPrivacySettings(userId, settings);
        }
      }

      return settings;
    } catch (error) {
      logger.error('Failed to get privacy settings', { userId, error: (error as Error).message });
      throw new Error('Failed to get privacy settings');
    }
  }

  async updatePrivacySettings(
    userId: string,
    updates: UpdatePrivacyRequest
  ): Promise<PrivacySettings | null> {
    try {
      logger.info('Updating privacy settings', { userId, updates });

      const settings = await this.userRepository.updatePrivacySettings(userId, updates);

      if (settings) {
        // Invalidate cache
        await this.cacheService.invalidatePrivacySettings(userId);

        // Update cache with new data
        await this.cacheService.setPrivacySettings(userId, settings);

        logger.info('Privacy settings updated successfully', { userId });
      }

      return settings;
    } catch (error) {
      logger.error('Failed to update privacy settings', {
        userId,
        error: (error as Error).message,
      });
      throw new Error('Failed to update privacy settings');
    }
  }

  // Friend Request Operations
  async sendFriendRequest(
    userId: string,
    requestData: SendFriendRequestRequest
  ): Promise<FriendRequest> {
    try {
      // Check if users are already friends
      const areFriends = await this.userRepository.areFriends(userId, requestData.addressee_id);
      if (areFriends) {
        throw new UserError('ALREADY_FRIENDS', 'Users are already friends');
      }

      // Check if friend request already exists
      const existingRequests = await this.userRepository.getUserFriendRequests(userId);
      const existingRequest = existingRequests.find(
        req =>
          (req.requester_id === userId && req.addressee_id === requestData.addressee_id) ||
          (req.requester_id === requestData.addressee_id && req.addressee_id === userId)
      );

      if (existingRequest) {
        throw new UserError('FRIEND_REQUEST_EXISTS', 'Friend request already exists');
      }

      logger.info('Sending friend request', {
        requesterId: userId,
        addresseeId: requestData.addressee_id,
      });

      const friendRequest = await this.userRepository.createFriendRequest({
        ...requestData,
        requester_id: userId,
      });

      logger.info('Friend request sent successfully', { requestId: friendRequest.id });
      return friendRequest;
    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      logger.error('Failed to send friend request', { userId, error: (error as Error).message });
      throw new Error('Failed to send friend request');
    }
  }

  async respondToFriendRequest(
    userId: string,
    requestData: RespondFriendRequestRequest
  ): Promise<FriendRequest | null> {
    try {
      logger.info('Responding to friend request', {
        userId,
        requestId: requestData.request_id,
        action: requestData.action,
      });

      // Get the friend request
      const friendRequest = await this.userRepository.getFriendRequest(requestData.request_id);

      if (!friendRequest) {
        throw new UserError('FRIEND_REQUEST_NOT_FOUND', 'Friend request not found');
      }

      if (friendRequest.addressee_id !== userId) {
        throw new UserError('FORBIDDEN', 'You can only respond to friend requests sent to you');
      }

      if (friendRequest.status !== 'pending') {
        throw new UserError('INVALID_REQUEST', 'Friend request has already been responded to');
      }

      const updatedRequest = await this.userRepository.respondToFriendRequest(
        requestData.request_id,
        requestData.action
      );

      // If accepted, create friendship
      if (requestData.action === 'accept') {
        await this.userRepository.createFriendship(
          friendRequest.requester_id,
          friendRequest.addressee_id
        );

        // Invalidate friend list caches for both users
        await this.cacheService.invalidateFriends(friendRequest.requester_id);
        await this.cacheService.invalidateFriends(friendRequest.addressee_id);
      }

      logger.info('Friend request responded successfully', {
        requestId: requestData.request_id,
        action: requestData.action,
      });
      return updatedRequest;
    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      logger.error('Failed to respond to friend request', {
        userId,
        error: (error as Error).message,
      });
      throw new Error('Failed to respond to friend request');
    }
  }

  async getFriendRequests(
    userId: string,
    type: 'received' | 'sent' = 'received'
  ): Promise<FriendRequest[]> {
    try {
      let requests: FriendRequest[];

      if (type === 'received') {
        requests = await this.userRepository.getUserFriendRequests(userId, 'pending');
      } else {
        requests = await this.userRepository.getSentFriendRequests(userId, 'pending');
      }

      return requests;
    } catch (error) {
      logger.error('Failed to get friend requests', {
        userId,
        type,
        error: (error as Error).message,
      });
      throw new Error('Failed to get friend requests');
    }
  }

  // Friendship Operations
  async getFriends(userId: string): Promise<Friendship[]> {
    try {
      // Try cache first - get friend IDs
      let friendIds = await this.cacheService.getFriends(userId);
      let friends: Friendship[] = [];

      if (friendIds && friendIds.length > 0) {
        // Cache hit - get full friendship objects from database using cached IDs
        friends = await this.userRepository.getFriendships(userId);
      } else {
        // Cache miss - get from database
        friends = await this.userRepository.getFriendships(userId);

        if (friends && friends.length > 0) {
          // Cache friend IDs for next time
          friendIds = friends.map(f => f.id);
          await this.cacheService.setFriends(userId, friendIds);
        }
      }

      return friends;
    } catch (error) {
      logger.error('Failed to get friends', { userId, error: (error as Error).message });
      throw new Error('Failed to get friends');
    }
  }

  async removeFriend(userId: string, friendId: string): Promise<boolean> {
    try {
      logger.info('Removing friend', { userId, friendId });

      const removed = await this.userRepository.removeFriendship(userId, friendId);

      if (removed) {
        // Invalidate friend list caches for both users
        await this.cacheService.invalidateFriends(userId);
        await this.cacheService.invalidateFriends(friendId);

        logger.info('Friend removed successfully', { userId, friendId });
      }

      return removed;
    } catch (error) {
      logger.error('Failed to remove friend', {
        userId,
        friendId,
        error: (error as Error).message,
      });
      throw new Error('Failed to remove friend');
    }
  }

  // Search Operations
  async searchUsers(
    query: string,
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<UserSearchResult[]> {
    try {
      if (!query.trim()) {
        return [];
      }

      // Try cache first
      const cacheKey = `${query}:${limit}:${offset}`;
      let results = await this.cacheService.getSearchResults(cacheKey);

      if (!results) {
        // Cache miss - get from database
        const searchResults = await this.userRepository.searchUsers(query, userId, limit, offset);
        results = searchResults.map(result => ({
          id: result.user_id,
          username: `${result.first_name} ${result.last_name}`.trim(),
          first_name: result.first_name,
          last_name: result.last_name,
          avatar_url: result.avatar_url,
          is_friend: result.is_friend,
          friend_request_status: result.friend_request_status as 'pending' | 'sent' | 'none',
          mutual_friends_count: 0, // TODO: Implement mutual friends count
        }));

        // Cache for next time
        await this.cacheService.setSearchResults(cacheKey, results);
      }

      return results;
    } catch (error) {
      logger.error('Failed to search users', { query, userId, error: (error as Error).message });
      throw new Error('Failed to search users');
    }
  }

  // Utility Methods
  async areFriends(userId: string, friendId: string): Promise<boolean> {
    try {
      return await this.userRepository.areFriends(userId, friendId);
    } catch (error) {
      logger.error('Failed to check friendship', {
        userId,
        friendId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async getUserById(userId: string, requestingUserId?: string): Promise<UserProfile | null> {
    try {
      const profile = await this.getUserProfile(userId);

      if (!profile) {
        return null;
      }

      // If requesting user is provided, check privacy settings
      if (requestingUserId && requestingUserId !== userId) {
        const privacySettings = await this.getPrivacySettings(userId);

        if (privacySettings?.profile_visibility === 'private') {
          return null; // Profile is private
        }

        if (privacySettings?.profile_visibility === 'friends') {
          const areFriends = await this.areFriends(userId, requestingUserId);
          if (!areFriends) {
            return null; // Profile is friends-only
          }
        }
      }

      return profile;
    } catch (error) {
      logger.error('Failed to get user by ID', {
        userId,
        requestingUserId,
        error: (error as Error).message,
      });
      throw new Error('Failed to get user by ID');
    }
  }
}
