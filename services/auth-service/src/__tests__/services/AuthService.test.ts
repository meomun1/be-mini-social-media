import { AuthService } from '../../services/AuthService';
import { UserRepository } from '../../repositories/UserRepository';
import { AuthError } from '../../utils/AuthError';

// Mock the UserRepository
jest.mock('../../repositories/UserRepository');
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('AuthService - Simple Unit Tests', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    authService = new AuthService();
    // Replace the repository with our mock
    (authService as any).userRepository = mockUserRepository;
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test123!@#',
      };

      const mockUser = {
        id: 'user-123',
        email: userData.email,
        username: userData.username,
        password_hash: 'hashed-password',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findUserByEmail.mockResolvedValue(null);
      mockUserRepository.findUserByUsername.mockResolvedValue(null);
      mockUserRepository.createUser.mockResolvedValue(mockUser);
      mockUserRepository.createRefreshToken.mockResolvedValue({
        id: 'token-123',
        user_id: 'user-123',
        token_hash: 'hashed-token',
        expires_at: new Date(),
        is_revoked: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(result.user.email).toBe(userData.email);
      expect(result.user.username).toBe(userData.username);
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(mockUserRepository.createUser).toHaveBeenCalledWith({
        email: userData.email,
        username: userData.username,
        password_hash: expect.any(String),
      });
    });

    it('should throw error if email already exists', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        username: 'newuser',
        password: 'Test123!@#',
      };

      mockUserRepository.findUserByEmail.mockResolvedValue({
        id: 'existing-user',
        email: userData.email,
        username: 'existinguser',
        password_hash: 'hash',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow(AuthError);
      await expect(authService.register(userData)).rejects.toThrow(
        'Email address is already registered'
      );
    });

    it('should throw error if username already exists', async () => {
      // Arrange
      const userData = {
        email: 'new@example.com',
        username: 'existinguser',
        password: 'Test123!@#',
      };

      mockUserRepository.findUserByEmail.mockResolvedValue(null);
      mockUserRepository.findUserByUsername.mockResolvedValue({
        id: 'existing-user',
        email: 'other@example.com',
        username: userData.username,
        password_hash: 'hash',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow(AuthError);
      await expect(authService.register(userData)).rejects.toThrow('Username is already taken');
    });
  });

  describe('login', () => {
    it('should login user successfully with valid credentials', async () => {
      // Arrange
      const credentials = {
        email: 'test@example.com',
        password: 'Test123!@#',
      };

      const mockUser = {
        id: 'user-123',
        email: credentials.email,
        username: 'testuser',
        password_hash: '$2b$12$hashedpassword', // bcrypt hash
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findUserByEmail.mockResolvedValue(mockUser);
      mockUserRepository.createSession.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
        token_hash: 'hashed-token',
        expires_at: new Date(),
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        created_at: new Date(),
        updated_at: new Date(),
      });
      mockUserRepository.createRefreshToken.mockResolvedValue({
        id: 'token-123',
        user_id: 'user-123',
        token_hash: 'hashed-token',
        expires_at: new Date(),
        is_revoked: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Mock bcrypt.compare to return true for valid password
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(result.user.email).toBe(credentials.email);
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(mockUserRepository.createSession).toHaveBeenCalled();
    });

    it('should throw error for invalid credentials', async () => {
      // Arrange
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      };

      mockUserRepository.findUserByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(credentials)).rejects.toThrow(AuthError);
      await expect(authService.login(credentials)).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for inactive user', async () => {
      // Arrange
      const credentials = {
        email: 'inactive@example.com',
        password: 'Test123!@#',
      };

      const mockUser = {
        id: 'user-123',
        email: credentials.email,
        username: 'inactiveuser',
        password_hash: '$2b$12$hashedpassword',
        is_active: false, // Inactive user
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findUserByEmail.mockResolvedValue(mockUser);

      // Mock bcrypt.compare to return true
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      // Act & Assert
      await expect(authService.login(credentials)).rejects.toThrow(AuthError);
      await expect(authService.login(credentials)).rejects.toThrow('Account is locked');
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      // Arrange
      const validToken = 'valid-access-token';
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        type: 'access',
        exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes from now
      };

      // Mock JWT verify
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

      // Act
      const result = await authService.validateToken(validToken);

      // Assert
      expect(result).toEqual(mockPayload);
    });

    it('should throw error for expired token', async () => {
      // Arrange
      const expiredToken = 'expired-token';

      // Mock JWT verify to throw TokenExpiredError
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      // Act & Assert
      await expect(authService.validateToken(expiredToken)).rejects.toThrow(AuthError);
      await expect(authService.validateToken(expiredToken)).rejects.toThrow('Token has expired');
    });

    it('should throw error for invalid token type', async () => {
      // Arrange
      const refreshToken = 'refresh-token';
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        type: 'refresh', // Wrong type
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      // Mock JWT verify
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

      // Act & Assert
      await expect(authService.validateToken(refreshToken)).rejects.toThrow(AuthError);
      await expect(authService.validateToken(refreshToken)).rejects.toThrow('Invalid token type');
    });
  });
});
