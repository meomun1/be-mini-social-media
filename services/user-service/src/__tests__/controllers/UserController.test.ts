import { Request, Response } from 'express';
import { UserController } from '../../controllers/UserController';
import { UserService } from '../../services/UserService';
import { UserError } from '../../utils/UserError';

// Mock dependencies
jest.mock('../../services/UserService');
jest.mock('@shared/types', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  ApiResponseHelper: {
    success: jest.fn().mockImplementation((res, data, statusCode = 200) => {
      res.status(statusCode).json({ success: true, data });
    }),
    error: jest.fn().mockImplementation((res, code, message, statusCode = 400, details) => {
      res.status(statusCode).json({ success: false, error: { code, message, details } });
    }),
    unauthorized: jest.fn().mockImplementation((res, message = 'Unauthorized') => {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message } });
    }),
    notFound: jest.fn().mockImplementation((res, message = 'Resource not found') => {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message } });
    }),
    conflict: jest.fn().mockImplementation((res, message = 'Conflict') => {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message } });
    }),
    validationError: jest.fn().mockImplementation((res, message = 'Validation failed', details) => {
      res
        .status(422)
        .json({ success: false, error: { code: 'VALIDATION_ERROR', message, details } });
    }),
    internalError: jest.fn().mockImplementation((res, message = 'Internal server error') => {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
    }),
  },
}));

describe('UserController', () => {
  let userController: UserController;
  let mockUserService: jest.Mocked<UserService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserService = new UserService() as jest.Mocked<UserService>;
    userController = new UserController();
    (userController as any).userService = mockUserService;

    mockRequest = {
      user: { id: 'test-user-id', email: 'test@example.com', username: 'testuser' },
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      const mockProfile = {
        id: 'profile-id',
        user_id: 'test-user-id',
        first_name: 'John',
        last_name: 'Doe',
        bio: 'Test bio',
        is_public: true,
        status: 'offline' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserService.getUserProfile.mockResolvedValue(mockProfile);

      await userController.getProfile(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.getUserProfile).toHaveBeenCalledWith('test-user-id');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockProfile,
      });
    });

    it('should return 401 when user not authenticated', async () => {
      (mockRequest as any).user = undefined;

      await userController.getProfile(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.getUserProfile).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    });

    it('should return 404 when profile not found', async () => {
      mockUserService.getUserProfile.mockResolvedValue(null);

      await userController.getProfile(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.getUserProfile).toHaveBeenCalledWith('test-user-id');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User profile not found',
        },
      });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        first_name: 'Jane',
        last_name: 'Smith',
        bio: 'Updated bio',
      };

      const updatedProfile = {
        id: 'profile-id',
        user_id: 'test-user-id',
        first_name: 'Jane',
        last_name: 'Smith',
        bio: 'Updated bio',
        is_public: true,
        status: 'offline' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.body = updateData;
      mockUserService.updateUserProfile.mockResolvedValue(updatedProfile);

      await userController.updateProfile(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.updateUserProfile).toHaveBeenCalledWith('test-user-id', updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedProfile,
      });
    });
  });

  describe('sendFriendRequest', () => {
    it('should send friend request successfully', async () => {
      const friendRequest = {
        id: 'request-id',
        requester_id: 'test-user-id',
        addressee_id: 'friend-id',
        status: 'pending' as const,
        message: 'Hello!',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.params = { id: 'friend-id' };
      mockRequest.body = { message: 'Hello!' };
      mockUserService.sendFriendRequest.mockResolvedValue(friendRequest);

      await userController.sendFriendRequest(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.sendFriendRequest).toHaveBeenCalledWith('test-user-id', {
        addressee_id: 'friend-id',
        message: 'Hello!',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: friendRequest,
      });
    });

    it('should handle UserError and return appropriate status code', async () => {
      mockRequest.params = { id: 'friend-id' };
      mockRequest.body = {};
      mockUserService.sendFriendRequest.mockRejectedValue(
        new UserError('ALREADY_FRIENDS', 'Users are already friends')
      );

      await userController.sendFriendRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ALREADY_FRIENDS',
          message: 'Users are already friends',
        },
      });
    });
  });

  describe('searchUsers', () => {
    it('should search users successfully', async () => {
      const searchResults = [
        {
          id: 'user-1',
          username: 'John Doe',
          first_name: 'John',
          last_name: 'Doe',
          is_friend: false,
          friend_request_status: 'none' as const,
          mutual_friends_count: 0,
        },
      ];

      mockRequest.query = { q: 'john' };
      mockUserService.searchUsers.mockResolvedValue(searchResults);

      await userController.searchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.searchUsers).toHaveBeenCalledWith('john', 'test-user-id', 20, 0);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: searchResults,
      });
    });

    it('should return 400 when query parameter is missing', async () => {
      mockRequest.query = {};

      await userController.searchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.searchUsers).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter is required',
        },
      });
    });
  });
});
