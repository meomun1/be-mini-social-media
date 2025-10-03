import { UserService } from '../../services/UserService';
import { UserRepository } from '../../repositories/UserRepository';
import { UserCacheService } from '../../services/UserCacheService';
import { UserError } from '../../utils/UserError';

// Mock dependencies
jest.mock('../../repositories/UserRepository');
jest.mock('../../services/UserCacheService');
jest.mock('@shared/types', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  ApiResponseHelper: {
    success: jest.fn(),
    error: jest.fn(),
    unauthorized: jest.fn(),
    notFound: jest.fn(),
    conflict: jest.fn(),
    validationError: jest.fn(),
    serverError: jest.fn(),
  },
}));

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockCacheService: jest.Mocked<UserCacheService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    mockCacheService = new UserCacheService() as jest.Mocked<UserCacheService>;

    userService = new UserService();
    (userService as any).userRepository = mockUserRepository;
    (userService as any).cacheService = mockCacheService;
  });

  describe('getUserProfile', () => {
    it('should return cached profile when available', async () => {
      const userId = 'test-user-id';
      const mockProfile = {
        id: 'profile-id',
        user_id: userId,
        first_name: 'John',
        last_name: 'Doe',
        bio: 'Test bio',
        is_public: true,
        status: 'offline' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCacheService.getUserProfile.mockResolvedValue(mockProfile);

      const result = await userService.getUserProfile(userId);

      expect(result).toEqual(mockProfile);
      expect(mockCacheService.getUserProfile).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.getUserProfile).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when cache miss', async () => {
      const userId = 'test-user-id';
      const mockProfile = {
        id: 'profile-id',
        user_id: userId,
        first_name: 'John',
        last_name: 'Doe',
        bio: 'Test bio',
        is_public: true,
        status: 'offline' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCacheService.getUserProfile.mockResolvedValue(null);
      mockUserRepository.getUserProfile.mockResolvedValue(mockProfile);
      mockCacheService.setUserProfile.mockResolvedValue(true);

      const result = await userService.getUserProfile(userId);

      expect(result).toEqual(mockProfile);
      expect(mockCacheService.getUserProfile).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.getUserProfile).toHaveBeenCalledWith(userId);
      expect(mockCacheService.setUserProfile).toHaveBeenCalledWith(userId, mockProfile);
    });

    it('should return null when profile not found', async () => {
      const userId = 'test-user-id';

      mockCacheService.getUserProfile.mockResolvedValue(null);
      mockUserRepository.getUserProfile.mockResolvedValue(null);

      const result = await userService.getUserProfile(userId);

      expect(result).toBeNull();
      expect(mockCacheService.getUserProfile).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.getUserProfile).toHaveBeenCalledWith(userId);
      expect(mockCacheService.setUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('sendFriendRequest', () => {
    it('should send friend request successfully', async () => {
      const userId = 'requester-id';
      const addresseeId = 'addressee-id';
      const requestData = {
        addressee_id: addresseeId,
        message: 'Hello!',
      };

      const mockFriendRequest = {
        id: 'request-id',
        requester_id: userId,
        addressee_id: addresseeId,
        status: 'pending' as const,
        message: 'Hello!',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.areFriends.mockResolvedValue(false);
      mockUserRepository.getUserFriendRequests.mockResolvedValue([]);
      mockUserRepository.createFriendRequest.mockResolvedValue(mockFriendRequest);

      const result = await userService.sendFriendRequest(userId, requestData);

      expect(result).toEqual(mockFriendRequest);
      expect(mockUserRepository.areFriends).toHaveBeenCalledWith(userId, addresseeId);
      expect(mockUserRepository.createFriendRequest).toHaveBeenCalledWith({
        ...requestData,
        requester_id: userId,
      });
    });

    it('should throw error if users are already friends', async () => {
      const userId = 'requester-id';
      const addresseeId = 'addressee-id';
      const requestData = {
        addressee_id: addresseeId,
        message: 'Hello!',
      };

      mockUserRepository.areFriends.mockResolvedValue(true);

      await expect(userService.sendFriendRequest(userId, requestData)).rejects.toThrow(UserError);

      expect(mockUserRepository.areFriends).toHaveBeenCalledWith(userId, addresseeId);
      expect(mockUserRepository.createFriendRequest).not.toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it('should return cached search results when available', async () => {
      const userId = 'searching-user';
      const query = 'john doe';
      const mockResults = [
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

      const cacheKey = `${query}:20:0`;
      mockCacheService.getSearchResults.mockResolvedValue(mockResults);

      const result = await userService.searchUsers(query, userId, 20, 0);

      expect(result).toEqual(mockResults);
      expect(mockCacheService.getSearchResults).toHaveBeenCalledWith(cacheKey);
      expect(mockUserRepository.searchUsers).not.toHaveBeenCalled();
    });

    it('should search database and cache when cache miss', async () => {
      const userId = 'searching-user';
      const query = 'john doe';
      const mockDbResults = [
        {
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          is_public: true,
          is_friend: false,
          friend_request_status: 'none',
        },
      ];
      const expectedResults = [
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

      const cacheKey = `${query}:20:0`;
      mockCacheService.getSearchResults.mockResolvedValue(null);
      mockUserRepository.searchUsers.mockResolvedValue(mockDbResults);
      mockCacheService.setSearchResults.mockResolvedValue(true);

      const result = await userService.searchUsers(query, userId, 20, 0);

      expect(result).toEqual(expectedResults);
      expect(mockCacheService.getSearchResults).toHaveBeenCalledWith(cacheKey);
      expect(mockUserRepository.searchUsers).toHaveBeenCalledWith(query, userId, 20, 0);
      expect(mockCacheService.setSearchResults).toHaveBeenCalledWith(cacheKey, expectedResults);
    });
  });
});
