# TypeScript Backend Development Guide

## 🎯 Overview

TypeScript is our primary programming language for the backend development. It provides static typing, better IDE support, and helps catch errors at compile time, making our codebase more maintainable and scalable.

## 🏗️ Project Structure

```
src/
├── shared/                 # Shared utilities and types
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── constants/         # Application constants
│   ├── validators/        # Input validation schemas
│   └── middleware/        # Express middleware
├── services/              # Microservices
│   ├── auth-service/
│   ├── user-service/
│   ├── post-service/
│   ├── message-service/
│   ├── media-service/
│   ├── search-service/
│   └── notification-service/
├── gateway/               # API Gateway
├── infrastructure/        # Infrastructure code
│   ├── database/         # Database connections
│   ├── redis/            # Redis client
│   ├── elasticsearch/    # Elasticsearch client
│   └── rabbitmq/         # Message broker
└── tests/                # Test files
```

## 📦 Package Configuration

### package.json
```json
{
  "name": "mini-facebook-backend",
  "version": "1.0.0",
  "description": "Mini Facebook Backend API",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "morgan": "^1.10.0",
    "dotenv": "^16.3.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "joi": "^17.11.0",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "elasticsearch": "^16.7.3",
    "amqplib": "^0.10.3",
    "multer": "^1.4.5-lts.1",
    "socket.io": "^4.7.4",
    "winston": "^3.11.0",
    "uuid": "^9.0.1",
    "nodemailer": "^6.9.7"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/compression": "^1.7.5",
    "@types/morgan": "^1.9.9",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/pg": "^8.10.9",
    "@types/multer": "^1.4.11",
    "@types/uuid": "^9.0.7",
    "@types/nodemailer": "^6.4.14",
    "typescript": "^5.3.2",
    "ts-node": "^10.9.1",
    "ts-node-dev": "^2.0.0",
    "@typescript-eslint/eslint-plugin": "^6.13.1",
    "@typescript-eslint/parser": "^6.13.1",
    "eslint": "^8.54.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "@types/supertest": "^2.0.16"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/shared/*": ["shared/*"],
      "@/services/*": ["services/*"],
      "@/infrastructure/*": ["infrastructure/*"]
    }
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
```

## 🎨 Type Definitions

### Core Types
```typescript
// shared/types/common.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
  message?: string;
  timestamp: string;
  requestId: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  coverPhoto?: string;
  bio?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  phoneNumber?: string;
  location?: string;
  website?: string;
  isVerified: boolean;
  isActive: boolean;
  privacySettings: PrivacySettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  emailVisibility: 'public' | 'friends' | 'private';
  phoneVisibility: 'public' | 'friends' | 'private';
  searchVisibility: 'public' | 'friends' | 'private';
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  location?: string;
  privacyLevel: 'public' | 'friends' | 'custom';
  tags: string[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  parentCommentId?: string;
  content: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reaction {
  id: string;
  userId: string;
  postId?: string;
  commentId?: string;
  type: 'like' | 'love' | 'laugh' | 'angry' | 'sad';
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId?: string;
  content: string;
  messageType: 'text' | 'image' | 'video' | 'file';
  mediaUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'friend_request' | 'like' | 'comment' | 'mention' | 'message';
  title: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}
```

### Service Types
```typescript
// shared/types/services.ts
export interface AuthService {
  register(userData: RegisterRequest): Promise<AuthResponse>;
  login(credentials: LoginRequest): Promise<AuthResponse>;
  logout(token: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<AuthResponse>;
  validateToken(token: string): Promise<UserPayload>;
}

export interface UserService {
  createProfile(userData: CreateProfileRequest): Promise<User>;
  getProfile(userId: string): Promise<User>;
  updateProfile(userId: string, updates: UpdateProfileRequest): Promise<User>;
  searchUsers(query: string, filters: SearchFilters): Promise<PaginatedResponse<User>>;
  sendFriendRequest(fromUserId: string, toUserId: string): Promise<Friendship>;
  getFriends(userId: string, pagination: PaginationParams): Promise<PaginatedResponse<User>>;
}

export interface PostService {
  createPost(userId: string, postData: CreatePostRequest): Promise<Post>;
  getPost(postId: string): Promise<Post>;
  updatePost(postId: string, userId: string, updates: UpdatePostRequest): Promise<Post>;
  deletePost(postId: string, userId: string): Promise<void>;
  getFeed(userId: string, pagination: PaginationParams): Promise<PaginatedResponse<Post>>;
  addComment(postId: string, userId: string, comment: CreateCommentRequest): Promise<Comment>;
  addReaction(postId: string, userId: string, reactionType: string): Promise<Reaction>;
}

export interface MessageService {
  createConversation(participants: string[]): Promise<Conversation>;
  getConversations(userId: string, pagination: PaginationParams): Promise<PaginatedResponse<Conversation>>;
  sendMessage(conversationId: string, senderId: string, message: SendMessageRequest): Promise<Message>;
  getMessages(conversationId: string, pagination: PaginationParams): Promise<PaginatedResponse<Message>>;
  markAsRead(messageId: string, userId: string): Promise<void>;
}
```

## 🛠️ Express Application Setup

### Main Application
```typescript
// gateway/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { errorHandler } from '@/shared/middleware/errorHandler';
import { requestId } from '@/shared/middleware/requestId';
import { rateLimiter } from '@/shared/middleware/rateLimiter';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { postRoutes } from './routes/posts';
import { messageRoutes } from './routes/messages';
import { mediaRoutes } from './routes/media';
import { searchRoutes } from './routes/search';
import { notificationRoutes } from './routes/notifications';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Request processing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));
app.use(requestId);
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    },
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id']
  });
});

export default app;
```

### Server Entry Point
```typescript
// gateway/server.ts
import app from './app';
import { logger } from '@/shared/utils/logger';
import { connectDatabase } from '@/infrastructure/database/connection';
import { connectRedis } from '@/infrastructure/redis/connection';
import { connectElasticsearch } from '@/infrastructure/elasticsearch/connection';
import { connectRabbitMQ } from '@/infrastructure/rabbitmq/connection';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to external services
    await connectDatabase();
    await connectRedis();
    await connectElasticsearch();
    await connectRabbitMQ();

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();
```

## 🔧 Middleware Examples

### Authentication Middleware
```typescript
// shared/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserPayload } from '@/shared/types/auth';

interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }
};
```

### Validation Middleware
```typescript
// shared/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
      return;
    }
    
    next();
  };
};
```

## 🧪 Testing Setup

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
};
```

### Test Example
```typescript
// tests/services/auth.test.ts
import request from 'supertest';
import app from '@/gateway/app';
import { connectDatabase } from '@/infrastructure/database/connection';

describe('Auth Service', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: '1990-01-01'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBeDefined();
      expect(response.body.data.email).toBe(userData.email);
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        email: 'invalid-email',
        username: 'ab', // too short
        password: 'weak' // too weak
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

## 📝 ESLint Configuration

### .eslintrc.js
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
  },
  env: {
    node: true,
    es6: true,
    jest: true,
  },
};
```

## 🚀 Development Workflow

### Scripts for Development
```bash
# Install dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check

# Run all checks
npm run check  # (combines lint, type-check, and test)
```

### Environment Variables
```bash
# .env.example
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/minifacebook
DB_POOL_SIZE=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRES_IN=30d

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,video/mp4

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## 🎯 Best Practices

### Code Organization
1. **Single Responsibility**: Each module should have one responsibility
2. **Dependency Injection**: Use interfaces for better testability
3. **Error Handling**: Consistent error handling across all services
4. **Logging**: Structured logging with appropriate levels
5. **Type Safety**: Leverage TypeScript's type system fully

### Performance
1. **Connection Pooling**: Use connection pools for database and Redis
2. **Caching**: Implement intelligent caching strategies
3. **Async/Await**: Use async/await consistently
4. **Streaming**: Use streams for large data processing
5. **Compression**: Enable gzip compression for responses

### Security
1. **Input Validation**: Validate all inputs using Joi schemas
2. **Authentication**: Implement proper JWT token handling
3. **Authorization**: Check permissions for all protected routes
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **CORS**: Configure CORS properly for production

This TypeScript backend setup provides a robust foundation for building our mini Facebook backend with type safety, proper error handling, and scalable architecture.
