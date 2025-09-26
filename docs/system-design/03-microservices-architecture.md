# Microservices Architecture Design

## 🏗️ Architecture Overview

Our mini Facebook backend follows a **Domain-Driven Design (DDD)** approach with **Database per Service** pattern, where each service owns a specific business domain and its data.

## 🎯 Service Boundaries & Responsibilities

### Service Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Auth Service  │    │  User Service   │    │  Post Service   │
│   (Port 3100)   │    │  (Port 3200)    │    │  (Port 3300)    │
│                 │    │                 │    │                 │
│ • Authentication│    │ • Profile Mgmt  │    │ • Post Creation │
│ • Authorization │    │ • User Search   │    │ • Feed Algorithm│
│ • JWT Tokens    │    │ • Friends       │    │ • Comments      │
│ • Sessions      │    │ • Privacy       │    │ • Reactions     │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Auth DB     │ │    │ │ User DB     │ │    │ │ Post DB     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       ▼                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Message Service  │    │  Media Service  │    │ Search Service  │
│  (Port 3400)    │    │  (Port 3500)    │    │  (Port 3600)    │
│                 │    │                 │    │                 │
│ • Real-time Chat│    │ • File Upload   │    │ • Content Search│
│ • Notifications │    │ • Image Proc.   │    │ • User Search   │
│ • Push Notif.   │    │ • Video Trans.  │    │ • Elasticsearch │
│ • WebSockets    │    │ • CDN Integration│    │ • Auto-complete │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Message DB  │ │    │ │ Media DB    │ │    │ │ Elasticsearch│ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Notification    │
                    │ Service         │
                    │  (Port 3700)    │
                    │                 │
                    │ • Push Notif.   │
                    │ • Email Notif.  │
                    │ • In-app Notif. │
                    │                 │
                    │ ┌─────────────┐ │
                    │ │ Notification│ │
                    │ │ DB          │ │
                    │ └─────────────┘ │
                    └─────────────────┘
```

## 🔧 Service Specifications

### 1. Authentication Service
**Domain**: Security and access control  
**Database**: `auth_service_db` (PostgreSQL)  
**Port**: 3100

**Responsibilities**:
- User authentication (login/logout)
- JWT token management and validation
- Session handling and refresh tokens
- Password reset and email verification
- Multi-factor authentication (future)

**Database Tables**:
- `users` - User authentication data
- `sessions` - User sessions and tokens
- `refresh_tokens` - Refresh token management
- `password_resets` - Password reset tokens
- `email_verifications` - Email verification tokens

**API Endpoints**:
```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password
POST   /auth/verify-email
```

**Events Published**:
- `user.registered` - When user registers
- `user.login` - When user logs in
- `user.logout` - When user logs out

### 2. User Service
**Domain**: User profile and social connections  
**Database**: `user_service_db` (PostgreSQL)  
**Port**: 3200

**Responsibilities**:
- User profile management (CRUD)
- Friend connections and requests
- Privacy settings management
- User search and discovery
- Account management and deactivation

**Database Tables**:
- `users` - User profiles
- `privacy_settings` - Privacy configurations
- `friendships` - Friend relationships

**API Endpoints**:
```
GET    /users/profile
PUT    /users/profile
GET    /users/{id}
GET    /users/search
POST   /users/friends/request
PUT    /users/friends/{id}/accept
DELETE /users/friends/{id}
GET    /users/friends
```

**Events Published**:
- `user.profile.updated` - When profile is updated
- `friend.request.sent` - When friend request is sent
- `friend.request.accepted` - When friend request is accepted
- `friend.removed` - When friendship is removed

**Events Consumed**:
- `user.registered` - Create user profile
- `user.login` - Update last login time

### 3. Post Service
**Domain**: Content creation and social interactions  
**Database**: `post_service_db` (PostgreSQL)  
**Port**: 3300

**Responsibilities**:
- Post creation, editing, and deletion
- Comments system (nested comments)
- Reactions (likes, loves, etc.)
- News feed algorithm and generation
- Content privacy and audience management

**Database Tables**:
- `posts` - Posts and content
- `comments` - Comments on posts
- `reactions` - User reactions to posts/comments

**API Endpoints**:
```
GET    /posts/feed
POST   /posts
GET    /posts/{id}
PUT    /posts/{id}
DELETE /posts/{id}
POST   /posts/{id}/comments
GET    /posts/{id}/comments
POST   /posts/{id}/reactions
DELETE /posts/{id}/reactions
```

**Events Published**:
- `post.created` - When post is created
- `post.updated` - When post is updated
- `post.deleted` - When post is deleted
- `comment.added` - When comment is added
- `reaction.added` - When reaction is added

**Events Consumed**:
- `user.profile.updated` - Update user info in posts
- `friend.request.accepted` - Update feed visibility

### 4. Message Service
**Domain**: Real-time communication  
**Database**: `message_service_db` (PostgreSQL)  
**Port**: 3400

**Responsibilities**:
- Direct messaging between users
- Group conversations
- Real-time chat via WebSockets
- Message history and search
- Conversation management

**Database Tables**:
- `conversations` - Chat conversations
- `conversation_participants` - Who's in each conversation
- `messages` - Individual messages

**API Endpoints**:
```
GET    /messages/conversations
POST   /messages/conversations
GET    /messages/conversations/{id}/messages
POST   /messages/conversations/{id}/messages
PUT    /messages/{id}/read
DELETE /messages/{id}
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

**Events Published**:
- `message.sent` - When message is sent
- `conversation.created` - When conversation is created

**Events Consumed**:
- `friend.request.accepted` - Allow messaging between friends

### 5. Media Service
**Domain**: File and media management  
**Database**: `media_service_db` (PostgreSQL)  
**Port**: 3500

**Responsibilities**:
- File upload and storage (S3 integration)
- Image processing and resizing
- Video transcoding and thumbnails
- CDN integration for fast delivery
- Media metadata management

**Database Tables**:
- `media_files` - File information
- `media_metadata` - Additional metadata

**API Endpoints**:
```
POST   /media/upload
GET    /media/{id}
DELETE /media/{id}
POST   /media/batch-upload
GET    /media/user/{userId}
```

**Events Published**:
- `media.uploaded` - When file is uploaded
- `media.processed` - When processing is complete
- `media.deleted` - When file is deleted

### 6. Search Service
**Domain**: Content and user discovery  
**Database**: Elasticsearch indices  
**Port**: 3600

**Responsibilities**:
- Full-text search across posts and comments
- User search functionality
- Search suggestions and autocomplete
- Search analytics and trending
- Elasticsearch index management

**Elasticsearch Indices**:
- `posts` - Searchable post content
- `users` - Searchable user profiles
- `comments` - Searchable comment content

**API Endpoints**:
```
GET    /search/posts
GET    /search/users
GET    /search/suggestions
GET    /search/trending
POST   /search/analytics
```

**Events Consumed**:
- `post.created` - Index new post
- `post.updated` - Update post index
- `post.deleted` - Remove from index
- `user.profile.updated` - Update user index
- `comment.added` - Index new comment

### 7. Notification Service
**Domain**: User notifications and alerts  
**Database**: `notification_service_db` (PostgreSQL)  
**Port**: 3700

**Responsibilities**:
- Push notification delivery
- Email notifications (SMTP integration)
- In-app notifications
- Notification preferences management
- Notification history and analytics

**Database Tables**:
- `notifications` - Notification records
- `notification_preferences` - User preferences

**API Endpoints**:
```
GET    /notifications
PUT    /notifications/{id}/read
PUT    /notifications/preferences
POST   /notifications/mark-all-read
GET    /notifications/unread-count
```

**Events Consumed**:
- `post.liked` - Create like notification
- `comment.added` - Create comment notification
- `friend.request.sent` - Create friend request notification
- `message.sent` - Create message notification
- `user.registered` - Send welcome notification

## 🔄 Inter-Service Communication

### Event-Driven Communication (Primary)
**Pattern**: Services communicate through events via RabbitMQ

```typescript
// Example: Post creation flow
1. User Service: Validates user exists
2. Post Service: Creates post in its database
3. Post Service: Publishes "post.created" event
4. Search Service: Receives event, indexes post
5. Notification Service: Receives event, notifies followers
```

### Synchronous Communication (Limited)
**Use Cases**: Only for critical operations that need immediate consistency
- Authentication validation
- User existence checks
- Real-time data queries

```typescript
// Example: API Gateway validating user token
const user = await authService.validateToken(token);
if (!user) {
  return res.status(401).json({ error: 'Invalid token' });
}
```

## 🚫 Service Boundaries (What NOT to Do)

### ❌ Direct Database Access
```typescript
// DON'T: Post service accessing user database directly
const user = await userDatabase.findUser(userId); // Wrong!
```

### ❌ Direct Service Calls
```typescript
// DON'T: Synchronous service-to-service calls
const user = await userService.getUser(userId); // Creates tight coupling
const post = await postService.createPost({ ...postData, user });
```

### ❌ Shared Database
```sql
-- DON'T: Single database for all services
CREATE TABLE users (...);
CREATE TABLE posts (...);
CREATE TABLE messages (...);
-- This breaks microservices principles!
```

## ✅ Service Boundaries (What TO Do)

### ✅ Event-Driven Communication
```typescript
// DO: Publish events for async communication
await eventPublisher.publish('post.created', {
  postId: post.id,
  userId: post.userId,
  content: post.content,
  timestamp: new Date()
});
```

### ✅ Data Duplication for Performance
```typescript
// DO: Store necessary user data in post service
const post = {
  id: postId,
  userId: userId,
  user: {
    id: userId,
    username: userData.username, // Duplicated for performance
    firstName: userData.firstName // Duplicated for performance
  },
  content: content
};
```

### ✅ Database per Service
```sql
-- DO: Each service has its own database
-- Post Service Database (post_service_db)
CREATE TABLE posts (...);

-- User Service Database (user_service_db)
CREATE TABLE users (...);
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
    rabbitmq: 'up' | 'down';
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

### 1. Eventual Consistency (Primary)
For most operations, we use eventual consistency:

```typescript
// User updates profile
1. User Service: Updates user profile
2. User Service: Publishes "user.profile.updated" event
3. Post Service: Receives event, updates user info in posts (async)
4. Search Service: Receives event, updates search index (async)
```

### 2. Strong Consistency (Limited)
For critical operations requiring immediate consistency:

```typescript
// User authentication
1. Auth Service: Validates credentials (immediate)
2. Auth Service: Returns JWT token (immediate)
3. No async updates needed for authentication
```

### 3. Saga Pattern
For distributed transactions across services:

```typescript
// User registration saga
1. Auth Service: Create user account
2. User Service: Create user profile
3. Search Service: Index user
4. Notification Service: Send welcome email

// If any step fails, compensate previous steps
```

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
        - containerPort: 3200
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: user-service-secrets
              key: database-url
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: shared-secrets
              key: rabbitmq-url
```

### Service Discovery
- **Kubernetes Services**: Internal service discovery
- **Consul**: Service registry and health checking (optional)
- **Load Balancer**: External traffic distribution

This microservices architecture provides a scalable, maintainable foundation for our mini Facebook backend, with clear service boundaries, proper data ownership, and well-defined communication patterns.