import { LogLevel, ServiceName } from '../types';

export class Logger {
  private service: ServiceName;

  constructor(service: ServiceName) {
    this.service = service;
  }

  private formatMessage(level: LogLevel['level'], message: string, metadata?: any): LogLevel {
    return {
      level,
      service: this.service,
      message,
      timestamp: new Date(),
      metadata,
    };
  }

  error(message: string, metadata?: any): void {
    const logEntry = this.formatMessage('error', message, metadata);
    console.error(JSON.stringify(logEntry));
  }

  warn(message: string, metadata?: any): void {
    const logEntry = this.formatMessage('warn', message, metadata);
    console.warn(JSON.stringify(logEntry));
  }

  info(message: string, metadata?: any): void {
    const logEntry = this.formatMessage('info', message, metadata);
    console.info(JSON.stringify(logEntry));
  }

  debug(message: string, metadata?: any): void {
    const logEntry = this.formatMessage('debug', message, metadata);
    console.debug(JSON.stringify(logEntry));
  }

  // Request logging
  logRequest(method: string, url: string, statusCode: number, duration: number, userId?: string): void {
    this.info('Request completed', {
      method,
      url,
      statusCode,
      duration,
      userId,
    });
  }

  // Error logging with stack trace
  logError(error: Error, context?: any): void {
    this.error('Application error', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
    });
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: any): void {
    this.info('Performance metric', {
      operation,
      duration,
      ...metadata,
    });
  }

  // Database operation logging
  logDatabase(operation: string, table: string, duration: number, success: boolean, error?: any): void {
    const level = success ? 'info' : 'error';
    const logEntry = this.formatMessage(level, 'Database operation', {
      operation,
      table,
      duration,
      success,
      error: error?.message,
    });
    
    if (success) {
      console.info(JSON.stringify(logEntry));
    } else {
      console.error(JSON.stringify(logEntry));
    }
  }

  // Event logging
  logEvent(eventType: string, eventData: any, success: boolean = true): void {
    const level = success ? 'info' : 'error';
    const logEntry = this.formatMessage(level, 'Event processed', {
      eventType,
      eventData,
      success,
    });
    
    if (success) {
      console.info(JSON.stringify(logEntry));
    } else {
      console.error(JSON.stringify(logEntry));
    }
  }
}

// Create logger instances for each service
export const createLogger = (service: ServiceName): Logger => new Logger(service);
