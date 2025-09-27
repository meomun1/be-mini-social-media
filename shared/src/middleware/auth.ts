import { Request, Response, NextFunction } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { JWTPayload } from '../types';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
      };
      jwtPayload?: JWTPayload;
    }
  }
}

export interface AuthMiddleware {
  authenticate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  optional: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  requireRole: (role: string) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export class AuthMiddlewareImpl implements AuthMiddleware {
  private jwtSecret: string;
  private jwtVerify: (token: string, secret: string) => JWTPayload;

  constructor(jwtSecret: string, jwtVerify: (token: string, secret: string) => JWTPayload) {
    this.jwtSecret = jwtSecret;
    this.jwtVerify = jwtVerify;
  }

  async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return ApiResponseHelper.unauthorized(res, 'Authorization header is required');
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (!token) {
        return ApiResponseHelper.unauthorized(res, 'Token is required');
      }

      // Verify JWT token
      const payload = this.jwtVerify(token, this.jwtSecret);
      
      // Check if token is expired
      if (payload.exp < Date.now() / 1000) {
        return ApiResponseHelper.unauthorized(res, 'Token has expired');
      }

      // Check token type
      if (payload.type !== 'access') {
        return ApiResponseHelper.unauthorized(res, 'Invalid token type');
      }

      // Attach user info to request
      req.user = {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
      };
      req.jwtPayload = payload;

      next();
    } catch (error) {
      return ApiResponseHelper.unauthorized(res, 'Invalid token');
    }
  }

  async optional(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return next();
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (!token) {
        return next();
      }

      // Try to verify token, but don't fail if invalid
      try {
        const payload = this.jwtVerify(token, this.jwtSecret);
        
        // Check if token is not expired
        if (payload.exp >= Date.now() / 1000 && payload.type === 'access') {
          req.user = {
            id: payload.sub,
            email: payload.email,
            username: payload.username,
          };
          req.jwtPayload = payload;
        }
      } catch (error) {
        // Token is invalid, but we don't fail the request
        // Just continue without user info
      }

      next();
    } catch (error) {
      next();
    }
  }

  requireRole(role: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        return ApiResponseHelper.unauthorized(res, 'Authentication required');
      }

      // For now, we don't have roles in our system
      // This can be extended when role-based access control is implemented
      next();
    };
  }
}

// Rate limiting middleware
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export class RateLimitMiddleware {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(private config: RateLimitConfig) {}

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.config.keyGenerator 
        ? this.config.keyGenerator(req)
        : req.ip || 'unknown';

      const now = Date.now();
      const windowStart = now - this.config.windowMs;

      // Clean up expired entries
      for (const [k, v] of this.requests.entries()) {
        if (v.resetTime < now) {
          this.requests.delete(k);
        }
      }

      const current = this.requests.get(key);

      if (!current) {
        this.requests.set(key, {
          count: 1,
          resetTime: now + this.config.windowMs,
        });
        return next();
      }

      if (current.resetTime < now) {
        // Reset window
        this.requests.set(key, {
          count: 1,
          resetTime: now + this.config.windowMs,
        });
        return next();
      }

      if (current.count >= this.config.max) {
        return ApiResponseHelper.tooManyRequests(
          res, 
          this.config.message || 'Too many requests'
        );
      }

      current.count++;
      next();
    };
  }
}

// CORS middleware
export interface CorsConfig {
  origin: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
}

export function corsMiddleware(config: CorsConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // Handle origin
    if (config.origin === true) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    } else if (Array.isArray(config.origin)) {
      if (origin && config.origin.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
    } else if (typeof config.origin === 'string') {
      res.header('Access-Control-Allow-Origin', config.origin);
    }

    // Handle methods
    res.header(
      'Access-Control-Allow-Methods',
      config.methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS'
    );

    // Handle headers
    res.header(
      'Access-Control-Allow-Headers',
      config.allowedHeaders?.join(', ') || 'Content-Type, Authorization'
    );

    // Handle credentials
    if (config.credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  };
}
