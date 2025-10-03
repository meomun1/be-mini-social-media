import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { createLogger, ApiResponseHelper } from '@shared/types';
import {
  UpdateProfileDto,
  UpdatePrivacyDto,
  SendFriendRequestDto,
  RespondFriendRequestDto,
  UserSearchDto,
  GetUserDto,
} from '../dto/UserDto';
import { UserError } from '../utils/UserError';

const logger = createLogger('user');

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // GET /api/v1/users/profile
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const profile = await this.userService.getUserProfile(userId);

      if (!profile) {
        ApiResponseHelper.notFound(res, 'User profile not found');
        return;
      }

      logger.info('User profile retrieved', { userId });
      ApiResponseHelper.success(res, profile);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to get user profile', { error: err.message, userId: req.user?.id });
      ApiResponseHelper.internalError(res, 'Failed to retrieve user profile');
    }
  }

  // PUT /api/v1/users/profile
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const updateData: UpdateProfileDto = req.body;
      const profile = await this.userService.updateUserProfile(userId, updateData);

      if (!profile) {
        ApiResponseHelper.notFound(res, 'User profile not found');
        return;
      }

      logger.info('User profile updated', { userId, updates: Object.keys(updateData) });
      ApiResponseHelper.success(res, profile);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to update user profile', { error: err.message, userId: req.user?.id });
      ApiResponseHelper.internalError(res, 'Failed to update user profile');
    }
  }

  // GET /api/v1/users/:id
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        ApiResponseHelper.error(res, 'VALIDATION_ERROR', 'User ID is required', 400);
        return;
      }
      const requestingUserId = req.user?.id;

      const profile = await this.userService.getUserById(id, requestingUserId);

      if (!profile) {
        ApiResponseHelper.notFound(res, 'User not found or profile is private');
        return;
      }

      logger.info('User retrieved by ID', { userId: id, requestingUserId });
      ApiResponseHelper.success(res, profile);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to get user by ID', { error: err.message, userId: req.params.id });
      ApiResponseHelper.internalError(res, 'Failed to retrieve user');
    }
  }

  // GET /api/v1/users/privacy
  async getPrivacySettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const settings = await this.userService.getPrivacySettings(userId);

      if (!settings) {
        ApiResponseHelper.notFound(res, 'Privacy settings not found');
        return;
      }

      logger.info('Privacy settings retrieved', { userId });
      ApiResponseHelper.success(res, settings);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to get privacy settings', { error: err.message, userId: req.user?.id });
      ApiResponseHelper.internalError(res, 'Failed to retrieve privacy settings');
    }
  }

  // PUT /api/v1/users/privacy
  async updatePrivacySettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const updateData: UpdatePrivacyDto = req.body;
      const settings = await this.userService.updatePrivacySettings(userId, updateData);

      if (!settings) {
        ApiResponseHelper.notFound(res, 'Privacy settings not found');
        return;
      }

      logger.info('Privacy settings updated', { userId, updates: Object.keys(updateData) });
      ApiResponseHelper.success(res, settings);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to update privacy settings', {
        error: err.message,
        userId: req.user?.id,
      });
      ApiResponseHelper.internalError(res, 'Failed to update privacy settings');
    }
  }

  // POST /api/v1/users/:id/friend
  async sendFriendRequest(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const id = req.params.id;
      if (!id) {
        ApiResponseHelper.error(res, 'VALIDATION_ERROR', 'User ID is required', 400);
        return;
      }

      const requestData: SendFriendRequestDto = {
        addressee_id: id,
        message: req.body.message,
      };

      const friendRequest = await this.userService.sendFriendRequest(userId, requestData);

      logger.info('Friend request sent', { requesterId: userId, addresseeId: id });
      ApiResponseHelper.success(res, friendRequest, 201);
    } catch (error) {
      const err = error as Error;

      if (error instanceof UserError) {
        const statusCode = this.getStatusCodeForUserError(error.code);
        ApiResponseHelper.error(res, error.code, error.message, statusCode);
        return;
      }

      logger.error('Failed to send friend request', {
        error: err.message,
        userId: req.user?.id,
        targetId: req.params.id,
      });
      ApiResponseHelper.internalError(res, 'Failed to send friend request');
    }
  }

  // DELETE /api/v1/users/:id/friend
  async removeFriend(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const id = req.params.id;
      if (!id) {
        ApiResponseHelper.error(res, 'VALIDATION_ERROR', 'User ID is required', 400);
        return;
      }

      const removed = await this.userService.removeFriend(userId, id);

      if (!removed) {
        ApiResponseHelper.notFound(res, 'Friendship not found');
        return;
      }

      logger.info('Friend removed', { userId, friendId: id });
      ApiResponseHelper.success(res, { message: 'Friend removed successfully' });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to remove friend', {
        error: err.message,
        userId: req.user?.id,
        friendId: req.params.id,
      });
      ApiResponseHelper.internalError(res, 'Failed to remove friend');
    }
  }

  // POST /api/v1/users/friend-requests/respond
  async respondToFriendRequest(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const requestData: RespondFriendRequestDto = req.body;
      const friendRequest = await this.userService.respondToFriendRequest(userId, requestData);

      if (!friendRequest) {
        ApiResponseHelper.notFound(res, 'Friend request not found');
        return;
      }

      logger.info('Friend request responded', {
        userId,
        requestId: requestData.request_id,
        action: requestData.action,
      });
      ApiResponseHelper.success(res, friendRequest);
    } catch (error) {
      const err = error as Error;

      if (error instanceof UserError) {
        const statusCode = this.getStatusCodeForUserError(error.code);
        ApiResponseHelper.error(res, error.code, error.message, statusCode);
        return;
      }

      logger.error('Failed to respond to friend request', {
        error: err.message,
        userId: req.user?.id,
      });
      ApiResponseHelper.internalError(res, 'Failed to respond to friend request');
    }
  }

  // GET /api/v1/users/friend-requests
  async getFriendRequests(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const type = (req.query.type as 'received' | 'sent') || 'received';
      const requests = await this.userService.getFriendRequests(userId, type);

      logger.info('Friend requests retrieved', { userId, type });
      ApiResponseHelper.success(res, requests);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to get friend requests', { error: err.message, userId: req.user?.id });
      ApiResponseHelper.internalError(res, 'Failed to retrieve friend requests');
    }
  }

  // GET /api/v1/users/friends
  async getFriends(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const friends = await this.userService.getFriends(userId);

      logger.info('Friends retrieved', { userId, count: friends.length });
      ApiResponseHelper.success(res, friends);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to get friends', { error: err.message, userId: req.user?.id });
      ApiResponseHelper.internalError(res, 'Failed to retrieve friends');
    }
  }

  // GET /api/v1/users/search
  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponseHelper.unauthorized(res, 'User not authenticated');
        return;
      }

      const searchData: UserSearchDto = {
        query: req.query.q as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      if (!searchData.query) {
        ApiResponseHelper.error(res, 'VALIDATION_ERROR', 'Query parameter is required', 400);
        return;
      }

      const results = await this.userService.searchUsers(
        searchData.query,
        userId,
        searchData.limit,
        searchData.offset
      );

      logger.info('User search performed', {
        userId,
        query: searchData.query,
        resultCount: results.length,
      });
      ApiResponseHelper.success(res, results);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to search users', { error: err.message, userId: req.user?.id });
      ApiResponseHelper.internalError(res, 'Failed to search users');
    }
  }

  // Helper method to map user error codes to HTTP status codes
  private getStatusCodeForUserError(errorCode: string): number {
    switch (errorCode) {
      case 'USER_NOT_FOUND':
      case 'PROFILE_NOT_FOUND':
        return 404;
      case 'FRIEND_REQUEST_EXISTS':
      case 'ALREADY_FRIENDS':
        return 409;
      case 'CANNOT_FRIEND_SELF':
      case 'INVALID_PRIVACY_SETTING':
        return 400;
      case 'BLOCKED_USER':
      case 'PRIVACY_RESTRICTED':
        return 403;
      default:
        return 400;
    }
  }
}
