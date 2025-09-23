# Microservices Architecture Design

## 🏗️ Architecture Overview

Our mini Facebook backend follows a **Domain-Driven Design (DDD)** approach with microservices, where each service owns a specific business domain and its data.

## 🎯 Service Boundaries

### Core Services
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Auth Service  │    │  User Service   │    │  Post Service   │
│                 │    │                 │    │                 │
│ • Authentication│    │ • Profile Mgmt  │    │ • Post Creation │
│ • Authorization │    │ • User Search   │    │ • Feed Algorithm│
│ • JWT Tokens    │    │ • Friends       │    │ • Comments      │
│ • Sessions      │    │ • Privacy       │    │ • Reactions     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Message Service  │    │  Media Service  │    │ Search Service  │
│                 │    │                 │    │                 │
│ • Real-time Chat│    │ • File Upload   │    │ • Content Search│
│ • Notifications │    │ • Image Proc.   │    │ • User Search   │
│ • Push Notif.   │    │ • Video Trans.  │    │ • Elasticsearch │
│ • WebSockets    │    │ • CDN Integration│    │ • Auto-complete │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Service Specifications

### 1. Authentication Service
**Domain**: Security and access control
**Responsibilities**:
- User authentication (login/logout)
- JWT token management
- Session handling
- Password management
- Multi-factor authentication

**Database**: `auth` schema
**Key Tables**: `sessions`, `refresh_tokens`, `password_resets`

**API Endpoints**:
```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password
```

### 2. User Service
**Domain**: User profile and social connections
**Responsibilities**:
- User profile management
- Friend connections
- Privacy settings
- User search and discovery
- Account management

**Database**: `users` schema
**Key Tables**: `users`, `friendships`, `user_privacy_settings`

**API Endpoints**:
```
GET    /users/profile
PUT    /users/profile
GET    /users/{id}
GET    /users/search
POST   /users/friends/request
GET    /users/friends
DELETE /users/friends/{id}
```

### 3. Post Service
**Domain**: Content creation and social interactions
**Responsibilities**:
- Post creation and management
- Comments system
- Reactions (likes, etc.)
- News feed algorithm
- Content privacy

**Database**: `posts` schema
**Key Tables**: `posts`, `comments`, `reactions`, `post_privacy`

**API Endpoints**:
```
GET    /posts/feed
POST   /posts
GET    /posts/{id}
PUT    /posts/{id}
DELETE /posts/{id}
POST   /posts/{id}/comments
POST   /posts/{id}/reactions
GET    /posts/{id}/comments
```

### 4. Message Service
**Domain**: Real-time communication
**Responsibilities**:
- Direct messaging
- Group conversations
- Real-time chat via WebSockets
- Message history
- Push notifications

**Database**: `messages` schema
**Key Tables**: `conversations`, `messages`, `conversation_participants`

**API Endpoints**:
```
GET    /messages/conversations
POST   /messages/conversations
GET    /messages/conversations/{id}/messages
POST   /messages/conversations/{id}/messages
PUT    /messages/{id}/read
```

**WebSocket Events**:
```
message.sent
message.received
typing.start
typing.stop
user.online
user.offline
```

### 5. Media Service
**Domain**: File and media management
**Responsibilities**:
- File upload and storage
- Image processing and resizing
- Video transcoding
- CDN integration
- Media metadata management

**Database**: `media` schema
**Key Tables**: `media_files`, `media_metadata`

**API Endpoints**:
```
POST   /media/upload
GET    /media/{id}
DELETE /media/{id}
POST   /media/batch-upload
GET    /media/user/{userId}
```

### 6. Search Service
**Domain**: Content and user discovery
**Responsibilities**:
- Full-text search across posts
- User search functionality
- Search suggestions and autocomplete
- Search analytics
- Elasticsearch integration

**Database**: Elasticsearch indices
**Key Indices**: `posts`, `users`, `comments`

**API Endpoints**:
```
GET    /search/posts
GET    /search/users
GET    /search/suggestions
GET    /search/trending
POST   /search/analytics
```

### 7. Notification Service
**Domain**: User notifications and alerts
**Responsibilities**:
- Push notification delivery
- Email notifications
- In-app notifications
- Notification preferences
- Notification history

**Database**: `notifications` schema
**Key Tables**: `notifications`, `notification_preferences`, `notification_templates`

**API Endpoints**:
```
GET    /notifications
PUT    /notifications/{id}/read
PUT    /notifications/preferences
POST   /notifications/mark-all-read
GET    /notifications/unread-count
```

## 🔄 Inter-Service Communication

### 1. Synchronous Communication (HTTP/REST)
**Use Cases**:
- User authentication validation
- Profile data retrieval
- Real-time data queries

**Pattern**: API Gateway → Service → Database

### 2. Asynchronous Communication (Events)
**Use Cases**:
- User registration events
- Post creation notifications
- Friend request updates
- Content moderation triggers

**Pattern**: Service → RabbitMQ → Event Handlers

### 3. Event-Driven Architecture

#### Event Types
```typescript
// User Events
interface UserRegisteredEvent {
  eventType: 'user.registered';
  userId: string;
  email: string;
  timestamp: Date;
}

interface UserProfileUpdatedEvent {
  eventType: 'user.profile.updated';
  userId: string;
  changes: string[];
  timestamp: Date;
}

// Post Events
interface PostCreatedEvent {
  eventType: 'post.created';
  postId: string;
  userId: string;
  content: string;
  timestamp: Date;
}

interface PostLikedEvent {
  eventType: 'post.liked';
  postId: string;
  userId: string;
  likerId: string;
  timestamp: Date;
}

// Message Events
interface MessageSentEvent {
  eventType: 'message.sent';
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
}
```

#### Event Flow Example
```
User Service → Post Created Event → RabbitMQ
                    ↓
            ┌─────────────────┐
            │ Notification    │
            │ Service         │
            └─────────────────┘
                    ↓
            ┌─────────────────┐
            │ Search Service  │
            │ (Index Post)    │
            └─────────────────┘
```

## 🚪 API Gateway

### Gateway Responsibilities
- **Authentication**: Validate JWT tokens
- **Rate Limiting**: Prevent abuse
- **Load Balancing**: Distribute requests
- **Request/Response Transformation**
- **Caching**: Cache frequent requests
- **Logging & Monitoring**

### Gateway Configuration
```yaml
routes:
  - path: /api/auth/*
    service: auth-service
    methods: [POST, PUT, DELETE]
    
  - path: /api/users/*
    service: user-service
    methods: [GET, POST, PUT, DELETE]
    
  - path: /api/posts/*
    service: post-service
    methods: [GET, POST, PUT, DELETE]
    
  - path: /api/messages/*
    service: message-service
    methods: [GET, POST, PUT, DELETE]
    
  - path: /api/media/*
    service: media-service
    methods: [GET, POST, DELETE]
    
  - path: /api/search/*
    service: search-service
    methods: [GET]
    
  - path: /api/notifications/*
    service: notification-service
    methods: [GET, PUT]
```

## 🔒 Security Architecture

### Service-to-Service Authentication
```typescript
// JWT-based service authentication
interface ServiceToken {
  serviceId: string;
  permissions: string[];
  expiresAt: Date;
}

// API Key for external services
interface APIKey {
  keyId: string;
  serviceId: string;
  permissions: string[];
  rateLimit: number;
}
```

### Data Isolation
- **Database per Service**: Each service has its own database
- **Encrypted Communication**: TLS between services
- **Access Control**: Role-based permissions
- **Audit Logging**: All service interactions logged

## 📊 Monitoring & Observability

### Service Health Checks
```typescript
interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  dependencies: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    elasticsearch: 'up' | 'down';
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
}
```

### Distributed Tracing
- **Request ID**: Track requests across services
- **Correlation ID**: Link related events
- **Performance Metrics**: Service-level monitoring
- **Error Tracking**: Centralized error logging

## 🔄 Data Consistency Patterns

### 1. Saga Pattern
For distributed transactions across services:

```typescript
// User Registration Saga
1. Auth Service: Create user account
2. User Service: Create user profile
3. Search Service: Index user
4. Notification Service: Send welcome email

// If any step fails, compensate previous steps
```

### 2. Event Sourcing
For audit trails and replay capabilities:

```typescript
// Post creation events
1. PostCreatedEvent
2. PostPublishedEvent
3. PostIndexedEvent
4. PostNotificationSentEvent
```

### 3. CQRS (Command Query Responsibility Segregation)
- **Commands**: Write operations (POST, PUT, DELETE)
- **Queries**: Read operations (GET)
- **Separate Models**: Optimized for each operation

## 🚀 Deployment Strategy

### Service Deployment
```yaml
# Kubernetes deployment example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: mini-facebook/user-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: user-service-secrets
              key: database-url
```

### Service Discovery
- **Kubernetes Services**: Internal service discovery
- **Consul**: Service registry and health checking
- **Load Balancer**: External traffic distribution

This microservices architecture provides a scalable, maintainable foundation for our mini Facebook backend, with clear service boundaries and well-defined communication patterns.
