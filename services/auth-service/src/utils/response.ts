import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class ApiResponseHelper {
  static success<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
    };
    res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    code: string,
    message: string,
    statusCode: number = 400,
    details?: any
  ): void {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };
    res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T): void {
    this.success(res, data, 201);
  }

  static noContent(res: Response): void {
    res.status(204).send();
  }

  static unauthorized(res: Response, message: string = 'Unauthorized'): void {
    this.error(res, 'UNAUTHORIZED', message, 401);
  }

  static forbidden(res: Response, message: string = 'Forbidden'): void {
    this.error(res, 'FORBIDDEN', message, 403);
  }

  static notFound(res: Response, message: string = 'Resource not found'): void {
    this.error(res, 'NOT_FOUND', message, 404);
  }

  static conflict(res: Response, message: string = 'Resource conflict'): void {
    this.error(res, 'CONFLICT', message, 409);
  }

  static validationError(res: Response, message: string = 'Validation error', details?: any): void {
    this.error(res, 'VALIDATION_ERROR', message, 422, details);
  }

  static tooManyRequests(res: Response, message: string = 'Too many requests'): void {
    this.error(res, 'TOO_MANY_REQUESTS', message, 429);
  }

  static internalError(res: Response, message: string = 'Internal server error'): void {
    this.error(res, 'INTERNAL_ERROR', message, 500);
  }

  static serviceUnavailable(res: Response, message: string = 'Service unavailable'): void {
    this.error(res, 'SERVICE_UNAVAILABLE', message, 503);
  }
}
