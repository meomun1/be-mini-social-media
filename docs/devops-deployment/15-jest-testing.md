# Jest Testing Framework

## 🧪 Overview

Jest provides comprehensive testing capabilities for our mini Facebook backend, including unit tests, integration tests, and end-to-end testing with mocking, coverage reporting, and performance testing.

## 🏗️ Jest Configuration

### Jest Setup
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/types/**',
    '!src/**/migrations/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ]
};
```

### Test Setup File (per service)
```typescript
// tests/setup.ts (example: user-service)
import { connectDatabase } from '@/infrastructure/database/connection';
import { connectRedis } from '@/infrastructure/redis/connection';
import { connectElasticsearch } from '@/infrastructure/elasticsearch/connection';
import { connectRabbitMQ } from '@/infrastructure/rabbitmq/connection';

beforeAll(async () => {
  // Setup test database (target the service DB)
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/user_service_db_test';
  await connectDatabase();
  await connectRedis();
  await connectElasticsearch();
  await connectRabbitMQ();
});

afterAll(async () => {
  // Cleanup connections
  process.exit(0);
});

beforeEach(async () => {
  // Clean up test data before each test
  await cleanupTestData();
});

afterEach(async () => {
  // Clean up after each test
  jest.clearAllMocks();
});

async function cleanupTestData(): Promise<void> {
  // Implementation for cleaning up test data
  // This would typically truncate test tables
}
```

## 🧪 Unit Testing

### Service Tests
```typescript
// tests/services/userService.test.ts
import { UserService } from '@/services/user-service/userService';
import { userRepository } from '@/infrastructure/database/repositories/userRepository';
import { userCacheService } from '@/infrastructure/redis/userCacheService';
import { logger } from '@/shared/utils/logger';

// Mock dependencies
jest.mock('@/infrastructure/database/repositories/userRepository');
jest.mock('@/infrastructure/redis/userCacheService');
jest.mock('@/shared/utils/logger');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<typeof userRepository>;
  let mockUserCacheService: jest.Mocked<typeof userCacheService>;

  beforeEach(() => {
    userService = new UserService();
    mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
    mockUserCacheService = userCacheService as jest.Mocked<typeof userCacheService>;
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const expectedUser = {
        id: 'user-123',
        ...userData,
        isVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: userData.email,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName
        })
      );
      expect(mockUserCacheService.setUser).toHaveBeenCalledWith(expectedUser);
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        username: 'testuser',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      mockUserRepository.create.mockRejectedValue(new Error('Email already exists'));

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Email already exists');
      expect(mockUserRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserById', () => {
    it('should return user from cache if available', async () => {
      // Arrange
      const userId = 'user-123';
      const cachedUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      };

      mockUserCacheService.getUser.mockResolvedValue(cachedUser);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toEqual(cachedUser);
      expect(mockUserCacheService.getUser).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database if not in cache', async () => {
      // Arrange
      const userId = 'user-123';
      const dbUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      };

      mockUserCacheService.getUser.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(dbUser);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toEqual(dbUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserCacheService.setUser).toHaveBeenCalledWith(dbUser);
    });

    it('should return null if user not found', async () => {
      // Arrange
      const userId = 'non-existent-user';
      mockUserCacheService.getUser.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('searchUsers', () => {
    it('should search users with pagination', async () => {
      // Arrange
      const query = 'john';
      const limit = 10;
      const offset = 0;
      const expectedUsers = [
        {
          id: 'user-1',
          username: 'john_doe',
          firstName: 'John',
          lastName: 'Doe'
        },
        {
          id: 'user-2',
          username: 'johnny_smith',
          firstName: 'Johnny',
          lastName: 'Smith'
        }
      ];

      mockUserRepository.search.mockResolvedValue(expectedUsers);

      // Act
      const result = await userService.searchUsers(query, { limit, offset });

      // Assert
      expect(result).toEqual(expectedUsers);
      expect(mockUserRepository.search).toHaveBeenCalledWith(query, limit, offset);
    });
  });
});
```

### Repository Tests
```typescript
// tests/repositories/userRepository.test.ts
import { userRepository } from '@/infrastructure/database/repositories/userRepository';
import { db } from '@/infrastructure/database/connection';

describe('UserRepository', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  describe('create', () => {
    it('should create a new user', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        privacySettings: { profileVisibility: 'public' }
      };

      // Act
      const user = await userRepository.create(userData);

      // Assert
      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.isActive).toBe(true);
      expect(user.isVerified).toBe(false);
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const userData1 = {
        email: 'test@example.com',
        username: 'testuser1',
        passwordHash: 'hashedpassword1',
        firstName: 'Test1',
        lastName: 'User1'
      };

      const userData2 = {
        email: 'test@example.com',
        username: 'testuser2',
        passwordHash: 'hashedpassword2',
        firstName: 'Test2',
        lastName: 'User2'
      };

      // Act
      await userRepository.create(userData1);

      // Assert
      await expect(userRepository.create(userData2)).rejects.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User'
      };

      const createdUser = await userRepository.create(userData);

      // Act
      const foundUser = await userRepository.findByEmail(userData.email);

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.email).toBe(userData.email);
    });

    it('should return null for non-existent email', async () => {
      // Act
      const user = await userRepository.findByEmail('nonexistent@example.com');

      // Assert
      expect(user).toBeNull();
    });
  });
});
```

## 🔗 Integration Testing

### API Integration Tests
```typescript
// tests/integration/auth.test.ts
import request from 'supertest';
import app from '@/gateway/app';
import { userRepository } from '@/infrastructure/database/repositories/userRepository';
import { tokenService } from '@/infrastructure/auth/tokenService';
import bcrypt from 'bcryptjs';

describe('Auth API Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test data
    await userRepository.delete('test-user-id');
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: '1990-01-01'
      };

      // Act
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBeDefined();
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.username).toBe(userData.username);
      expect(response.body.data.isVerified).toBe(false);
    });

    it('should return validation error for invalid data', async () => {
      // Arrange
      const invalidData = {
        email: 'invalid-email',
        username: 'ab', // too short
        password: 'weak' // too weak
      };

      // Act
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toHaveLength(3);
    });

    it('should return error for duplicate email', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      // Create first user
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Act - Try to create user with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: await bcrypt.hash('SecurePassword123!', 10),
        firstName: 'Test',
        lastName: 'User',
        isVerified: true,
        isActive: true
      };

      await userRepository.create(userData);
    });

    it('should login successfully with valid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      // Act
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(loginData.email);
    });

    it('should return error for invalid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Act
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/users/profile', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create and login user
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: await bcrypt.hash('SecurePassword123!', 10),
        firstName: 'Test',
        lastName: 'User',
        isVerified: true,
        isActive: true
      };

      const user = await userRepository.create(userData);
      userId = user.id;

      const tokenPair = tokenService.generateTokenPair({
        id: user.id,
        email: user.email,
        username: user.username,
        role: 'user'
      });

      authToken = tokenPair.accessToken;
    });

    it('should return user profile with valid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(userId);
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.username).toBe('testuser');
    });

    it('should return error without authentication token', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/users/profile')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should return error with invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
```

## 🎭 Mocking and Test Utilities

### Mock Factories
```typescript
// tests/factories/userFactory.ts
import { User } from '@/shared/types/user';
import { v4 as uuidv4 } from 'uuid';

export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    return {
      id: uuidv4(),
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      profilePicture: null,
      coverPhoto: null,
      bio: null,
      dateOfBirth: null,
      gender: null,
      phoneNumber: null,
      location: null,
      website: null,
      isVerified: false,
      isActive: true,
      privacySettings: {
        profileVisibility: 'public',
        emailVisibility: 'friends',
        phoneVisibility: 'private'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

// tests/factories/postFactory.ts
import { Post } from '@/shared/types/post';
import { v4 as uuidv4 } from 'uuid';

export class PostFactory {
  static create(overrides: Partial<Post> = {}): Post {
    return {
      id: uuidv4(),
      userId: uuidv4(),
      content: 'Test post content',
      mediaUrls: [],
      location: null,
      privacyLevel: 'friends',
      tags: [],
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }
}
```

### Test Utilities
```typescript
// tests/utils/testHelpers.ts
import { Request, Response } from 'express';
import { tokenService } from '@/infrastructure/auth/tokenService';

export class TestHelpers {
  static createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: undefined,
      ...overrides
    };
  }

  static createMockResponse(): Partial<Response> {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  }

  static generateAuthToken(userId: string = 'test-user-id'): string {
    const tokenPair = tokenService.generateTokenPair({
      id: userId,
      email: 'test@example.com',
      username: 'testuser',
      role: 'user'
    });
    return tokenPair.accessToken;
  }

  static async waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static expectToBeValidUUID(value: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(value).toMatch(uuidRegex);
  }

  static expectToBeValidDate(value: string | Date): void {
    const date = new Date(value);
    expect(date).toBeInstanceOf(Date);
    expect(date.getTime()).not.toBeNaN();
  }
}
```

## 📊 Performance Testing

### Load Testing with Jest
```typescript
// tests/performance/load.test.ts
import request from 'supertest';
import app from '@/gateway/app';
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  describe('API Response Times', () => {
    it('should respond to health check within 100ms', async () => {
      // Arrange
      const startTime = performance.now();

      // Act
      await request(app).get('/health');

      // Assert
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle concurrent requests efficiently', async () => {
      // Arrange
      const concurrentRequests = 50;
      const promises: Promise<any>[] = [];

      // Act
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(request(app).get('/health'));
      }

      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentRequests;

      // Assert
      expect(averageTime).toBeLessThan(200); // Average response time should be less than 200ms
    });
  });

  describe('Database Performance', () => {
    it('should handle bulk user creation efficiently', async () => {
      // Arrange
      const userCount = 100;
      const users = Array.from({ length: userCount }, (_, i) => ({
        email: `test${i}@example.com`,
        username: `testuser${i}`,
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User'
      }));

      // Act
      const startTime = performance.now();
      
      const promises = users.map(user => userRepository.create(user));
      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / userCount;

      // Assert
      expect(averageTime).toBeLessThan(50); // Average creation time should be less than 50ms
    });
  });
});
```

## 📈 Coverage and Reporting

### Coverage Configuration
```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false",
    "test:integration": "jest --testPathPattern=integration",
    "test:unit": "jest --testPathPattern=unit"
  }
}
```

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html

# Generate coverage badge
npm install --save-dev jest-coverage-badges
```

This Jest testing setup provides comprehensive testing capabilities for our mini Facebook backend with proper mocking, integration testing, performance testing, and coverage reporting.
