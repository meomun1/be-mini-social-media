import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createLogger } from '@shared/types';

const logger = createLogger('websocket-connection');

export interface WebSocketConfig {
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  pingTimeout: number;
  pingInterval: number;
}

export class WebSocketConnection {
  private io: SocketIOServer | null = null;
  private static instance: WebSocketConnection;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): WebSocketConnection {
    if (!WebSocketConnection.instance) {
      WebSocketConnection.instance = new WebSocketConnection();
    }
    return WebSocketConnection.instance;
  }

  initialize(httpServer: HTTPServer, config: WebSocketConfig): SocketIOServer {
    if (this.io) {
      return this.io;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: config.cors,
      pingTimeout: config.pingTimeout,
      pingInterval: config.pingInterval,
    });

    this.setupEventHandlers();
    this.isConnected = true;

    logger.info('WebSocket server initialized successfully');
    return this.io;
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: any) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.on('disconnect', (reason: string) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });

      socket.on('error', (error: Error) => {
        logger.error(`Socket error for client ${socket.id}:`, error);
      });
    });

    this.io.engine.on('connection_error', (error: Error) => {
      logger.error('WebSocket connection error:', error);
    });
  }

  getServer(): SocketIOServer {
    if (!this.io || !this.isConnected) {
      throw new Error('WebSocket server not initialized');
    }
    return this.io;
  }

  isHealthy(): boolean {
    return this.isConnected && this.io !== null;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.io) {
        this.io.close();
        this.io = null;
        this.isConnected = false;
        logger.info('WebSocket server closed');
      }
    } catch (error) {
      logger.error('Error closing WebSocket server:', error);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (this.io && this.isConnected) {
        // WebSocket doesn't have a direct ping, but we can check server status
        return this.io.engine.clientsCount >= 0;
      }
      return false;
    } catch (error) {
      logger.error('WebSocket ping failed:', error);
      return false;
    }
  }
}

// Initialize with default configuration
export const initializeWebSocket = (httpServer: HTTPServer): WebSocketConnection => {
  const config: WebSocketConfig = {
    cors: {
      origin: process.env.WEBSOCKET_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    pingTimeout: parseInt(process.env.WEBSOCKET_PING_TIMEOUT || '60000'),
    pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL || '25000'),
  };

  const webSocketConnection = WebSocketConnection.getInstance();
  webSocketConnection.initialize(httpServer, config);
  return webSocketConnection;
};

export const webSocketConnection = WebSocketConnection.getInstance();
