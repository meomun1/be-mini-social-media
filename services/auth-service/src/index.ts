import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { DatabaseConnection } from './config/database';
import { redisConnection } from '../../../infrastructure/dist/redis/connection';
import { appConfig, corsConfig, rateLimitConfig } from './config/app';
import { AuthMiddlewareImpl } from '../../../shared/dist/middleware/auth';
import { jwtConfig } from './config/app';
import { createLogger, ApiResponseHelper } from '@shared/types';
import authRoutes from './routes/authRoutes';
import { swaggerUi, specs } from './swagger';

// Express setup, middleware wiring, protected routes, health, error handling

// Load environment variables
dotenv.config();

const logger = createLogger('auth');
const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors(corsConfig));

// Rate limiting
const limiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  message: rateLimitConfig.message,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Swagger documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Auth Service API Documentation',
  })
);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (body: any) {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
    });

    return originalSend.call(this, body);
  };

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  ApiResponseHelper.success(res, {
    status: 'healthy',
    service: appConfig.name,
    version: appConfig.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Initialize auth middleware
const authMiddleware = new AuthMiddlewareImpl(jwtConfig.secret, (token: string, secret: string) => {
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, secret);
});

// Protected routes middleware
const protectedRoutes = ['/logout', '/change-password', '/me'];
app.use('/api/v1/auth', (req, res, next) => {
  if (protectedRoutes.some(route => req.path.startsWith(route))) {
    authMiddleware.authenticate(req, res, next);
  } else {
    next();
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);

// 404 handler
app.use('*', (req, res) => {
  ApiResponseHelper.notFound(res, 'Route not found');
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
  });

  // Don't leak error details in production
  const isDevelopment = appConfig.environment === 'development';

  ApiResponseHelper.internalError(
    res,
    isDevelopment ? error.message : 'An unexpected error occurred'
  );
});

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnection = DatabaseConnection.getInstance();
    const isConnected = await dbConnection.testConnection();

    if (!isConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }

    logger.info('Database connection established');

    // Connect to Redis
    await redisConnection.connect();
    logger.info('Redis connection established');

    // Start the server
    app.listen(appConfig.port, appConfig.host, () => {
      logger.info(`Auth service started`, {
        host: appConfig.host,
        port: appConfig.port,
        environment: appConfig.environment,
        version: appConfig.version,
      });
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  try {
    await DatabaseConnection.getInstance().close();
    logger.info('Database connection closed');

    // Note: Redis connection is shared, so we don't disconnect it here
    logger.info('Auth service stopped gracefully');
  } catch (error) {
    const err = error as Error;
    logger.error('Error during shutdown', { error: err.message });
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  try {
    await DatabaseConnection.getInstance().close();
    logger.info('Database connection closed');

    // Note: Redis connection is shared, so we don't disconnect it here
    logger.info('Auth service stopped gracefully');
  } catch (error) {
    const err = error as Error;
    logger.error('Error during shutdown', { error: err.message });
  }

  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start the application
startServer();
