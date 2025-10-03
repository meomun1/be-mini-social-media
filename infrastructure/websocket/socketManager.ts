import { Socket } from 'socket.io';
import { WebSocketConnection } from './connection';
import { createLogger } from '@shared/types';

const logger = createLogger('websocket-socket-manager');

export interface UserSocket {
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
}

export interface RoomInfo {
  name: string;
  participants: string[];
  createdAt: Date;
}

/**
 * Base socket manager that all microservices should extend
 * Provides common WebSocket operations for real-time features
 */
export abstract class BaseSocketManager {
  protected webSocket: WebSocketConnection;
  protected serviceName: string;
  private userSockets: Map<string, UserSocket> = new Map();
  private socketUsers: Map<string, string> = new Map();
  private rooms: Map<string, RoomInfo> = new Map();

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.webSocket = WebSocketConnection.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      const io = this.webSocket.getServer();

      io.on('connection', (socket: Socket) => {
        this.handleConnection(socket);
      });

      logger.info(`Socket manager initialized for service: ${this.serviceName}`);
    } catch (error) {
      logger.error(`Failed to initialize socket manager for service: ${this.serviceName}`, error);
      throw error;
    }
  }

  private handleConnection(socket: Socket): void {
    logger.info(`Client connected: ${socket.id}`, { service: this.serviceName });

    socket.on('authenticate', (data: { userId: string; token: string }) => {
      this.authenticateUser(socket, data.userId, data.token);
    });

    socket.on('join_room', (roomName: string) => {
      this.joinRoom(socket, roomName);
    });

    socket.on('leave_room', (roomName: string) => {
      this.leaveRoom(socket, roomName);
    });

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    socket.on('error', error => {
      logger.error(`Socket error for client ${socket.id}:`, {
        service: this.serviceName,
        error: error.message,
      });
    });
  }

  private authenticateUser(socket: Socket, userId: string, token: string): void {
    try {
      // TODO: Implement JWT token validation
      // For now, we'll assume the token is valid

      const userSocket: UserSocket = {
        userId,
        socketId: socket.id,
        connectedAt: new Date(),
        lastActivity: new Date(),
      };

      this.userSockets.set(userId, userSocket);
      this.socketUsers.set(socket.id, userId);

      socket.emit('authenticated', { success: true, userId });

      logger.info(`User authenticated: ${userId}`, {
        service: this.serviceName,
        socketId: socket.id,
      });
    } catch (error) {
      socket.emit('authentication_error', { message: 'Authentication failed' });
      logger.error(`Authentication failed for socket ${socket.id}:`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
    }
  }

  private joinRoom(socket: Socket, roomName: string): void {
    try {
      socket.join(roomName);

      const userId = this.socketUsers.get(socket.id);
      if (userId) {
        const room = this.rooms.get(roomName);
        if (room) {
          if (!room.participants.includes(userId)) {
            room.participants.push(userId);
          }
        } else {
          this.rooms.set(roomName, {
            name: roomName,
            participants: [userId],
            createdAt: new Date(),
          });
        }

        socket.to(roomName).emit('user_joined', { userId, roomName });
        logger.info(`User joined room: ${userId} -> ${roomName}`, {
          service: this.serviceName,
        });
      }
    } catch (error) {
      logger.error(`Failed to join room:`, {
        service: this.serviceName,
        roomName,
        error: (error as Error).message,
      });
    }
  }

  private leaveRoom(socket: Socket, roomName: string): void {
    try {
      socket.leave(roomName);

      const userId = this.socketUsers.get(socket.id);
      if (userId) {
        const room = this.rooms.get(roomName);
        if (room) {
          room.participants = room.participants.filter(id => id !== userId);
          if (room.participants.length === 0) {
            this.rooms.delete(roomName);
          }
        }

        socket.to(roomName).emit('user_left', { userId, roomName });
        logger.info(`User left room: ${userId} -> ${roomName}`, {
          service: this.serviceName,
        });
      }
    } catch (error) {
      logger.error(`Failed to leave room:`, {
        service: this.serviceName,
        roomName,
        error: (error as Error).message,
      });
    }
  }

  private handleDisconnection(socket: Socket): void {
    try {
      const userId = this.socketUsers.get(socket.id);

      if (userId) {
        this.userSockets.delete(userId);
        this.socketUsers.delete(socket.id);

        // Remove user from all rooms
        for (const [roomName, room] of this.rooms.entries()) {
          if (room.participants.includes(userId)) {
            room.participants = room.participants.filter(id => id !== userId);
            if (room.participants.length === 0) {
              this.rooms.delete(roomName);
            }
          }
        }

        logger.info(`User disconnected: ${userId}`, {
          service: this.serviceName,
          socketId: socket.id,
        });
      }
    } catch (error) {
      logger.error(`Error handling disconnection:`, {
        service: this.serviceName,
        socketId: socket.id,
        error: (error as Error).message,
      });
    }
  }

  // Public methods for services to use
  async sendToUser(userId: string, event: string, data: any): Promise<boolean> {
    try {
      const userSocket = this.userSockets.get(userId);
      if (!userSocket) {
        logger.warn(`User not connected: ${userId}`, { service: this.serviceName });
        return false;
      }

      const io = this.webSocket.getServer();
      io.to(userSocket.socketId).emit(event, data);

      logger.debug(`Message sent to user: ${userId}`, {
        service: this.serviceName,
        event,
      });
      return true;
    } catch (error) {
      logger.error(`Failed to send message to user:`, {
        service: this.serviceName,
        userId,
        event,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async sendToRoom(roomName: string, event: string, data: any): Promise<boolean> {
    try {
      const io = this.webSocket.getServer();
      io.to(roomName).emit(event, data);

      logger.debug(`Message sent to room: ${roomName}`, {
        service: this.serviceName,
        event,
      });
      return true;
    } catch (error) {
      logger.error(`Failed to send message to room:`, {
        service: this.serviceName,
        roomName,
        event,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async broadcast(event: string, data: any): Promise<boolean> {
    try {
      const io = this.webSocket.getServer();
      io.emit(event, data);

      logger.debug(`Broadcast message sent`, {
        service: this.serviceName,
        event,
      });
      return true;
    } catch (error) {
      logger.error(`Failed to broadcast message:`, {
        service: this.serviceName,
        event,
        error: (error as Error).message,
      });
      return false;
    }
  }

  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  getUserSocket(userId: string): UserSocket | undefined {
    return this.userSockets.get(userId);
  }

  getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  getRoomParticipants(roomName: string): string[] {
    const room = this.rooms.get(roomName);
    return room ? room.participants : [];
  }

  getRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      return await this.webSocket.ping();
    } catch (error) {
      logger.error(`Socket manager health check failed`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Abstract methods that each service should implement
  abstract handleCustomEvents(socket: Socket): void;
}
