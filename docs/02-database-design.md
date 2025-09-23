# Database Design Specification

## 🗄️ Database Architecture Overview

Our mini Facebook backend uses **PostgreSQL** as the primary database with **Redis** for caching and **Elasticsearch** for search functionality.

## 📊 Entity Relationship Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Users    │    │   Posts     │    │  Comments   │
│─────────────│    │─────────────│    │─────────────│
│ id (PK)     │    │ id (PK)     │    │ id (PK)     │
│ email       │◄───┤ user_id (FK)│    │ post_id (FK)│
│ username    │    │ content     │    │ user_id (FK)│
│ password    │    │ media_urls  │    │ content     │
│ profile_pic │    │ created_at  │    │ created_at  │
│ created_at  │    │ updated_at  │    │ updated_at  │
│ updated_at  │    │ privacy     │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Friendships │    │ Reactions   │    │ Messages    │
│─────────────│    │─────────────│    │─────────────│
│ id (PK)     │    │ id (PK)     │    │ id (PK)     │
│ user1_id(FK)│    │ user_id (FK)│    │ sender_id   │
│ user2_id(FK)│    │ post_id (FK)│    │ receiver_id │
│ status      │    │ type        │    │ content     │
│ created_at  │    │ created_at  │    │ created_at  │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 👤 Core Entities

### 1. Users Table
```sql
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
    gender VARCHAR(20),
    phone_number VARCHAR(20),
    location VARCHAR(255),
    website VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    privacy_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_is_active ON users(is_active);
```

### 2. Posts Table
```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_urls TEXT[],
    location VARCHAR(255),
    privacy_level VARCHAR(20) DEFAULT 'friends', -- public, friends, custom
    tags TEXT[],
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_privacy_level ON posts(privacy_level);
CREATE INDEX idx_posts_is_published ON posts(is_published);
```

### 3. Comments Table
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
```

### 4. Friendships Table
```sql
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL, -- pending, accepted, blocked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

-- Indexes
CREATE INDEX idx_friendships_user1_id ON friendships(user1_id);
CREATE INDEX idx_friendships_user2_id ON friendships(user2_id);
CREATE INDEX idx_friendships_status ON friendships(status);
```

### 5. Reactions Table
```sql
CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- like, love, laugh, angry, sad
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, post_id, type),
    UNIQUE(user_id, comment_id, type),
    CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_reactions_user_id ON reactions(user_id);
CREATE INDEX idx_reactions_post_id ON reactions(post_id);
CREATE INDEX idx_reactions_comment_id ON reactions(comment_id);
CREATE INDEX idx_reactions_type ON reactions(type);
```

### 6. Messages Table
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, video, file
    media_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

### 7. Notifications Table
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- friend_request, like, comment, mention
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

### 8. Groups Table
```sql
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cover_photo_url TEXT,
    privacy_level VARCHAR(20) DEFAULT 'closed', -- open, closed, secret
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_groups_admin_id ON groups(admin_id);
CREATE INDEX idx_groups_privacy_level ON groups(privacy_level);
CREATE INDEX idx_groups_created_at ON groups(created_at DESC);
```

### 9. Group Members Table
```sql
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- admin, moderator, member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Indexes
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_role ON group_members(role);
```

## 🔍 Search & Indexing

### Elasticsearch Mapping
```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "content": { 
        "type": "text",
        "analyzer": "standard"
      },
      "user_id": { "type": "keyword" },
      "username": { 
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "tags": { "type": "keyword" },
      "created_at": { "type": "date" },
      "privacy_level": { "type": "keyword" }
    }
  }
}
```

## ⚡ Redis Caching Strategy

### Cache Keys Structure
```
user:{user_id}                    # User profile data
user:{user_id}:friends            # User's friends list
post:{post_id}                    # Post data with comments
feed:{user_id}:page:{page}        # User's news feed
session:{session_id}              # User session data
notification:{user_id}:unread     # Unread notifications count
```

### Cache TTL Strategy
- **User profiles**: 1 hour
- **Posts**: 30 minutes
- **Feed**: 15 minutes
- **Friends list**: 1 hour
- **Sessions**: 24 hours
- **Notifications**: 5 minutes

## 🔄 Data Consistency Patterns

### 1. Eventual Consistency
- **Read Replicas**: For read-heavy operations
- **Async Updates**: For non-critical data
- **Cache Invalidation**: Smart cache refresh strategies

### 2. Strong Consistency
- **User Authentication**: Immediate consistency required
- **Financial Data**: ACID transactions
- **Critical Updates**: Synchronous operations

### 3. Data Synchronization
- **PostgreSQL → Elasticsearch**: Async indexing
- **PostgreSQL → Redis**: Cache warming strategies
- **Cross-service**: Event-driven updates

## 📈 Performance Optimizations

### Database Indexes
- **Composite Indexes**: For complex queries
- **Partial Indexes**: For filtered queries
- **Covering Indexes**: To avoid table lookups

### Query Optimization
- **Connection Pooling**: PgBouncer for connection management
- **Query Analysis**: EXPLAIN ANALYZE for optimization
- **Prepared Statements**: For repeated queries

### Partitioning Strategy
```sql
-- Partition posts table by date
CREATE TABLE posts_2024 PARTITION OF posts
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Partition messages by conversation
CREATE TABLE messages_part_1 PARTITION OF messages
FOR VALUES WITH (modulus 4, remainder 0);
```

## 🔒 Data Security & Privacy

### Encryption
- **At Rest**: Database-level encryption
- **In Transit**: TLS/SSL for all connections
- **Application Level**: Sensitive data encryption

### Access Control
- **Row Level Security**: User data isolation
- **Column Encryption**: PII protection
- **Audit Logging**: Data access tracking

### Data Retention
- **User Data**: Configurable retention policies
- **Logs**: 90-day retention
- **Backups**: Encrypted, versioned storage

## 📊 Analytics Schema

### User Analytics
```sql
CREATE TABLE user_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX idx_user_analytics_event_type ON user_analytics(event_type);
CREATE INDEX idx_user_analytics_created_at ON user_analytics(created_at);
```

This database design provides a solid foundation for our mini Facebook backend, ensuring scalability, performance, and data integrity while supporting all the core features we've defined.
