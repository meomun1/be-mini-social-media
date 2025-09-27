import { Request, Response, NextFunction } from 'express';
import { validate, ValidationError } from 'class-validator';
import { plainToClass, ClassConstructor } from 'class-transformer';
import { ApiResponseHelper } from '../utils/response';

export interface ValidationMiddleware {
  validateBody: <T>(
    dtoClass: ClassConstructor<T>
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
  validateQuery: <T>(
    dtoClass: ClassConstructor<T>
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
  validateParams: <T>(
    dtoClass: ClassConstructor<T>
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export class ValidationMiddlewareImpl implements ValidationMiddleware {
  validateBody<T>(dtoClass: ClassConstructor<T>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const dto = plainToClass(dtoClass, req.body);
        const errors = await validate(dto as object);

        if (errors.length > 0) {
          const validationErrors = this.formatValidationErrors(errors);
          return ApiResponseHelper.validationError(res, 'Validation failed', validationErrors);
        }

        // Replace req.body with validated and transformed data
        req.body = dto;
        next();
      } catch (error) {
        return ApiResponseHelper.validationError(res, 'Invalid request body format');
      }
    };
  }

  validateQuery<T>(dtoClass: ClassConstructor<T>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const dto = plainToClass(dtoClass, req.query);
        const errors = await validate(dto as object);

        if (errors.length > 0) {
          const validationErrors = this.formatValidationErrors(errors);
          return ApiResponseHelper.validationError(
            res,
            'Invalid query parameters',
            validationErrors
          );
        }

        // Replace req.query with validated and transformed data
        req.query = dto as any;
        next();
      } catch (error) {
        return ApiResponseHelper.validationError(res, 'Invalid query parameters format');
      }
    };
  }

  validateParams<T>(dtoClass: ClassConstructor<T>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const dto = plainToClass(dtoClass, req.params);
        const errors = await validate(dto as object);

        if (errors.length > 0) {
          const validationErrors = this.formatValidationErrors(errors);
          return ApiResponseHelper.validationError(res, 'Invalid URL parameters', validationErrors);
        }

        // Replace req.params with validated and transformed data
        req.params = dto as any;
        next();
      } catch (error) {
        return ApiResponseHelper.validationError(res, 'Invalid URL parameters format');
      }
    };
  }

  private formatValidationErrors(errors: ValidationError[]): any {
    const formattedErrors: any = {};

    errors.forEach(error => {
      const property = error.property;
      const constraints = error.constraints || {};

      formattedErrors[property] = {
        value: error.value,
        constraints: Object.values(constraints),
        children:
          error.children && error.children.length > 0
            ? this.formatValidationErrors(error.children)
            : undefined,
      };
    });

    return formattedErrors;
  }
}

// Request logging middleware
export function requestLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function (body: any) {
      const duration = Date.now() - startTime;

      // Log request details
      console.log(
        JSON.stringify({
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.id,
          timestamp: new Date().toISOString(),
        })
      );

      return originalSend.call(this, body);
    };

    next();
  };
}

// Error handling middleware
export function errorHandlingMiddleware() {
  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    // Log the error
    console.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (error.name === 'ValidationError') {
      return ApiResponseHelper.validationError(
        res,
        'Validation failed',
        isDevelopment ? error.details : undefined
      );
    }

    if (error.name === 'UnauthorizedError') {
      return ApiResponseHelper.unauthorized(res, 'Invalid authentication token');
    }

    if (error.name === 'ForbiddenError') {
      return ApiResponseHelper.forbidden(res, 'Insufficient permissions');
    }

    if (error.name === 'NotFoundError') {
      return ApiResponseHelper.notFound(res, 'Resource not found');
    }

    // Default to internal server error
    return ApiResponseHelper.internalError(
      res,
      isDevelopment ? error.message : 'An unexpected error occurred'
    );
  };
}

// Health check middleware
export function healthCheckMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/health' || req.path === '/healthz') {
      return ApiResponseHelper.success(res, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
      });
    }
    next();
  };
}
