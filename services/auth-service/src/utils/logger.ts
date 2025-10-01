export class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private formatMessage(level: string, message: string, metadata?: any): any {
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
}

export const createLogger = (service: string): Logger => new Logger(service);
