export const appConfig = {
  port: parseInt(process.env.USER_SERVICE_PORT || '3002'),
  host: process.env.USER_SERVICE_HOST || 'localhost',
  version: process.env.SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
};

export const corsConfig = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
};

export const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
};

export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

export const cacheConfig = {
  // Cache TTL in seconds
  userProfile: parseInt(process.env.CACHE_USER_PROFILE_TTL || '300'), // 5 minutes
  friendList: parseInt(process.env.CACHE_FRIEND_LIST_TTL || '600'), // 10 minutes
  privacySettings: parseInt(process.env.CACHE_PRIVACY_SETTINGS_TTL || '1800'), // 30 minutes
  userSearch: parseInt(process.env.CACHE_USER_SEARCH_TTL || '60'), // 1 minute

  // Cache keys prefix
  keyPrefix: 'user_service:',
};
