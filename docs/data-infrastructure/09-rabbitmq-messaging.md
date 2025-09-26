# RabbitMQ Message Broker

## 🐰 Overview

RabbitMQ serves as our message broker for event-driven communication between microservices, handling asynchronous processing, and ensuring reliable message delivery in our mini Facebook backend.

## 🏗️ RabbitMQ Setup

### Connection Management
```typescript
// infrastructure/rabbitmq/connection.ts
import amqp, { Connection, Channel } from 'amqplib';
import { logger } from '@/shared/utils/logger';

class RabbitMQConnection {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      this.channel = await this.connection.createChannel();
      this.isConnected = true;
      
      logger.info('RabbitMQ connected successfully');
      
      // Handle connection errors
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
      });
    } catch (error) {
      logger.error('RabbitMQ connection failed:', error);
      throw error;
    }
  }

  getChannel(): Channel {
    if (!this.channel || !this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }
    return this.channel;
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    this.isConnected = false;
    logger.info('RabbitMQ connection closed');
  }
}

export const rabbitMQConnection = new RabbitMQConnection();
export const connectRabbitMQ = () => rabbitMQConnection.connect();
```

## 📨 Event-Driven Architecture

### Event Types
```typescript
// shared/types/events.ts
export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  source: string;
  version: string;
}

export interface UserRegisteredEvent extends BaseEvent {
  eventType: 'user.registered';
  userId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface UserProfileUpdatedEvent extends BaseEvent {
  eventType: 'user.profile.updated';
  userId: string;
  changes: string[];
  updatedFields: Record<string, any>;
}

export interface PostCreatedEvent extends BaseEvent {
  eventType: 'post.created';
  postId: string;
  userId: string;
  content: string;
  privacyLevel: string;
  tags: string[];
}

export interface PostLikedEvent extends BaseEvent {
  eventType: 'post.liked';
  postId: string;
  userId: string;
  likerId: string;
  reactionType: string;
}

export interface CommentAddedEvent extends BaseEvent {
  eventType: 'comment.added';
  commentId: string;
  postId: string;
  userId: string;
  content: string;
}

export interface FriendRequestSentEvent extends BaseEvent {
  eventType: 'friend.request.sent';
  fromUserId: string;
  toUserId: string;
  requestId: string;
}

export interface MessageSentEvent extends BaseEvent {
  eventType: 'message.sent';
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
}

export interface NotificationCreatedEvent extends BaseEvent {
  eventType: 'notification.created';
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
}

export type Event = 
  | UserRegisteredEvent
  | UserProfileUpdatedEvent
  | PostCreatedEvent
  | PostLikedEvent
  | CommentAddedEvent
  | FriendRequestSentEvent
  | MessageSentEvent
  | NotificationCreatedEvent;
```

## 🔧 Message Broker Service

### Event Publisher
```typescript
// infrastructure/rabbitmq/eventPublisher.ts
import { rabbitMQConnection } from './connection';
import { Event, BaseEvent } from '@/shared/types/events';
import { logger } from '@/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class EventPublisher {
  private channel = rabbitMQConnection.getChannel();
  private readonly EXCHANGE_NAME = 'mini-facebook.events';
  private readonly EXCHANGE_TYPE = 'topic';

  async initialize(): Promise<void> {
    await this.channel.assertExchange(this.EXCHANGE_NAME, this.EXCHANGE_TYPE, {
      durable: true
    });
  }

  async publishEvent(event: Omit<Event, keyof BaseEvent>, source: string): Promise<void> {
    const baseEvent: BaseEvent = {
      eventId: uuidv4(),
      eventType: event.eventType,
      timestamp: new Date(),
      source,
      version: '1.0'
    };

    const fullEvent = { ...baseEvent, ...event };
    const routingKey = this.getRoutingKey(event.eventType);

    try {
      await this.channel.publish(
        this.EXCHANGE_NAME,
        routingKey,
        Buffer.from(JSON.stringify(fullEvent)),
        {
          persistent: true,
          messageId: fullEvent.eventId,
          timestamp: fullEvent.timestamp.getTime()
        }
      );

      logger.info('Event published', {
        eventType: event.eventType,
        eventId: fullEvent.eventId,
        routingKey
      });
    } catch (error) {
      logger.error('Failed to publish event:', { event, error });
      throw error;
    }
  }

  private getRoutingKey(eventType: string): string {
    const parts = eventType.split('.');
    return parts.join('.');
  }

  // Convenience methods for common events
  async publishUserRegistered(userData: {
    userId: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    await this.publishEvent({
      eventType: 'user.registered',
      ...userData
    }, 'auth-service');
  }

  async publishPostCreated(postData: {
    postId: string;
    userId: string;
    content: string;
    privacyLevel: string;
    tags: string[];
  }): Promise<void> {
    await this.publishEvent({
      eventType: 'post.created',
      ...postData
    }, 'post-service');
  }

  async publishPostLiked(likeData: {
    postId: string;
    userId: string;
    likerId: string;
    reactionType: string;
  }): Promise<void> {
    await this.publishEvent({
      eventType: 'post.liked',
      ...likeData
    }, 'post-service');
  }

  async publishMessageSent(messageData: {
    messageId: string;
    conversationId: string;
    senderId: string;
    receiverId: string;
    content: string;
  }): Promise<void> {
    await this.publishEvent({
      eventType: 'message.sent',
      ...messageData
    }, 'message-service');
  }
}

export const eventPublisher = new EventPublisher();
```

### Event Consumer
```typescript
// infrastructure/rabbitmq/eventConsumer.ts
import { rabbitMQConnection } from './connection';
import { Event } from '@/shared/types/events';
import { logger } from '@/shared/utils/logger';

export class EventConsumer {
  private channel = rabbitMQConnection.getChannel();
  private readonly EXCHANGE_NAME = 'mini-facebook.events';
  private readonly EXCHANGE_TYPE = 'topic';

  async initialize(): Promise<void> {
    await this.channel.assertExchange(this.EXCHANGE_NAME, this.EXCHANGE_TYPE, {
      durable: true
    });
  }

  async subscribe(
    queueName: string,
    routingPatterns: string[],
    handler: (event: Event) => Promise<void>,
    options: {
      durable?: boolean;
      exclusive?: boolean;
      autoDelete?: boolean;
    } = {}
  ): Promise<void> {
    const queue = await this.channel.assertQueue(queueName, {
      durable: options.durable ?? true,
      exclusive: options.exclusive ?? false,
      autoDelete: options.autoDelete ?? false
    });

    // Bind queue to exchange with routing patterns
    for (const pattern of routingPatterns) {
      await this.channel.bindQueue(queue.queue, this.EXCHANGE_NAME, pattern);
    }

    // Set up consumer
    await this.channel.consume(queue.queue, async (msg) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString()) as Event;
        await handler(event);
        
        // Acknowledge message after successful processing
        this.channel.ack(msg);
        
        logger.info('Event processed successfully', {
          eventType: event.eventType,
          eventId: event.eventId
        });
      } catch (error) {
        logger.error('Event processing failed:', { error });
        
        // Reject and requeue message
        this.channel.nack(msg, false, true);
      }
    });

    logger.info('Event consumer subscribed', {
      queueName,
      routingPatterns
    });
  }
}

export const eventConsumer = new EventConsumer();
```

## 📦 End-to-End Example: User Creates a Post

1) Post Service writes to its own DB and publishes an event
```typescript
// services/post-service/publishers.ts
await eventPublisher.publishPostCreated({
  postId,
  userId,
  content,
  privacyLevel,
  tags
});
```

2) RabbitMQ routes `post.created` (topic) to interested queues
- `search-service-queue` → Search indexes the post
- `notification-service-queue` → Notifications for followers/owner (on later interactions)

3) Search Service consumes and indexes in Elasticsearch
```typescript
// services/search-service/eventHandlers.ts (excerpt)
await consumer.subscribe(
  'search-service-queue',
  ['post.created'],
  async (event) => {
    if (event.eventType !== 'post.created') return;
    // Fetch full post (author snapshot, tags, etc.) from Post Service API
    const post = await postApi.fetchById(event.postId);
    await postSearchService.indexPost(post);
  }
);
```

4) Later interactions publish more events (examples)
- `comment.added` → Search indexes comment; Notification notifies post owner
- `post.liked` → Notification creates like notification; Search may update popularity signals

Why this pattern
- Post API is fast and not blocked by Search/Notification work
- Consumers can scale independently (more Search workers for heavy indexing)
- If Search is down, messages buffer in `search-service-queue` until it recovers

## 🎯 Service-Specific Event Handlers

### Notification Service Handler
```typescript
// services/notification-service/eventHandlers.ts
import { EventConsumer } from '@/infrastructure/rabbitmq/eventConsumer';
import { Event } from '@/shared/types/events';
import { notificationService } from '../services/notificationService';
import { logger } from '@/shared/utils/logger';

export class NotificationEventHandlers {
  async handleUserRegistered(event: Extract<Event, { eventType: 'user.registered' }>): Promise<void> {
    await notificationService.createWelcomeNotification(event.userId);
    logger.info('Welcome notification created', { userId: event.userId });
  }

  async handlePostLiked(event: Extract<Event, { eventType: 'post.liked' }>): Promise<void> {
    // Don't notify if user likes their own post
    if (event.userId === event.likerId) return;

    await notificationService.createPostLikeNotification(
      event.userId,
      event.postId,
      event.likerId,
      event.reactionType
    );
  }

  async handleCommentAdded(event: Extract<Event, { eventType: 'comment.added' }>): Promise<void> {
    await notificationService.createCommentNotification(
      event.userId,
      event.postId,
      event.commentId
    );
  }

  async handleFriendRequestSent(event: Extract<Event, { eventType: 'friend.request.sent' }>): Promise<void> {
    await notificationService.createFriendRequestNotification(
      event.toUserId,
      event.fromUserId,
      event.requestId
    );
  }

  async handleMessageSent(event: Extract<Event, { eventType: 'message.sent' }>): Promise<void> {
    await notificationService.createMessageNotification(
      event.receiverId,
      event.senderId,
      event.messageId,
      event.conversationId
    );
  }

  async initializeHandlers(): Promise<void> {
    const consumer = new EventConsumer();
    await consumer.initialize();

    await consumer.subscribe(
      'notification-service-queue',
      [
        'user.registered',
        'post.liked',
        'comment.added',
        'friend.request.sent',
        'message.sent'
      ],
      async (event: Event) => {
        switch (event.eventType) {
          case 'user.registered':
            await this.handleUserRegistered(event as any);
            break;
          case 'post.liked':
            await this.handlePostLiked(event as any);
            break;
          case 'comment.added':
            await this.handleCommentAdded(event as any);
            break;
          case 'friend.request.sent':
            await this.handleFriendRequestSent(event as any);
            break;
          case 'message.sent':
            await this.handleMessageSent(event as any);
            break;
          default:
            logger.warn('Unknown event type:', { eventType: event.eventType });
        }
      }
    );
  }
}

export const notificationEventHandlers = new NotificationEventHandlers();
```

### Search Service Handler
```typescript
// services/search-service/eventHandlers.ts
import { EventConsumer } from '@/infrastructure/rabbitmq/eventConsumer';
import { Event } from '@/shared/types/events';
import { postSearchService } from '@/infrastructure/elasticsearch/postSearchService';
import { userSearchService } from '@/infrastructure/elasticsearch/userSearchService';
import { logger } from '@/shared/utils/logger';

export class SearchEventHandlers {
  async handleUserRegistered(event: Extract<Event, { eventType: 'user.registered' }>): Promise<void> {
    await userSearchService.indexUser({
      id: event.userId,
      username: event.username,
      firstName: event.firstName,
      lastName: event.lastName,
      email: event.email,
      isVerified: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async handleUserProfileUpdated(event: Extract<Event, { eventType: 'user.profile.updated' }>): Promise<void> {
    await userSearchService.updateUser(event.userId, event.updatedFields);
  }

  async handlePostCreated(event: Extract<Event, { eventType: 'post.created' }>): Promise<void> {
    await postSearchService.indexPost({
      id: event.postId,
      userId: event.userId,
      content: event.content,
      privacyLevel: event.privacyLevel,
      tags: event.tags,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        username: '',
        firstName: '',
        lastName: '',
        profilePicture: ''
      }
    });
  }

  async initializeHandlers(): Promise<void> {
    const consumer = new EventConsumer();
    await consumer.initialize();

    await consumer.subscribe(
      'search-service-queue',
      [
        'user.registered',
        'user.profile.updated',
        'post.created',
        'post.updated',
        'post.deleted'
      ],
      async (event: Event) => {
        switch (event.eventType) {
          case 'user.registered':
            await this.handleUserRegistered(event as any);
            break;
          case 'user.profile.updated':
            await this.handleUserProfileUpdated(event as any);
            break;
          case 'post.created':
            await this.handlePostCreated(event as any);
            break;
          default:
            logger.warn('Unknown event type:', { eventType: event.eventType });
        }
      }
    );
  }
}

export const searchEventHandlers = new SearchEventHandlers();
```

### User Service Event Handlers
```typescript
// services/user-service/eventHandlers.ts
export class UserEventHandlers {
  async initializeHandlers(): Promise<void> {
    const consumer = new EventConsumer();
    await consumer.initialize();

    await consumer.subscribe(
      'user-service-queue',
      [
        'user.registered',
        'friend.request.sent',
        'friend.request.accepted'
      ],
      async (event: Event) => {
        switch (event.eventType) {
          case 'user.registered':
            await this.handleUserRegistered(event as any);
            break;
          case 'friend.request.sent':
            await this.handleFriendRequestSent(event as any);
            break;
          case 'friend.request.accepted':
            await this.handleFriendRequestAccepted(event as any);
            break;
        }
      }
    );
  }

  private async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    // Create user profile in User Service database
    await this.userRepository.createProfile({
      userId: event.userId,
      email: event.email,
      username: event.username,
      firstName: event.firstName,
      lastName: event.lastName
    });
  }

  private async handleFriendRequestSent(event: FriendRequestSentEvent): Promise<void> {
    // Update friendship status in User Service database
    await this.friendshipRepository.updateStatus(event.requestId, 'pending');
  }
}
```

### Post Service Event Handlers
```typescript
// services/post-service/eventHandlers.ts
export class PostEventHandlers {
  async initializeHandlers(): Promise<void> {
    const consumer = new EventConsumer();
    await consumer.initialize();

    await consumer.subscribe(
      'post-service-queue',
      [
        'user.profile.updated',
        'friend.request.accepted'
      ],
      async (event: Event) => {
        switch (event.eventType) {
          case 'user.profile.updated':
            await this.handleUserProfileUpdated(event as any);
            break;
          case 'friend.request.accepted':
            await this.handleFriendRequestAccepted(event as any);
            break;
        }
      }
    );
  }

  private async handleUserProfileUpdated(event: UserProfileUpdatedEvent): Promise<void> {
    // Update user information in posts (denormalized data)
    await this.postRepository.updateUserInfo(event.userId, event.updatedFields);
  }

  private async handleFriendRequestAccepted(event: FriendRequestAcceptedEvent): Promise<void> {
    // Update feed visibility for new friends
    await this.feedService.updateFeedVisibility(event.user1Id, event.user2Id);
  }
}
```

### Message Service Event Handlers
```typescript
// services/message-service/eventHandlers.ts
export class MessageEventHandlers {
  async initializeHandlers(): Promise<void> {
    const consumer = new EventConsumer();
    await consumer.initialize();

    await consumer.subscribe(
      'message-service-queue',
      [
        'friend.request.accepted'
      ],
      async (event: Event) => {
        switch (event.eventType) {
          case 'friend.request.accepted':
            await this.handleFriendRequestAccepted(event as any);
            break;
        }
      }
    );
  }

  private async handleFriendRequestAccepted(event: FriendRequestAcceptedEvent): Promise<void> {
    // Enable messaging between new friends
    await this.conversationService.enableMessaging(event.user1Id, event.user2Id);
  }
}
```

### Media Service Event Handlers
```typescript
// services/media-service/eventHandlers.ts
export class MediaEventHandlers {
  async initializeHandlers(): Promise<void> {
    const consumer = new EventConsumer();
    await consumer.initialize();

    await consumer.subscribe(
      'media-service-queue',
      [
        'user.deleted'
      ],
      async (event: Event) => {
        switch (event.eventType) {
          case 'user.deleted':
            await this.handleUserDeleted(event as any);
            break;
        }
      }
    );
  }

  private async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    // Clean up user's media files
    await this.mediaService.deleteUserMedia(event.userId);
  }
}
```


## 🔄 Message Queues and Routing

### Queue Configuration
```typescript
// infrastructure/rabbitmq/queueConfig.ts
export const QUEUE_CONFIG = {
  // Notification service queues
  NOTIFICATION_QUEUE: {
    name: 'notification-service-queue',
    routingKeys: [
      'user.registered',
      'post.liked',
      'comment.added',
      'friend.request.sent',
      'message.sent'
    ],
    options: {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000, // 24 hours
        'x-max-retries': 3
      }
    }
  },

  // Search service queues
  SEARCH_QUEUE: {
    name: 'search-service-queue',
    routingKeys: [
      'user.registered',
      'user.profile.updated',
      'post.created',
      'post.updated',
      'post.deleted'
    ],
    options: {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000, // 1 hour
        'x-max-retries': 5
      }
    }
  },

  // Analytics service queues
  ANALYTICS_QUEUE: {
    name: 'analytics-service-queue',
    routingKeys: ['*.*'], // All events
    options: {
      durable: true,
      arguments: {
        'x-message-ttl': 604800000, // 7 days
        'x-max-retries': 1
      }
    }
  }
};
```

## 🛡️ Error Handling and Retry Logic

### Dead Letter Queue Setup
```typescript
// infrastructure/rabbitmq/deadLetterQueue.ts
import { rabbitMQConnection } from './connection';
import { logger } from '@/shared/utils/logger';

export class DeadLetterQueueManager {
  private channel = rabbitMQConnection.getChannel();
  private readonly DLX_NAME = 'mini-facebook.dlx';
  private readonly DLQ_NAME = 'mini-facebook.dlq';

  async setupDeadLetterQueue(): Promise<void> {
    // Create dead letter exchange
    await this.channel.assertExchange(this.DLX_NAME, 'direct', {
      durable: true
    });

    // Create dead letter queue
    await this.channel.assertQueue(this.DLQ_NAME, {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000, // 24 hours
        'x-max-length': 10000
      }
    });

    // Bind DLQ to DLX
    await this.channel.bindQueue(this.DLQ_NAME, this.DLX_NAME, '');

    // Set up DLQ consumer for monitoring
    await this.channel.consume(this.DLQ_NAME, (msg) => {
      if (msg) {
        logger.error('Message sent to dead letter queue:', {
          content: msg.content.toString(),
          headers: msg.properties.headers
        });
        this.channel.ack(msg);
      }
    });

    logger.info('Dead letter queue setup completed');
  }
}

export const deadLetterQueueManager = new DeadLetterQueueManager();
```

## 📊 Monitoring and Metrics

### Message Broker Monitoring
```typescript
// infrastructure/rabbitmq/monitoring.ts
import { rabbitMQConnection } from './connection';
import { logger } from '@/shared/utils/logger';

export class MessageBrokerMonitoring {
  private channel = rabbitMQConnection.getChannel();

  async getQueueStats(queueName: string): Promise<any> {
    try {
      const queue = await this.channel.checkQueue(queueName);
      return {
        messageCount: queue.messageCount,
        consumerCount: queue.consumerCount,
        queueName
      };
    } catch (error) {
      logger.error('Failed to get queue stats:', { queueName, error });
      return null;
    }
  }

  async getAllQueueStats(): Promise<any[]> {
    const queues = [
      'notification-service-queue',
      'search-service-queue',
      'analytics-service-queue',
      'mini-facebook.dlq'
    ];

    const stats = await Promise.all(
      queues.map(queue => this.getQueueStats(queue))
    );

    return stats.filter(stat => stat !== null);
  }

  async startMonitoring(): Promise<void> {
    setInterval(async () => {
      try {
        const stats = await this.getAllQueueStats();
        logger.info('Queue statistics:', { stats });
      } catch (error) {
        logger.error('Monitoring error:', error);
      }
    }, 60000); // Every minute
  }
}

export const messageBrokerMonitoring = new MessageBrokerMonitoring();
```

## 📋 Complete Event Catalog

### All Events by Service

#### Auth Service Events (Published)
- `user.registered` - New user registration
- `user.login` - User login
- `user.logout` - User logout

#### User Service Events (Published)
- `user.profile.updated` - Profile information updated
- `friend.request.sent` - Friend request sent
- `friend.request.accepted` - Friend request accepted
- `friend.removed` - Friendship removed
- `user.deleted` - User account deleted

#### User Service Events (Consumed)
- `user.registered` - Create user profile

#### Post Service Events (Published)
- `post.created` - New post created
- `post.updated` - Post updated
- `post.deleted` - Post deleted
- `comment.added` - Comment added to post
- `post.liked` - Post received reaction

#### Post Service Events (Consumed)
- `user.profile.updated` - Update user info in posts
- `friend.request.accepted` - Update feed visibility

#### Message Service Events (Published)
- `message.sent` - Message sent
- `conversation.created` - New conversation created

#### Message Service Events (Consumed)
- `friend.request.accepted` - Enable messaging between friends

#### Media Service Events (Published)
- `media.uploaded` - File uploaded
- `media.processed` - Media processing complete
- `media.deleted` - File deleted

#### Media Service Events (Consumed)
- `user.deleted` - Clean up user media files

#### Search Service Events (Consumed)
- `user.registered` - Index new user
- `user.profile.updated` - Update user index
- `user.deleted` - Remove from search index
- `post.created` - Index new post
- `post.updated` - Update post index
- `post.deleted` - Remove from search index
- `comment.added` - Index new comment

#### Notification Service Events (Consumed)
- `user.registered` - Send welcome notification
- `post.liked` - Create like notification
- `comment.added` - Create comment notification
- `friend.request.sent` - Create friend request notification
- `message.sent` - Create message notification

This RabbitMQ implementation provides reliable event-driven communication between microservices with proper error handling, monitoring, and scalability features for our mini Facebook backend.
