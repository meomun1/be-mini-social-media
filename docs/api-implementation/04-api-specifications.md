# API Specifications

## 🌐 API Overview

This document defines the REST API specifications for our mini Facebook backend microservices. All APIs follow RESTful conventions and use JSON for data exchange. Each service has its own API endpoints and communicates through events.

## 🏗️ Microservices Architecture

### Service Endpoints
```
API Gateway: http://localhost:3000/api/v1
├── Auth Service: http://localhost:3100/api/v1/auth
├── User Service: http://localhost:3200/api/v1/users  
├── Post Service: http://localhost:3300/api/v1/posts
├── Message Service: http://localhost:3400/api/v1/messages
├── Media Service: http://localhost:3500/api/v1/media
├── Search Service: http://localhost:3600/api/v1/search
└── Notification Service: http://localhost:3700/api/v1/notifications
```

### API Gateway Configuration

### Base URL Structure
```
Production: https://api.minifacebook.com/v1
Development: http://localhost:3000/api/v1
```

### Common Headers
```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-Request-ID: <unique_request_id>
X-Client-Version: 1.0.0
```

### Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

## 🔐 Authentication Service API (Port 3100)

**Database**: `auth_service_db`  
**Responsibilities**: Authentication, authorization, sessions, password resets

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid-123",
    "email": "user@example.com",
    "username": "johndoe",
    "isVerified": false,
    "verificationToken": "token-123"
  },
  "message": "User registered successfully. Please verify your email."
}
```

### POST /auth/login
Authenticate user and return JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "rememberMe": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid-123",
      "email": "user@example.com",
      "username": "johndoe",
      "firstName": "John",
      "lastName": "Doe",
      "profilePicture": "https://cdn.example.com/profile.jpg"
    }
  }
}
```

### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### POST /auth/logout
Logout user and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /auth/forgot-password
Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### POST /auth/reset-password
Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset-token-123",
  "newPassword": "NewSecurePassword123!"
}
```

### POST /auth/verify-email
Verify user email address.

**Request Body:**
```json
{
  "token": "verification-token-123"
}
```

### POST /auth/validate
Validate JWT token (Internal API for cross-service authentication).

**Headers:** `Authorization: Bearer <service_token>`

**Request Body:**
```json
{
  "token": "user-jwt-token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-123",
      "email": "user@example.com",
      "username": "johndoe",
      "role": "user"
    },
    "valid": true,
    "expiresAt": "2024-01-15T11:30:00Z"
  }
}
```

### GET /auth/users/{userId}
Get user information by ID (Internal API for cross-service calls).

**Headers:** `Authorization: Bearer <service_token>`

**Path Parameters:**
- `userId` (string): User ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isVerified": true,
    "isActive": true
  }
}
```

## 👤 User Service API (Port 3200)

**Database**: `user_service_db`  
**Responsibilities**: User profiles, friendships, privacy settings, user search

### GET /users/profile
Get current user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "profilePicture": "https://cdn.example.com/profile.jpg",
    "coverPhoto": "https://cdn.example.com/cover.jpg",
    "bio": "Software developer and tech enthusiast",
    "location": "San Francisco, CA",
    "website": "https://johndoe.com",
    "dateOfBirth": "1990-01-15",
    "gender": "male",
    "isVerified": true,
    "privacySettings": {
      "profileVisibility": "friends",
      "emailVisibility": "friends",
      "phoneVisibility": "private"
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### PUT /users/profile
Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Updated bio",
  "location": "New York, NY",
  "website": "https://newwebsite.com",
  "privacySettings": {
    "profileVisibility": "public",
    "emailVisibility": "friends"
  }
}
```

### GET /users/{userId}
Get public user profile by ID.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-456",
    "username": "janedoe",
    "firstName": "Jane",
    "lastName": "Doe",
    "profilePicture": "https://cdn.example.com/profile2.jpg",
    "bio": "Artist and designer",
    "location": "Los Angeles, CA",
    "isVerified": false,
    "isFriend": true,
    "friendRequestStatus": "accepted",
    "mutualFriends": 5
  }
}
```

### GET /users/search
Search users by name or username.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q` (string): Search query
- `limit` (number): Results limit (default: 20)
- `offset` (number): Results offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid-456",
        "username": "janedoe",
        "firstName": "Jane",
        "lastName": "Doe",
        "profilePicture": "https://cdn.example.com/profile2.jpg",
        "mutualFriends": 5,
        "isFriend": false
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### POST /users/friends/request
Send friend request.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "uuid-456"
}
```

### GET /users/friends
Get user's friends list.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (number): Results limit (default: 50)
- `offset` (number): Results offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "friends": [
      {
        "id": "uuid-456",
        "username": "janedoe",
        "firstName": "Jane",
        "lastName": "Doe",
        "profilePicture": "https://cdn.example.com/profile2.jpg",
        "isOnline": true,
        "lastSeen": "2024-01-15T10:25:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### PUT /users/friends/{id}/accept
Accept friend request.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "friendshipId": "friendship-123",
    "status": "accepted",
    "acceptedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Friend request accepted"
}
```

### DELETE /users/friends/{id}
Remove friend or reject friend request.

**Headers:** `Authorization: Bearer <token>`

## 📝 Post Service API (Port 3300)

**Database**: `post_service_db`  
**Responsibilities**: Posts, comments, reactions, news feed algorithm

### GET /posts/feed
Get user's news feed.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (number): Results limit (default: 20)
- `offset` (number): Results offset (default: 0)
- `algorithm` (string): Feed algorithm ("chronological" | "algorithmic")

**Response:**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "post-123",
        "userId": "uuid-456",
        "user": {
          "username": "janedoe",
          "firstName": "Jane",
          "lastName": "Doe",
          "profilePicture": "https://cdn.example.com/profile2.jpg"
        },
        "content": "Beautiful sunset today! 🌅",
        "mediaUrls": ["https://cdn.example.com/sunset.jpg"],
        "location": "San Francisco, CA",
        "privacyLevel": "friends",
        "likeCount": 15,
        "commentCount": 3,
        "shareCount": 2,
        "userReaction": "like",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 1000,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### POST /posts
Create a new post.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Hello world! This is my first post.",
  "mediaUrls": ["https://cdn.example.com/image.jpg"],
  "location": "San Francisco, CA",
  "privacyLevel": "friends",
  "tags": ["first-post", "hello-world"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "post-123",
    "userId": "uuid-123",
    "content": "Hello world! This is my first post.",
    "mediaUrls": ["https://cdn.example.com/image.jpg"],
    "location": "San Francisco, CA",
    "privacyLevel": "friends",
    "tags": ["first-post", "hello-world"],
    "likeCount": 0,
    "commentCount": 0,
    "shareCount": 0,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /posts/{postId}
Get specific post by ID.

**Headers:** `Authorization: Bearer <token>`

### PUT /posts/{postId}
Update post content.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Updated post content"
}
```

### DELETE /posts/{postId}
Delete post.

**Headers:** `Authorization: Bearer <token>`

### POST /posts/{postId}/comments
Add comment to post.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Great post!",
  "parentCommentId": null
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "comment-123",
    "postId": "post-123",
    "userId": "uuid-123",
    "user": {
      "username": "johndoe",
      "firstName": "John",
      "lastName": "Doe",
      "profilePicture": "https://cdn.example.com/profile.jpg"
    },
    "content": "Great post!",
    "parentCommentId": null,
    "likeCount": 0,
    "replies": [],
    "createdAt": "2024-01-15T10:35:00Z"
  }
}
```

### GET /posts/{postId}/comments
Get post comments.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (number): Results limit (default: 20)
- `offset` (number): Results offset (default: 0)

### POST /posts/{postId}/reactions
Add reaction to post.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "type": "like"
}
```

**Available reaction types:** `like`, `love`, `laugh`, `angry`, `sad`

### DELETE /posts/{postId}/reactions
Remove reaction from post.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `type` (string): Reaction type to remove

## 💬 Message Service API (Port 3400)

**Database**: `message_service_db`  
**Responsibilities**: Direct messages, group conversations, real-time chat

### GET /messages/conversations
Get user's conversations.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (number): Results limit (default: 20)
- `offset` (number): Results offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv-123",
        "type": "direct",
        "participants": [
          {
            "id": "uuid-123",
            "username": "johndoe",
            "firstName": "John",
            "lastName": "Doe",
            "profilePicture": "https://cdn.example.com/profile.jpg",
            "isOnline": true
          },
          {
            "id": "uuid-456",
            "username": "janedoe",
            "firstName": "Jane",
            "lastName": "Doe",
            "profilePicture": "https://cdn.example.com/profile2.jpg",
            "isOnline": false,
            "lastSeen": "2024-01-15T10:25:00Z"
          }
        ],
        "lastMessage": {
          "id": "msg-123",
          "content": "Hey, how are you?",
          "senderId": "uuid-456",
          "createdAt": "2024-01-15T10:30:00Z"
        },
        "unreadCount": 2,
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### POST /messages/conversations
Create new conversation.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "participantIds": ["uuid-456"],
  "type": "direct"
}
```

### GET /messages/conversations/{conversationId}/messages
Get conversation messages.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (number): Results limit (default: 50)
- `offset` (number): Results offset (default: 0)
- `before` (string): Get messages before this timestamp

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg-123",
        "conversationId": "conv-123",
        "senderId": "uuid-456",
        "sender": {
          "username": "janedoe",
          "firstName": "Jane",
          "lastName": "Doe",
          "profilePicture": "https://cdn.example.com/profile2.jpg"
        },
        "content": "Hey, how are you?",
        "messageType": "text",
        "mediaUrl": null,
        "isRead": false,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### POST /messages/conversations/{conversationId}/messages
Send message to conversation.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "I'm doing great! Thanks for asking.",
  "messageType": "text",
  "mediaUrl": null
}
```

### PUT /messages/{messageId}/read
Mark message as read.

**Headers:** `Authorization: Bearer <token>`

### DELETE /messages/{messageId}
Delete message.

**Headers:** `Authorization: Bearer <token>`

## 📁 Media Service API (Port 3500)

**Database**: `media_service_db`  
**Responsibilities**: File uploads, media processing, CDN integration

### POST /media/upload
Upload media file.

**Headers:** `Authorization: Bearer <token>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: Media file (image, video, document)
- `type`: Media type ("profile", "post", "message")
- `metadata`: JSON string with additional metadata

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "media-123",
    "url": "https://cdn.example.com/uploads/media-123.jpg",
    "thumbnailUrl": "https://cdn.example.com/uploads/thumbnails/media-123.jpg",
    "type": "image",
    "size": 1024000,
    "dimensions": {
      "width": 1920,
      "height": 1080
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /media/{mediaId}
Get media metadata.

**Headers:** `Authorization: Bearer <token>`

### DELETE /media/{mediaId}
Delete media file.

**Headers:** `Authorization: Bearer <token>`

### POST /media/batch-upload
Upload multiple media files.

**Headers:** `Authorization: Bearer <token>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `files[]`: Array of media files
- `type`: Media type ("profile", "post", "message")

### GET /media/user/{userId}
Get user's media files.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `type` (string): Filter by media type
- `limit` (number): Results limit (default: 20)
- `offset` (number): Results offset (default: 0)

## 🔍 Search Service API (Port 3600)

**Database**: Elasticsearch indices  
**Responsibilities**: Full-text search, user search, search suggestions

### GET /search/posts
Search posts by content.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q` (string): Search query
- `limit` (number): Results limit (default: 20)
- `offset` (number): Results offset (default: 0)
- `filters` (object): Additional filters

**Response:**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "post-123",
        "userId": "uuid-456",
        "user": {
          "username": "janedoe",
          "firstName": "Jane",
          "lastName": "Doe",
          "profilePicture": "https://cdn.example.com/profile2.jpg"
        },
        "content": "Beautiful sunset today! 🌅",
        "highlightedContent": "Beautiful <mark>sunset</mark> today! 🌅",
        "likeCount": 15,
        "commentCount": 3,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### GET /search/users
Search users by name.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q` (string): Search query
- `limit` (number): Results limit (default: 20)
- `offset` (number): Results offset (default: 0)

### GET /search/suggestions
Get search suggestions.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q` (string): Partial search query

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "john doe",
      "jane smith", 
      "javascript tutorial"
    ]
  }
}
```

### GET /search/trending
Get trending search terms.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "trending": [
      { "term": "javascript", "count": 150 },
      { "term": "react", "count": 120 },
      { "term": "nodejs", "count": 100 }
    ]
  }
}
```

## 🔔 Notification Service API (Port 3700)

**Database**: `notification_service_db`  
**Responsibilities**: Push notifications, email notifications, notification preferences

### GET /notifications
Get user notifications.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (number): Results limit (default: 20)
- `offset` (number): Results offset (default: 0)
- `type` (string): Filter by notification type
- `unreadOnly` (boolean): Show only unread notifications

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif-123",
        "type": "friend_request",
        "title": "New Friend Request",
        "message": "Jane Doe sent you a friend request",
        "data": {
          "userId": "uuid-456",
          "actionUrl": "/users/uuid-456"
        },
        "isRead": false,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "unreadCount": 5,
    "pagination": {
      "total": 50,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### PUT /notifications/{notificationId}/read
Mark notification as read.

**Headers:** `Authorization: Bearer <token>`

### PUT /notifications/preferences
Update notification preferences.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": {
    "friendRequests": true,
    "postLikes": false,
    "comments": true,
    "messages": true
  },
  "push": {
    "friendRequests": true,
    "postLikes": true,
    "comments": true,
    "messages": true
  },
  "inApp": {
    "friendRequests": true,
    "postLikes": true,
    "comments": true,
    "messages": true
  }
}
```

### POST /notifications/mark-all-read
Mark all notifications as read.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "markedCount": 15,
    "message": "All notifications marked as read"
  }
}
```

### GET /notifications/unread-count
Get count of unread notifications.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

## 🔄 Event-Driven Communication

### Service Communication Events
Services communicate through RabbitMQ events instead of direct API calls:

```typescript
// Example: Post creation flow
1. User Service: Validates user exists
2. Post Service: Creates post in its database  
3. Post Service: Publishes "post.created" event
4. Search Service: Receives event, indexes post
5. Notification Service: Receives event, notifies followers
```

### Event Types
```typescript
// User Events
"user.registered" - User completes registration
"user.profile.updated" - User profile is updated
"user.deleted" - User account is deleted

// Friend Events  
"friend.request.sent" - Friend request is sent
"friend.request.accepted" - Friend request is accepted
"friend.removed" - Friendship is removed

// Post Events
"post.created" - New post is created
"post.updated" - Post content is updated
"post.deleted" - Post is deleted
"post.liked" - Post receives a reaction
"comment.added" - Comment is added to post

// Message Events
"message.sent" - Message is sent
"conversation.created" - New conversation is created

// Media Events
"media.uploaded" - Media file is uploaded
"media.processed" - Media processing is complete
"media.deleted" - Media file is deleted

// Notification Events
"notification.created" - New notification is created
"notification.read" - Notification is marked as read
```

## 📊 Rate Limiting

### Rate Limits
- **Authentication endpoints**: 5 requests/minute per IP
- **General API endpoints**: 100 requests/minute per user
- **Search endpoints**: 20 requests/minute per user
- **Upload endpoints**: 10 requests/minute per user

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

## 🔒 Security Considerations

### Authentication
- JWT tokens with 1-hour expiration
- Refresh tokens with 30-day expiration
- Token rotation on refresh

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- Privacy settings enforcement

### Input Validation
- Request body validation
- File upload validation
- SQL injection prevention
- XSS protection

### CORS Configuration
```json
{
  "origin": ["https://app.minifacebook.com", "https://admin.minifacebook.com"],
  "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  "allowedHeaders": ["Content-Type", "Authorization", "X-Request-ID"],
  "credentials": true
}
```

## 🔒 Service-to-Service Authentication

### JWT Service Tokens
Services authenticate with each other using service-specific JWT tokens:

```typescript
interface ServiceToken {
  serviceId: string;
  permissions: string[];
  expiresAt: Date;
}

// Example service token
{
  "serviceId": "post-service",
  "permissions": ["read:posts", "write:posts"],
  "expiresAt": "2024-01-15T11:30:00Z"
}
```

### Service Authentication Headers
```http
Authorization: Bearer <service_jwt_token>
X-Service-ID: post-service
X-Request-ID: <unique_request_id>
```

## 🚀 Deployment Configuration

### Service Discovery
```yaml
# docker-compose.yml
services:
  api-gateway:
    image: mini-facebook/gateway:latest
    ports:
      - "3000:3000"
    environment:
      - AUTH_SERVICE_URL=http://auth-service:3100
      - USER_SERVICE_URL=http://user-service:3200
      - POST_SERVICE_URL=http://post-service:3300
      - MESSAGE_SERVICE_URL=http://message-service:3400
      - MEDIA_SERVICE_URL=http://media-service:3500
      - SEARCH_SERVICE_URL=http://search-service:3600
      - NOTIFICATION_SERVICE_URL=http://notification-service:3700

  auth-service:
    image: mini-facebook/auth-service:latest
    ports:
      - "3100:3100"
    environment:
      - DATABASE_URL=postgresql://user:pass@auth-db:5432/auth_service_db
      - RABBITMQ_URL=amqp://rabbitmq:5672

  user-service:
    image: mini-facebook/user-service:latest
    ports:
      - "3200:3200"
    environment:
      - DATABASE_URL=postgresql://user:pass@user-db:5432/user_service_db
      - RABBITMQ_URL=amqp://rabbitmq:5672
```

This API specification provides a comprehensive foundation for building our mini Facebook backend microservices, with clear service boundaries, event-driven communication, and proper authentication mechanisms.
