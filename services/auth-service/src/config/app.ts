import { ServiceConfig, JWTConfig } from '@shared/types';

// config for JWT / BCRYPT / CORS / RATE LIMIT / APP CONFIG

export const appConfig: ServiceConfig = {
  name: 'auth',
  port: parseInt(process.env.AUTH_SERVICE_PORT || '3001'),
  host: process.env.AUTH_SERVICE_HOST || 'localhost',
  version: process.env.npm_package_version || '1.0.0',
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
};

export const jwtConfig: JWTConfig = {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  issuer: process.env.JWT_ISSUER || 'mini-social-media',
  audience: process.env.JWT_AUDIENCE || 'mini-social-media-users',
};

export const bcryptConfig = {
  rounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
};

export const corsConfig = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

export const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
};
