# Database Design - Microservices Architecture

## 🗄️ Database per Service Pattern

In a proper microservices architecture, each service owns its database. This ensures **data independence**, **loose coupling**, and **scalability**.

## 🏗️ Service-Specific Database Schemas

### 1. Auth Service Database
```sql
-- auth_service_db
-- Purpose: Authentication, authorization, sessions

-- Create database
CREATE DATABASE auth_service_db;
\c auth_service_db;

-- Users table (minimal for authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Password resets
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email verifications
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX idx_email_verifications_token ON email_verifications(token_hash);
```

### 2. User Service Database
```sql
-- user_service_db
-- Purpose: User profiles, friendships, privacy settings

-- Create database
CREATE DATABASE user_service_db;
\c user_service_db;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    profile_picture_url TEXT,
    cover_photo_url TEXT,
    bio TEXT,
    date_of_birth DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
    phone_number VARCHAR(20),
    location VARCHAR(255),
    website VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Privacy settings
CREATE TABLE privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    profile_visibility VARCHAR(20) DEFAULT 'friends' CHECK (profile_visibility IN ('public', 'friends', 'private')),
    email_visibility VARCHAR(20) DEFAULT 'friends' CHECK (email_visibility IN ('public', 'friends', 'private')),
    phone_visibility VARCHAR(20) DEFAULT 'private' CHECK (phone_visibility IN ('public', 'friends', 'private')),
    search_visibility VARCHAR(20) DEFAULT 'public' CHECK (search_visibility IN ('public', 'friends', 'private')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friendships
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT friendships_different_users CHECK (user1_id != user2_id),
    UNIQUE(user1_id, user2_id)
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_friendships_user1_id ON friendships(user1_id);
CREATE INDEX idx_friendships_user2_id ON friendships(user2_id);
CREATE INDEX idx_friendships_status ON friendships(status);
```

### 3. Post Service Database
```sql
-- post_service_db
-- Purpose: Posts, comments, reactions

-- Create database
CREATE DATABASE post_service_db;
\c post_service_db;

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Reference to user service
    content TEXT NOT NULL,
    media_urls TEXT[] DEFAULT '{}',
    location VARCHAR(255),
    privacy_level VARCHAR(20) DEFAULT 'friends' CHECK (privacy_level IN ('public', 'friends', 'custom')),
    tags TEXT[] DEFAULT '{}',
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT posts_content_not_empty CHECK (char_length(trim(content)) > 0)
);

-- Comments
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- Reference to user service
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT comments_content_not_empty CHECK (char_length(trim(content)) > 0)
);

-- Reactions
CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Reference to user service
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('like', 'love', 'laugh', 'angry', 'sad')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT reactions_target_check CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),
    UNIQUE(user_id, post_id, type),
    UNIQUE(user_id, comment_id, type)
);

-- Indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_privacy_level ON posts(privacy_level);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_reactions_user_id ON reactions(user_id);
CREATE INDEX idx_reactions_post_id ON reactions(post_id);
CREATE INDEX idx_reactions_comment_id ON reactions(comment_id);
```

### 4. Message Service Database
```sql
-- message_service_db
-- Purpose: Direct messages, conversations

-- Create database
CREATE DATABASE message_service_db;
\c message_service_db;

-- Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    name VARCHAR(255), -- For group conversations
    created_by VARCHAR(255) NOT NULL, -- Reference to user service
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- Reference to user service
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(255) NOT NULL, -- Reference to user service
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'file')),
    media_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT messages_content_not_empty CHECK (char_length(trim(content)) > 0)
);

-- Indexes
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

### 5. Media Service Database
```sql
-- media_service_db
-- Purpose: File uploads, media metadata

-- Create database
CREATE DATABASE media_service_db;
\c media_service_db;

-- Media files
CREATE TABLE media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Reference to user service
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('image', 'video', 'audio', 'document')),
    width INTEGER,
    height INTEGER,
    duration INTEGER, -- For video/audio files
    thumbnail_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media metadata
CREATE TABLE media_metadata (
    media_id UUID PRIMARY KEY REFERENCES media_files(id) ON DELETE CASCADE,
    title VARCHAR(255),
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    alt_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_media_files_user_id ON media_files(user_id);
CREATE INDEX idx_media_files_file_type ON media_files(file_type);
CREATE INDEX idx_media_files_created_at ON media_files(created_at DESC);
CREATE INDEX idx_media_files_is_public ON media_files(is_public);
```

### 6. Notification Service Database
```sql
-- notification_service_db
-- Purpose: Notifications, notification preferences

-- Create database
CREATE DATABASE notification_service_db;
\c notification_service_db;

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Reference to user service
    type VARCHAR(50) NOT NULL CHECK (type IN ('friend_request', 'like', 'comment', 'mention', 'message', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE notification_preferences (
    user_id VARCHAR(255) PRIMARY KEY, -- Reference to user service
    email_notifications JSONB DEFAULT '{"friend_requests": true, "post_likes": false, "comments": true, "messages": true}',
    push_notifications JSONB DEFAULT '{"friend_requests": true, "post_likes": true, "comments": true, "messages": true}',
    in_app_notifications JSONB DEFAULT '{"friend_requests": true, "post_likes": true, "comments": true, "messages": true}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

## 🔄 Data Consistency Patterns

### Eventual Consistency Through Events
Since each service has its own database, we achieve consistency through **events**:

```
1. User Service: User creates post
2. User Service: Publishes "User Created Post" event
3. Post Service: Receives event, creates post
4. Post Service: Publishes "Post Created" event
5. Search Service: Receives event, indexes post
6. Notification Service: Receives event, notifies followers
```

### Data Duplication Strategy
Some data is intentionally duplicated across services:

```typescript
// User data in Post Service (denormalized)
interface PostWithUser {
  id: string;
  content: string;
  user: {
    id: string;        // Reference to User Service
    username: string;  // Duplicated for performance
    firstName: string; // Duplicated for performance
    profilePicture: string; // Duplicated for performance
  };
  createdAt: Date;
}
```

## 🚫 What NOT to Do

### ❌ Shared Database
```sql
-- DON'T DO THIS - Single database for all services
CREATE TABLE users (...);
CREATE TABLE posts (...);
CREATE TABLE messages (...);
-- This creates tight coupling!
```

### ❌ Direct Service Calls
```typescript
// DON'T DO THIS - Direct service-to-service calls
const user = await userService.getUser(userId);
const post = await postService.createPost({ ...postData, user });
```

### ❌ Cross-Service Queries
```sql
-- DON'T DO THIS - Joining across service boundaries
SELECT p.*, u.username 
FROM posts p 
JOIN users u ON p.user_id = u.id; -- Different databases!
```

## ✅ What TO Do

### ✅ Event-Driven Communication
```typescript
// DO THIS - Event-driven communication
await eventPublisher.publishPostCreated({
  postId: post.id,
  userId: post.userId,
  content: post.content
});
```

### ✅ Data Denormalization
```typescript
// DO THIS - Store necessary user data in post service
const post = {
  id: postId,
  userId: userId,
  user: {
    id: userId,
    username: userData.username, // Denormalized
    firstName: userData.firstName // Denormalized
  },
  content: content
};
```

### ✅ Service-Specific Queries
```sql
-- DO THIS - Query within service boundaries
SELECT p.*, p.user_data 
FROM posts p 
WHERE p.user_id = $1;
```

## 🔧 Database Setup Commands

### Development Setup
```bash
# Create databases for each service
createdb auth_service_db
createdb user_service_db
createdb post_service_db
createdb message_service_db
createdb media_service_db
createdb notification_service_db

# Run migrations for each service
npm run migrate:auth
npm run migrate:user
npm run migrate:post
npm run migrate:message
npm run migrate:media
npm run migrate:notification
```

### Docker Setup
```yaml
# docker-compose.yml
services:
  auth-db:
    image: postgres:15
    environment:
      POSTGRES_DB: auth_service_db
    volumes:
      - auth_db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  user-db:
    image: postgres:15
    environment:
      POSTGRES_DB: user_service_db
    volumes:
      - user_db_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"

  post-db:
    image: postgres:15
    environment:
      POSTGRES_DB: post_service_db
    volumes:
      - post_db_data:/var/lib/postgresql/data
    ports:
      - "5434:5432"

  message-db:
    image: postgres:15
    environment:
      POSTGRES_DB: message_service_db
    volumes:
      - message_db_data:/var/lib/postgresql/data
    ports:
      - "5435:5432"

  media-db:
    image: postgres:15
    environment:
      POSTGRES_DB: media_service_db
    volumes:
      - media_db_data:/var/lib/postgresql/data
    ports:
      - "5436:5432"

  notification-db:
    image: postgres:15
    environment:
      POSTGRES_DB: notification_service_db
    volumes:
      - notification_db_data:/var/lib/postgresql/data
    ports:
      - "5437:5432"

volumes:
  auth_db_data:
  user_db_data:
  post_db_data:
  message_db_data:
  media_db_data:
  notification_db_data:
```

This database design properly implements the **Database per Service** pattern, ensuring each microservice owns its data and maintains loose coupling through events.