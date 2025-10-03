import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { DatabaseConnection } from './config/database';
import { redisConnection } from '../../../infrastructure/dist/redis/connection';
import { appConfig, corsConfig, rateLimitConfig } from './config/app';
import { createLogger } from '@shared/types';
import userRoutes from './routes/userRoutes';

const logger = createLogger('user');

class UserServiceApp {
  private app: express.Application;
  private db: DatabaseConnection;

  constructor() {
    this.app = express();
    this.db = DatabaseConnection.getInstance();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS middleware
    this.app.use(cors(corsConfig));

    // Rate limiting
    this.app.use(rateLimit(rateLimitConfig));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.logRequest(req.method, req.url, res.statusCode, duration, req.user?.id);
      });

      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          service: 'user-service',
          version: appConfig.version,
          environment: appConfig.environment,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
      });
    });

    // API routes
    this.app.use('/api/v1/users', userRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        },
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(
      (error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error('Unhandled error', {
          error: error.message,
          stack: error.stack,
          url: req.url,
          method: req.method,
          userId: req.user?.id,
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        });
      }
    );
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.db.connect();
      logger.info('Database connected successfully');

      // Connect to Redis (shared infrastructure)
      await redisConnection.connect();
      logger.info('Redis connected successfully');

      // Start server
      this.app.listen(appConfig.port, appConfig.host, () => {
        logger.info('User Service started successfully', {
          port: appConfig.port,
          host: appConfig.host,
          environment: appConfig.environment,
        });
      });
    } catch (error) {
      logger.error('Failed to start User Service', { error: (error as Error).message });
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.db.disconnect();
      // Note: Redis connection is shared, so we don't disconnect it here
      logger.info('User Service stopped gracefully');
    } catch (error) {
      logger.error('Error during User Service shutdown', { error: (error as Error).message });
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});

// Start the application
const app = new UserServiceApp();
app.start().catch(error => {
  logger.error('Failed to start application', { error: (error as Error).message });
  process.exit(1);
});
