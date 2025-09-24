# WebSocket Real-time Communication

## ⚡ Overview

WebSockets enable real-time bidirectional communication for our mini Facebook backend microservices, supporting live chat, notifications, typing indicators, and other instant updates. The WebSocket server is integrated with the API Gateway and communicates with microservices through events.

## 🏗️ WebSocket Setup

### Socket.IO Server Setup
```typescript
// infrastructure/websocket/socketServer.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { UserPayload } from '@/shared/types/auth';
import { logger } from '@/shared/utils/logger';

interface AuthenticatedSocket extends Socket {
  user?: UserPayload;
}

export class SocketServer {
  private io: SocketIOServer;
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
        socket.user = decoded;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.user!.id;
      
      // Track user connection
      this.connectedUsers.set(socket.id, userId);
      
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Join user to their personal room
      socket.join(`user:${userId}`);

      logger.info('User connected', { 
        userId, 
        socketId: socket.id, 
        totalConnections: this.io.engine.clientsCount 
      });

      // Notify others that user is online
      socket.broadcast.emit('user:online', { userId });

      // Send user their current status
      socket.emit('connection:established', {
        userId,
        connectedUsers: Array.from(this.connectedUsers.values())
      });

      // Message events
      socket.on('message:send', (data) => this.handleMessageSend(socket, data));
      socket.on('message:typing', (data) => this.handleTyping(socket, data));
      socket.on('message:stop_typing', (data) => this.handleStopTyping(socket, data));

      // Friend events
      socket.on('friend:request', (data) => this.handleFriendRequest(socket, data));
      socket.on('friend:accept', (data) => this.handleFriendAccept(socket, data));

      // Post events
      socket.on('post:like', (data) => this.handlePostLike(socket, data));
      socket.on('post:comment', (data) => this.handlePostComment(socket, data));

      // Disconnection
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  private async handleMessageSend(socket: AuthenticatedSocket, data: {
    conversationId: string;
    receiverId: string;
    content: string;
    messageType?: string;
  }): Promise<void> {
    try {
      const messageData = {
        id: this.generateId(),
        conversationId: data.conversationId,
        senderId: socket.user!.id,
        receiverId: data.receiverId,
        content: data.content,
        messageType: data.messageType || 'text',
        createdAt: new Date().toISOString()
      };

      // Save message to database
      await this.saveMessage(messageData);

      // Emit to sender
      socket.emit('message:sent', messageData);

      // Emit to receiver
      this.io.to(`user:${data.receiverId}`).emit('message:received', messageData);

      // Emit to conversation room
      this.io.to(`conversation:${data.conversationId}`).emit('message:new', messageData);

      logger.info('Message sent', {
        senderId: socket.user!.id,
        receiverId: data.receiverId,
        conversationId: data.conversationId
      });
    } catch (error) {
      logger.error('Message send error:', error);
      socket.emit('message:error', { error: 'Failed to send message' });
    }
  }

  private async handleTyping(socket: AuthenticatedSocket, data: {
    conversationId: string;
    receiverId: string;
  }): Promise<void> {
    const typingData = {
      userId: socket.user!.id,
      conversationId: data.conversationId,
      isTyping: true
    };

    // Emit typing indicator to receiver
    this.io.to(`user:${data.receiverId}`).emit('typing:start', typingData);

    // Clear typing indicator after 3 seconds
    setTimeout(() => {
      this.io.to(`user:${data.receiverId}`).emit('typing:stop', {
        userId: socket.user!.id,
        conversationId: data.conversationId
      });
    }, 3000);
  }

  private async handleStopTyping(socket: AuthenticatedSocket, data: {
    conversationId: string;
    receiverId: string;
  }): Promise<void> {
    const stopTypingData = {
      userId: socket.user!.id,
      conversationId: data.conversationId,
      isTyping: false
    };

    this.io.to(`user:${data.receiverId}`).emit('typing:stop', stopTypingData);
  }

  private async handleFriendRequest(socket: AuthenticatedSocket, data: {
    toUserId: string;
  }): Promise<void> {
    try {
      const requestData = {
        id: this.generateId(),
        fromUserId: socket.user!.id,
        toUserId: data.toUserId,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Save friend request to database
      await this.saveFriendRequest(requestData);

      // Notify receiver
      this.io.to(`user:${data.toUserId}`).emit('friend:request_received', {
        requestId: requestData.id,
        fromUserId: socket.user!.id,
        fromUser: await this.getUserProfile(socket.user!.id)
      });

      logger.info('Friend request sent', {
        fromUserId: socket.user!.id,
        toUserId: data.toUserId
      });
    } catch (error) {
      logger.error('Friend request error:', error);
      socket.emit('friend:request_error', { error: 'Failed to send friend request' });
    }
  }

  private async handlePostLike(socket: AuthenticatedSocket, data: {
    postId: string;
    reactionType: string;
  }): Promise<void> {
    try {
      const likeData = {
        id: this.generateId(),
        postId: data.postId,
        userId: socket.user!.id,
        reactionType: data.reactionType,
        createdAt: new Date().toISOString()
      };

      // Save reaction to database
      await this.saveReaction(likeData);

      // Get post owner
      const postOwner = await this.getPostOwner(data.postId);

      // Notify post owner if not the same user
      if (postOwner !== socket.user!.id) {
        this.io.to(`user:${postOwner}`).emit('post:liked', {
          postId: data.postId,
          likerId: socket.user!.id,
          liker: await this.getUserProfile(socket.user!.id),
          reactionType: data.reactionType
        });
      }

      // Emit to all users viewing the post
      this.io.to(`post:${data.postId}`).emit('post:reaction_update', {
        postId: data.postId,
        reaction: likeData
      });

    } catch (error) {
      logger.error('Post like error:', error);
      socket.emit('post:like_error', { error: 'Failed to like post' });
    }
  }

  private handleDisconnect(socket: AuthenticatedSocket): void {
    const userId = socket.user!.id;
    
    // Remove from tracking
    this.connectedUsers.delete(socket.id);
    
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      
      // If user has no more connections, mark as offline
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        
        // Notify others that user is offline
        socket.broadcast.emit('user:offline', { userId });
        
        logger.info('User went offline', { userId });
      }
    }

    logger.info('User disconnected', { 
      userId, 
      socketId: socket.id,
      remainingConnections: this.io.engine.clientsCount 
    });
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveMessage(data: any): Promise<void> {
    // Send event to Message Service via RabbitMQ
    await this.eventPublisher.publish('message.save', {
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      messageType: data.messageType
    });
  }

  private async saveFriendRequest(data: any): Promise<void> {
    // Send event to User Service via RabbitMQ
    await this.eventPublisher.publish('friend.request.save', {
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      status: data.status
    });
  }

  private async saveReaction(data: any): Promise<void> {
    // Send event to Post Service via RabbitMQ
    await this.eventPublisher.publish('reaction.save', {
      postId: data.postId,
      userId: data.userId,
      reactionType: data.reactionType
    });
  }

  private async getUserProfile(userId: string): Promise<any> {
    // Call User Service API
    const response = await this.httpClient.get(`${process.env.USER_SERVICE_URL}/api/v1/users/${userId}`);
    return response.data;
  }

  private async getPostOwner(postId: string): Promise<string> {
    // Call Post Service API
    const response = await this.httpClient.get(`${process.env.POST_SERVICE_URL}/api/v1/posts/${postId}`);
    return response.data.userId;
  }

  // Public methods for external use
  public emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public emitToUsers(userIds: string[], event: string, data: any): void {
    userIds.forEach(userId => {
      this.io.to(`user:${userId}`).emit(event, data);
    });
  }

  public emitToConversation(conversationId: string, event: string, data: any): void {
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  public getConnectionCount(): number {
    return this.io.engine.clientsCount;
  }
}

export const createSocketServer = (httpServer: HTTPServer) => new SocketServer(httpServer);
```

## 📱 Client-Side Integration

### React Hook for WebSocket
```typescript
// client/hooks/useSocket.ts
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: string[];
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
}

export const useSocket = (token: string): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('connection:established', (data) => {
      setOnlineUsers(data.connectedUsers || []);
    });

    newSocket.on('user:online', (data) => {
      setOnlineUsers(prev => [...prev, data.userId]);
    });

    newSocket.on('user:offline', (data) => {
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const emit = (event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  const on = (event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  return {
    socket,
    isConnected,
    onlineUsers,
    emit,
    on,
    off
  };
};
```

### Chat Component
```typescript
// client/components/Chat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface ChatProps {
  conversationId: string;
  receiverId: string;
  token: string;
}

export const Chat: React.FC<ChatProps> = ({ conversationId, receiverId, token }) => {
  const { socket, isConnected, emit, on, off } = useSocket(token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };

    const handleTypingStart = (data: { userId: string }) => {
      if (data.userId !== receiverId) return;
      setTypingUsers(prev => [...prev, data.userId]);
      setIsTyping(true);
    };

    const handleTypingStop = (data: { userId: string }) => {
      setTypingUsers(prev => prev.filter(id => id !== data.userId));
      setIsTyping(typingUsers.length > 1);
    };

    on('message:received', handleMessageReceived);
    on('typing:start', handleTypingStart);
    on('typing:stop', handleTypingStop);

    return () => {
      off('message:received', handleMessageReceived);
      off('typing:start', handleTypingStart);
      off('typing:stop', handleTypingStop);
    };
  }, [socket, receiverId, typingUsers.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !isConnected) return;

    emit('message:send', {
      conversationId,
      receiverId,
      content: newMessage.trim(),
      messageType: 'text'
    });

    setNewMessage('');
  };

  const handleTyping = () => {
    if (!isConnected) return;

    emit('message:typing', {
      conversationId,
      receiverId
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat</h3>
        <div className="connection-status">
          {isConnected ? '🟢 Online' : '🔴 Offline'}
        </div>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.senderId === receiverId ? 'received' : 'sent'}`}>
            <div className="message-content">{message.content}</div>
            <div className="message-time">
              {new Date(message.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="typing-indicator">
            {typingUsers.join(', ')} is typing...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-container">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <button onClick={sendMessage} disabled={!newMessage.trim() || !isConnected}>
          Send
        </button>
      </div>
    </div>
  );
};
```

## 📊 Real-time Features

### Event-Driven WebSocket Communication
```typescript
// infrastructure/websocket/eventHandler.ts
import { SocketServer } from './socketServer';
import { EventConsumer } from '@/infrastructure/rabbitmq/eventConsumer';
import { logger } from '@/shared/utils/logger';

export class WebSocketEventHandler {
  constructor(
    private socketServer: SocketServer,
    private eventConsumer: EventConsumer
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen to events from microservices
    this.eventConsumer.on('notification.created', this.handleNotificationCreated.bind(this));
    this.eventConsumer.on('message.sent', this.handleMessageSent.bind(this));
    this.eventConsumer.on('friend.request.sent', this.handleFriendRequestSent.bind(this));
    this.eventConsumer.on('post.liked', this.handlePostLiked.bind(this));
    this.eventConsumer.on('user.online', this.handleUserOnline.bind(this));
    this.eventConsumer.on('user.offline', this.handleUserOffline.bind(this));
  }

  private async handleNotificationCreated(event: any): Promise<void> {
    const { userId, notification } = event.data;
    
    this.socketServer.emitToUser(userId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      createdAt: notification.createdAt,
      isRead: notification.isRead
    });

    logger.info('Real-time notification sent via WebSocket', { 
      userId, 
      type: notification.type 
    });
  }

  private async handleMessageSent(event: any): Promise<void> {
    const { conversationId, senderId, receiverId, message } = event.data;
    
    // Emit to conversation participants
    this.socketServer.emitToConversation(conversationId, 'message:received', {
      id: message.id,
      senderId: message.senderId,
      content: message.content,
      messageType: message.messageType,
      createdAt: message.createdAt
    });

    // Emit to specific receiver if they're online
    this.socketServer.emitToUser(receiverId, 'message:direct', {
      id: message.id,
      conversationId,
      senderId,
      content: message.content,
      createdAt: message.createdAt
    });
  }

  private async handleFriendRequestSent(event: any): Promise<void> {
    const { fromUserId, toUserId, friendship } = event.data;
    
    this.socketServer.emitToUser(toUserId, 'friend:request_received', {
      id: friendship.id,
      fromUserId,
      fromUser: await this.getUserProfile(fromUserId),
      createdAt: friendship.createdAt
    });
  }

  private async handlePostLiked(event: any): Promise<void> {
    const { postId, userId, likerId, reaction } = event.data;
    
    this.socketServer.emitToUser(userId, 'post:liked', {
      postId,
      likerId,
      liker: await this.getUserProfile(likerId),
      reactionType: reaction.type,
      createdAt: reaction.createdAt
    });
  }

  private async handleUserOnline(event: any): Promise<void> {
    const { userId } = event.data;
    
    this.socketServer.broadcast('user:online', { userId });
  }

  private async handleUserOffline(event: any): Promise<void> {
    const { userId } = event.data;
    
    this.socketServer.broadcast('user:offline', { userId });
  }

  private async getUserProfile(userId: string): Promise<any> {
    // Call User Service API
    const response = await this.httpClient.get(`${process.env.USER_SERVICE_URL}/api/v1/users/${userId}`);
    return response.data;
  }
}
```

### Live Notifications Service
```typescript
// infrastructure/websocket/notificationService.ts
import { SocketServer } from './socketServer';
import { EventPublisher } from '@/infrastructure/rabbitmq/eventPublisher';
import { logger } from '@/shared/utils/logger';

export class RealTimeNotificationService {
  constructor(
    private socketServer: SocketServer,
    private eventPublisher: EventPublisher
  ) {}

  async sendNotification(userId: string, notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }): Promise<void> {
    try {
      // Publish event to Notification Service
      await this.eventPublisher.publish('notification.create', {
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data
      });

      logger.info('Notification event published', { userId, type: notification.type });
    } catch (error) {
      logger.error('Failed to publish notification event:', { userId, error });
    }
  }

  async sendFriendRequestNotification(toUserId: string, fromUserId: string): Promise<void> {
    await this.sendNotification(toUserId, {
      type: 'friend_request',
      title: 'New Friend Request',
      message: 'You have a new friend request',
      data: { fromUserId }
    });
  }

  async sendPostLikeNotification(userId: string, postId: string, likerId: string): Promise<void> {
    await this.sendNotification(userId, {
      type: 'post_like',
      title: 'Post Liked',
      message: 'Someone liked your post',
      data: { postId, likerId }
    });
  }

  async sendMessageNotification(userId: string, senderId: string, message: string): Promise<void> {
    await this.sendNotification(userId, {
      type: 'message',
      title: 'New Message',
      message: `You have a new message from ${senderId}`,
      data: { senderId, message }
    });
  }
}
```

This WebSocket implementation provides comprehensive real-time communication features for our mini Facebook backend, including live chat, notifications, typing indicators, and user presence tracking.
