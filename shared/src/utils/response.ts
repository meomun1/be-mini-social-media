import { Response } from 'express';
import { ApiResponse, PaginationParams } from '../types';

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

  static successWithPagination<T>(
    res: Response,
    data: T[],
    pagination: {
      total: number;
      limit: number;
      offset: number;
    },
    statusCode: number = 200
  ): void {
    const hasNext = pagination.offset + pagination.limit < pagination.total;
    const hasPrev = pagination.offset > 0;

    const response: ApiResponse<T[]> = {
      success: true,
      data,
      pagination: {
        ...pagination,
        hasNext,
        hasPrev,
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

// Utility function to extract pagination parameters from query
export function extractPaginationParams(query: any): PaginationParams {
  const limit = Math.min(parseInt(query.limit) || 20, 100); // Max 100 items per page
  const page = Math.max(parseInt(query.page) || 1, 1);
  const offset = (page - 1) * limit;

  return {
    limit,
    offset,
    page,
  };
}

// Utility function to calculate pagination metadata
export function calculatePagination(total: number, limit: number, offset: number) {
  return {
    total,
    limit,
    offset,
    hasNext: offset + limit < total,
    hasPrev: offset > 0,
    totalPages: Math.ceil(total / limit),
    currentPage: Math.floor(offset / limit) + 1,
  };
}
