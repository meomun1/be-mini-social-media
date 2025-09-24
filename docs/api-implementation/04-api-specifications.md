# API Specifications

## 🌐 API Overview

This document defines the REST API specifications for our mini Facebook backend. All APIs follow RESTful conventions and use JSON for data exchange.

## 🔧 API Gateway Configuration

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

## 🔐 Authentication Service API

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

## 👤 User Service API

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

## 📝 Post Service API

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

## 💬 Message Service API

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

## 📁 Media Service API

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

## 🔍 Search Service API

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

## 🔔 Notification Service API

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

This API specification provides a comprehensive foundation for building our mini Facebook backend, with clear endpoints, request/response formats, and security considerations.
