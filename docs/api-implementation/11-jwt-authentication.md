# JWT Authentication System

## 🔐 Overview

JWT (JSON Web Token) authentication provides secure, stateless authentication for our mini Facebook backend microservices, enabling user sessions, API access control, and cross-service authentication. Each service validates JWT tokens independently while maintaining service boundaries.

## 📂 Code Organization & File Structure

### **Where JWT Code Goes**

The JWT authentication code is distributed across multiple locations in our microservices architecture:

```
src/
├── shared/                    # Shared across ALL services
│   ├── middleware/
│   │   ├── auth.ts           # User authentication middleware
│   │   ├── serviceAuth.ts    # Service-to-service auth middleware
│   │   └── crossServiceAuth.ts # Cross-service validation
│   ├── services/
│   │   └── tokenValidationService.ts # Token validation client
│   └── types/
│       └── auth.ts           # JWT types and interfaces
├── services/
│   └── auth-service/         # Port 3100 - Auth Service
│       ├── src/
│       │   ├── infrastructure/
│       │   │   └── auth/
│       │   │       ├── tokenService.ts        # JWT generation/validation
│       │   │       ├── refreshTokenService.ts # Refresh token management
│       │   │       ├── tokenBlacklist.ts      # Token blacklisting
│       │   │       └── serviceTokenService.ts # Service tokens
│       │   ├── controllers/
│       │   │   └── authController.ts          # Auth API endpoints
│       │   ├── routes/
│       │   │   └── auth.ts                   # Auth routes
│       │   └── services/
│       │       └── authService.ts            # Business logic
│       └── database/          # auth_service_db
├── gateway/                  # Port 3000 - API Gateway
│   ├── middleware/
│   │   ├── auth.ts          # Centralized auth middleware
│   │   └── serviceProxy.ts  # Routes to microservices
│   └── routes/
│       └── auth.ts          # Auth routes (proxies to Auth Service)
└── services/
    ├── user-service/         # Uses JWT for protection
    │   └── src/
    │       ├── middleware/
    │       │   └── auth.ts   # Imports shared auth middleware
    │       └── controllers/
    │           └── userController.ts
    ├── post-service/         # Uses JWT for protection
    │   └── src/
    │       ├── middleware/
    │       │   └── auth.ts   # Imports shared auth middleware
    │       └── controllers/
    │           └── postController.ts
    └── ... (other services)
```

### **JWT: API vs Infrastructure**

JWT authentication is **BOTH API and Infrastructure**:

#### **🔌 API Endpoints (REST APIs)**
```typescript
// These are REST API endpoints in Auth Service:
POST /api/v1/auth/login        // Login API
POST /api/v1/auth/register     // Register API  
POST /api/v1/auth/refresh      // Refresh token API
POST /api/v1/auth/logout       // Logout API
POST /api/v1/auth/validate     // Token validation API (internal)
GET  /api/v1/auth/users/{id}   // Get user by ID API (internal)
```

#### **🛡️ Infrastructure Components**
```typescript
// These are NOT APIs - they're middleware/functions:
- Token generation/validation logic
- Authentication middleware
- Service-to-service authentication
- Token blacklisting
- Cross-service token validation
```

## 🏗️ JWT Implementation

### Token Service
```typescript
// infrastructure/auth/tokenService.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserPayload, TokenPair } from '@/shared/types/auth';
import { logger } from '@/shared/utils/logger';

export class TokenService {
  private readonly ACCESS_TOKEN_SECRET = process.env.JWT_SECRET!;
  private readonly REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;
  private readonly ACCESS_TOKEN_EXPIRES_IN = '15m';
  private readonly REFRESH_TOKEN_EXPIRES_IN = '7d';

  generateTokenPair(user: {
    id: string;
    email: string;
    username: string;
    role: string;
  }): TokenPair {
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = jwt.sign(payload, this.ACCESS_TOKEN_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'mini-facebook-api',
      audience: 'mini-facebook-client'
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      this.REFRESH_TOKEN_SECRET,
      {
        expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
        issuer: 'mini-facebook-api',
        audience: 'mini-facebook-client'
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresIn(this.ACCESS_TOKEN_EXPIRES_IN)
    };
  }

  verifyAccessToken(token: string): UserPayload {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        issuer: 'mini-facebook-api',
        audience: 'mini-facebook-client'
      }) as UserPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('ACCESS_TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('INVALID_ACCESS_TOKEN');
      }
      throw new Error('TOKEN_VERIFICATION_FAILED');
    }
  }

  verifyRefreshToken(token: string): { id: string; type: string } {
    try {
      const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: 'mini-facebook-api',
        audience: 'mini-facebook-client'
      }) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('INVALID_REFRESH_TOKEN_TYPE');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }
      throw new Error('REFRESH_TOKEN_VERIFICATION_FAILED');
    }
  }

  generatePasswordResetToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'password_reset' },
      this.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );
  }

  verifyPasswordResetToken(token: string): { userId: string; type: string } {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET) as any;
      
      if (decoded.type !== 'password_reset') {
        throw new Error('INVALID_TOKEN_TYPE');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('RESET_TOKEN_EXPIRED');
      }
      throw new Error('INVALID_RESET_TOKEN');
    }
  }

  generateEmailVerificationToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email, type: 'email_verification' },
      this.ACCESS_TOKEN_SECRET,
      { expiresIn: '24h' }
    );
  }

  verifyEmailVerificationToken(token: string): { userId: string; email: string; type: string } {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET) as any;
      
      if (decoded.type !== 'email_verification') {
        throw new Error('INVALID_TOKEN_TYPE');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('VERIFICATION_TOKEN_EXPIRED');
      }
      throw new Error('INVALID_VERIFICATION_TOKEN');
    }
  }

  private parseExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value * 1000;
    }
  }
}

export const tokenService = new TokenService();
```

### Authentication Middleware
```typescript
// shared/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { tokenService } from '@/infrastructure/auth/tokenService';
import { logger } from '@/shared/utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token required'
        }
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = tokenService.verifyAccessToken(token);
    
    req.user = user;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'TOKEN_VERIFICATION_FAILED';
    
    logger.warn('Authentication failed', {
      error: errorMessage,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    let statusCode = 401;
    let code = 'INVALID_TOKEN';

    if (errorMessage === 'ACCESS_TOKEN_EXPIRED') {
      code = 'TOKEN_EXPIRED';
    } else if (errorMessage === 'INVALID_ACCESS_TOKEN') {
      code = 'INVALID_TOKEN';
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: getErrorMessage(code)
      }
    });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = tokenService.verifyAccessToken(token);
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions'
        }
      });
      return;
    }

    next();
  };
};

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    MISSING_TOKEN: 'Authorization token is required',
    INVALID_TOKEN: 'Invalid or malformed token',
    TOKEN_EXPIRED: 'Token has expired',
    AUTHENTICATION_REQUIRED: 'Authentication is required',
    INSUFFICIENT_PERMISSIONS: 'You do not have permission to access this resource'
  };

  return messages[code] || 'Authentication failed';
}
```

### Refresh Token Management
```typescript
// infrastructure/auth/refreshTokenService.ts
import { tokenService } from './tokenService';
import { refreshTokenRepository } from '@/infrastructure/database/repositories/refreshTokenRepository';
import { logger } from '@/shared/utils/logger';
import crypto from 'crypto';

export class RefreshTokenService {
  async createRefreshToken(userId: string, tokenPair: any): Promise<string> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(tokenPair.refreshToken)
      .digest('hex');

    await refreshTokenRepository.create({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isRevoked: false
    });

    return tokenPair.refreshToken;
  }

  async refreshAccessToken(refreshToken: string): Promise<any> {
    // Verify refresh token
    const decoded = tokenService.verifyRefreshToken(refreshToken);
    
    // Check if token exists and is not revoked
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const storedToken = await refreshTokenRepository.findByHash(tokenHash);
    
    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    // Get user data
    const user = await userRepository.findById(decoded.id);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Generate new token pair
    const newTokenPair = tokenService.generateTokenPair({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    });

    // Revoke old refresh token
    await refreshTokenRepository.revoke(tokenHash);

    // Create new refresh token
    await this.createRefreshToken(user.id, newTokenPair);

    return newTokenPair;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await refreshTokenRepository.revoke(tokenHash);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await refreshTokenRepository.revokeAllForUser(userId);
  }
}

export const refreshTokenService = new RefreshTokenService();
```

## 🔒 Security Features

### Token Blacklist
```typescript
// infrastructure/auth/tokenBlacklist.ts
import { cacheService } from '@/infrastructure/redis/cacheService';
import { logger } from '@/shared/utils/logger';

export class TokenBlacklist {
  private readonly BLACKLIST_TTL = 15 * 60; // 15 minutes

  async blacklistToken(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await cacheService.set(`blacklist:${tokenHash}`, true, this.BLACKLIST_TTL);
    
    logger.info('Token blacklisted', { tokenHash });
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    return await cacheService.exists(`blacklist:${tokenHash}`);
  }

  private hashToken(token: string): string {
    return require('crypto')
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }
}

export const tokenBlacklist = new TokenBlacklist();
```

### Rate Limiting for Auth Endpoints
```typescript
// infrastructure/auth/authRateLimiter.ts
import { rateLimiter } from '@/infrastructure/redis/rateLimiter';
import { Request, Response, NextFunction } from 'express';

export const authRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const identifier = req.ip;
  const config = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts'
  };

  const result = await rateLimiter.checkLimit(identifier, 'auth', config);

  if (!result.allowed) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: config.message
      },
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    });
    return;
  }

  res.set({
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
  });

  next();
};
```

## 🔄 Service-to-Service Authentication

### Service Authentication Middleware
```typescript
// shared/middleware/serviceAuth.ts
import { Request, Response, NextFunction } from 'express';
import { tokenService } from '@/infrastructure/auth/tokenService';
import { logger } from '@/shared/utils/logger';

interface ServiceRequest extends Request {
  service?: {
    serviceId: string;
    permissions: string[];
  };
}

export const authenticateService = async (
  req: ServiceRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_SERVICE_TOKEN',
          message: 'Service authentication token required'
        }
      });
      return;
    }

    const token = authHeader.substring(7);
    const servicePayload = tokenService.verifyServiceToken(token);
    
    req.service = servicePayload;
    next();
  } catch (error) {
    logger.warn('Service authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      service: req.headers['x-service-id']
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SERVICE_TOKEN',
        message: 'Invalid or expired service token'
      }
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: ServiceRequest, res: Response, next: NextFunction): void => {
    if (!req.service) {
      res.status(401).json({
        success: false,
        error: {
          code: 'SERVICE_AUTHENTICATION_REQUIRED',
          message: 'Service authentication required'
        }
      });
      return;
    }

    if (!req.service.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SERVICE_PERMISSIONS',
          message: `Permission '${permission}' required`
        }
      });
      return;
    }

    next();
  };
};
```

### Service Token Generation
```typescript
// infrastructure/auth/serviceTokenService.ts
import jwt from 'jsonwebtoken';
import { logger } from '@/shared/utils/logger';

export class ServiceTokenService {
  private readonly SERVICE_TOKEN_SECRET = process.env.SERVICE_TOKEN_SECRET!;
  private readonly SERVICE_TOKEN_EXPIRES_IN = '1h';

  generateServiceToken(serviceId: string, permissions: string[]): string {
    const payload = {
      serviceId,
      permissions,
      type: 'service',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.SERVICE_TOKEN_SECRET, {
      expiresIn: this.SERVICE_TOKEN_EXPIRES_IN,
      issuer: 'mini-facebook-api',
      audience: 'mini-facebook-services'
    });
  }

  verifyServiceToken(token: string): { serviceId: string; permissions: string[] } {
    try {
      const decoded = jwt.verify(token, this.SERVICE_TOKEN_SECRET, {
        issuer: 'mini-facebook-api',
        audience: 'mini-facebook-services'
      }) as any;

      if (decoded.type !== 'service') {
        throw new Error('INVALID_TOKEN_TYPE');
      }

      return {
        serviceId: decoded.serviceId,
        permissions: decoded.permissions
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('SERVICE_TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('INVALID_SERVICE_TOKEN');
      }
      throw new Error('SERVICE_TOKEN_VERIFICATION_FAILED');
    }
  }
}

export const serviceTokenService = new ServiceTokenService();
```

## 🎯 Authentication Routes

### Auth Service Controller
```typescript
// services/auth-service/controllers/authController.ts
import { Request, Response } from 'express';
import { tokenService } from '@/infrastructure/auth/tokenService';
import { refreshTokenService } from '@/infrastructure/auth/refreshTokenService';
import { tokenBlacklist } from '@/infrastructure/auth/tokenBlacklist';
import { authRateLimiter } from '@/infrastructure/auth/authRateLimiter';
import { userRepository } from '@/infrastructure/database/repositories/userRepository';
import { eventPublisher } from '@/infrastructure/rabbitmq/eventPublisher';
import { logger } from '@/shared/utils/logger';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, rememberMe } = req.body;

      // Validate user credentials
      const user = await userRepository.findByEmail(email);
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
        return;
      }

      // Generate tokens
      const tokenPair = tokenService.generateTokenPair({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      });

      // Create refresh token
      const refreshToken = await refreshTokenService.createRefreshToken(
        user.id,
        tokenPair
      );

      res.json({
        success: true,
        data: {
          accessToken: tokenPair.accessToken,
          refreshToken,
          expiresIn: tokenPair.expiresIn,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePicture: user.profilePicture,
            isVerified: user.isVerified
          }
        }
      });

      // Publish user login event
      await eventPublisher.publish('user.login', {
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString()
      });

      logger.info('User logged in successfully', { userId: user.id });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'Login failed. Please try again.'
        }
      });
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_REQUIRED',
            message: 'Refresh token is required'
          }
        });
        return;
      }

      const newTokenPair = await refreshTokenService.refreshAccessToken(refreshToken);

      res.json({
        success: true,
        data: {
          accessToken: newTokenPair.accessToken,
          refreshToken: newTokenPair.refreshToken,
          expiresIn: newTokenPair.expiresIn
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'REFRESH_FAILED';
      
      if (errorMessage === 'INVALID_REFRESH_TOKEN') {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token'
          }
        });
        return;
      }

      logger.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: 'Token refresh failed'
        }
      });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const refreshToken = req.body.refreshToken;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const accessToken = authHeader.substring(7);
        await tokenBlacklist.blacklistToken(accessToken);
      }

      if (refreshToken) {
        await refreshTokenService.revokeRefreshToken(refreshToken);
      }

      // Publish user logout event
      await eventPublisher.publish('user.logout', {
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Logout failed'
        }
      });
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, username, password, firstName, lastName, dateOfBirth } = req.body;

      // Check if user already exists
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        res.status(409).json({
          success: false,
          error: {
            code: 'USER_ALREADY_EXISTS',
            message: 'User with this email already exists'
          }
        });
        return;
      }

      // Create user in Auth Service database
      const user = await userRepository.create({
        email,
        username,
        passwordHash: await bcrypt.hash(password, 12),
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        isVerified: false,
        isActive: true
      });

      // Generate tokens
      const tokenPair = tokenService.generateTokenPair({
        id: user.id,
        email: user.email,
        username: user.username,
        role: 'user'
      });

      // Create refresh token
      const refreshToken = await refreshTokenService.createRefreshToken(
        user.id,
        tokenPair
      );

      // Publish user registered event for other services
      await eventPublisher.publish('user.registered', {
        userId: user.id,
        email: user.email,
        username: user.username,
        firstName,
        lastName,
        timestamp: new Date().toISOString()
      });

      res.status(201).json({
        success: true,
        data: {
          accessToken: tokenPair.accessToken,
          refreshToken,
          expiresIn: tokenPair.expiresIn,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName,
            lastName,
            isVerified: user.isVerified
          }
        },
        message: 'User registered successfully'
      });

      logger.info('User registered successfully', { userId: user.id });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'Registration failed. Please try again.'
        }
      });
    }
  }
}

export const authController = new AuthController();
```

## 🔄 How JWT Works in Practice

### **API Flow Example: User Creates a Post**

1. **Client Request**
```typescript
// Client sends request with JWT
POST /api/v1/posts
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "content": "Hello world!"
}
```

2. **API Gateway**
```typescript
// src/gateway/middleware/serviceProxy.ts
// Routes request to Post Service (Port 3300)
```

3. **Post Service**
```typescript
// src/services/post-service/src/routes/post.ts
import { authenticate } from '@/shared/middleware/auth';

router.post('/posts', authenticate, postController.createPost);
```

4. **Authentication Middleware**
```typescript
// src/shared/middleware/auth.ts
export const authenticate = async (req, res, next) => {
  // 1. Extract token from Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // 2. Validate token with Auth Service
  const userData = await tokenValidationService.validateUserToken(token);
  
  // 3. Populate req.user with user data
  req.user = userData.data.user;
  
  next();
};
```

5. **Post Controller**
```typescript
// src/services/post-service/src/controllers/postController.ts
async createPost(req, res) {
  const userId = req.user.id; // From JWT middleware: "user-123"
  
  const post = await createPost({
    userId: userId,
    content: req.body.content
  });
  
  // Publish event for other services
  await eventPublisher.publish('post.created', {
    postId: post.id,
    userId: userId,
    content: post.content
  });
  
  res.json({ success: true, data: post });
}
```

### **Cross-Service Communication Example**

```typescript
// Post Service needs to validate user token
// 1. Post Service calls Auth Service
const response = await axios.post('http://auth-service:3100/api/v1/auth/validate', {
  token: userToken
}, {
  headers: {
    'Authorization': `Bearer ${serviceToken}`,
    'X-Service-ID': 'post-service'
  }
});

// 2. Auth Service validates both tokens
// - Validates user token
// - Validates service token
// - Returns user data

// 3. Post Service receives user data
const user = response.data.data.user;
// { id: "user-123", username: "john", email: "john@example.com" }
```

## 🔐 Cross-Service Token Validation

### Token Validation Service
```typescript
// shared/services/tokenValidationService.ts
import axios from 'axios';
import { logger } from '@/shared/utils/logger';

export class TokenValidationService {
  private authServiceUrl: string;

  constructor() {
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3100';
  }

  async validateUserToken(token: string): Promise<any> {
    try {
      const response = await axios.post(`${this.authServiceUrl}/api/v1/auth/validate`, {
        token
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-ID': process.env.SERVICE_NAME || 'unknown-service'
        },
        timeout: 5000
      });

      return response.data;
    } catch (error) {
      logger.error('Token validation failed:', error);
      throw new Error('TOKEN_VALIDATION_FAILED');
    }
  }

  async getUserById(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.authServiceUrl}/api/v1/auth/users/${userId}`, {
        headers: {
          'X-Service-ID': process.env.SERVICE_NAME || 'unknown-service'
        },
        timeout: 5000
      });

      return response.data;
    } catch (error) {
      logger.error('Get user by ID failed:', error);
      throw new Error('USER_FETCH_FAILED');
    }
  }
}

export const tokenValidationService = new TokenValidationService();
```

### Cross-Service Authentication Middleware
```typescript
// shared/middleware/crossServiceAuth.ts
import { Request, Response, NextFunction } from 'express';
import { tokenValidationService } from '@/shared/services/tokenValidationService';
import { logger } from '@/shared/utils/logger';

interface CrossServiceRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

export const authenticateUser = async (
  req: CrossServiceRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token required'
        }
      });
      return;
    }

    const token = authHeader.substring(7);
    
    // Validate token with Auth Service
    const userData = await tokenValidationService.validateUserToken(token);
    
    req.user = userData.data.user;
    next();
  } catch (error) {
    logger.warn('Cross-service authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      service: process.env.SERVICE_NAME
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed'
      }
    });
  }
};
```
```

This JWT authentication system provides secure, scalable authentication for our mini Facebook backend with proper token management, refresh mechanisms, and security features.
