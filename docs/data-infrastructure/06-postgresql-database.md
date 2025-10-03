# PostgreSQL Database Guide

## 🗄️ Overview

PostgreSQL serves as our primary relational database system, implementing the **"Database per Service"** pattern in our microservices architecture. Each microservice owns and manages its own PostgreSQL database, ensuring data isolation, independent scaling, and service autonomy.

## 🏗️ Microservices Database Architecture

### Database per Service Pattern
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Auth Service   │    │  User Service   │    │  Post Service   │
│  Port: 3100     │    │  Port: 3200     │    │  Port: 3300     │
│                 │    │                 │    │                 │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │   auth    │  │    │  │   users   │  │    │  │   posts   │  │
│  │ database  │  │    │  │ database  │  │    │  │ database  │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Message Service │
                    │  Port: 3400     │
                    │                 │
                    │  ┌───────────┐  │
                    │  │ messages  │  │
                    │  │ database  │  │
                    │  └───────────┘  │
                    └─────────────────┘
```

### Service Database Mapping
| Service | Database Name | Port | Purpose |
|---------|---------------|------|---------|
| **Auth Service** | `auth_db` | 3100 | User authentication, sessions, tokens |
| **User Service** | `users_db` | 3200 | User profiles, friendships, settings |
| **Post Service** | `posts_db` | 3300 | Posts, comments, reactions |
| **Message Service** | `messages_db` | 3400 | Direct messages, conversations |
| **Media Service** | `media_db` | 3500 | File uploads, media metadata |
| **Notification Service** | `notifications_db` | 3600 | User notifications, preferences |

## 🔧 Database Connection Management

### Shared Database Infrastructure
The infrastructure layer provides centralized database connection management through the `infrastructure/databases/` folder, which includes:

- **`connection.ts`** - DatabaseConnectionManager for managing multiple database pools
- **`baseRepository.ts`** - BaseRepository class with common CRUD operations
- **`migrations.ts`** - Migration management utilities
- **`seeders.ts`** - Database seeding utilities
- **`types.ts`** - Database-related TypeScript types

### DatabaseConnectionManager
```typescript
// infrastructure/databases/connection.ts
import { Pool, PoolClient } from 'pg';
import { createLogger } from '@shared/types';

export class DatabaseConnectionManager {
  private pools: Map<string, ConnectionPool> = new Map();
  
  async createConnection(serviceName: string, config: DatabaseConfig): Promise<Pool> {
    // Creates and manages database connection pools for each service
  }
  
  getPool(serviceName: string): Pool {
    // Returns the database pool for a specific service
  }
  
  async query<T>(serviceName: string, text: string, params?: any[]): Promise<T[]> {
    // Execute queries with automatic connection management
  }
  
  async transaction<T>(serviceName: string, callback: (client: PoolClient) => Promise<T>): Promise<T> {
    // Execute operations within a transaction
  }
}
```

### BaseRepository Class
```typescript
// infrastructure/databases/baseRepository.ts
export abstract class BaseRepository<T> {
  protected pool: Pool;
  protected tableName: string;

  constructor(pool: Pool, tableName: string) {
    this.pool = pool;
    this.tableName = tableName;
  }

  async findById(id: string): Promise<T | null> {
    // Find a record by ID
  }

  async findByField(field: string, value: any): Promise<T[]> {
    // Find records by a specific field
  }

  async insert(data: Partial<T>): Promise<T> {
    // Insert a new record
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    // Update a record by ID
  }

  async delete(id: string): Promise<boolean> {
    // Delete a record by ID
  }

  async findPaginated(limit: number, offset: number): Promise<{ items: T[]; total: number }> {
    // Get paginated results with total count
  }
}
```

### Usage in Services
```typescript
// services/auth-service/src/repositories/UserRepository.ts
import { BaseRepository } from '@infrastructure/databases';
import { getAuthDatabase } from '@infrastructure/databases';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(getAuthDatabase(), 'users');
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOneByField('email', email);
  }
}

class DatabaseConnection {
  private pool: Pool;
  private serviceName: string;
  private isConnected = false;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.pool = new Pool({
      connectionString: process.env[`${serviceName.toUpperCase()}_DATABASE_URL`],
      max: parseInt(process.env.DB_POOL_SIZE || '10'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    this.pool.on('error', (err) => {
      logger.error(`${serviceName} database error:`, err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info(`${this.serviceName} database connected successfully`);
    } catch (error) {
      logger.error(`${this.serviceName} database connection failed:`, error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      throw new Error(`${this.serviceName} database not connected`);
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`${this.serviceName} query executed`, { query: text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error(`${this.serviceName} database query error:`, error);
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    logger.info(`${this.serviceName} database connection closed`);
  }
}

// Service-specific database connections
export const authDb = new DatabaseConnection('auth');
export const usersDb = new DatabaseConnection('users');
export const postsDb = new DatabaseConnection('posts');
export const messagesDb = new DatabaseConnection('messages');
export const mediaDb = new DatabaseConnection('media');
export const notificationsDb = new DatabaseConnection('notifications');

export const connectDatabases = () => Promise.all([
  authDb.connect(),
  usersDb.connect(),
  postsDb.connect(),
  messagesDb.connect(),
  mediaDb.connect(),
  notificationsDb.connect()
]);
```

## 📊 Service-Specific Database Schemas

### 1. Auth Service Database (`auth_db`)
```sql
-- Create auth database
CREATE DATABASE auth_db;

-- Switch to auth database
\c auth_db;

-- Users table (minimal for authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_username_check CHECK (username ~* '^[a-zA-Z0-9_]{3,50}$'),
    CONSTRAINT users_password_length CHECK (char_length(password_hash) >= 60)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT sessions_token_hash_unique UNIQUE(token_hash)
);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT refresh_tokens_token_hash_unique UNIQUE(token_hash)
);

-- Indexes
-- Password resets
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email verifications
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token_hash);
```

### 2. User Service Database (`users_db`)
```sql
-- Create users database
CREATE DATABASE users_db;

-- Switch to users database
\c users_db;

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
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
    privacy_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Privacy settings (separate table for clarity and indexing)
CREATE TABLE IF NOT EXISTS privacy_settings (
    user_id UUID PRIMARY KEY,
    profile_visibility VARCHAR(20) DEFAULT 'friends' CHECK (profile_visibility IN ('public', 'friends', 'private')),
    email_visibility VARCHAR(20) DEFAULT 'friends' CHECK (email_visibility IN ('public', 'friends', 'private')),
    phone_visibility VARCHAR(20) DEFAULT 'private' CHECK (phone_visibility IN ('public', 'friends', 'private')),
    search_visibility VARCHAR(20) DEFAULT 'public' CHECK (search_visibility IN ('public', 'friends', 'private')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT privacy_settings_user_fk FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL,
    user2_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT friendships_different_users CHECK (user1_id != user2_id),
    UNIQUE(user1_id, user2_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_user1_id ON friendships(user1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user2_id ON friendships(user2_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
```

### 3. Post Service Database (`posts_db`)
```sql
-- Create posts database
CREATE DATABASE posts_db;

-- Switch to posts database
\c posts_db;

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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
    
    CONSTRAINT posts_content_not_empty CHECK (char_length(trim(content)) > 0),
    CONSTRAINT posts_like_count_positive CHECK (like_count >= 0),
    CONSTRAINT posts_comment_count_positive CHECK (comment_count >= 0),
    CONSTRAINT posts_share_count_positive CHECK (share_count >= 0)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT comments_content_not_empty CHECK (char_length(trim(content)) > 0),
    CONSTRAINT comments_like_count_positive CHECK (like_count >= 0)
);

-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_privacy_level ON posts(privacy_level);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions(post_id);
```

### 4. Message Service Database (`messages_db`)
```sql
-- Create messages database
CREATE DATABASE messages_db;

-- Switch to messages database
\c messages_db;

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    name VARCHAR(255),
    description TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(conversation_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'voice')),
    media_url TEXT,
    reply_to_message_id UUID REFERENCES messages(id),
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
```

### 5. Media Service Database (`media_db`)
```sql
-- Create media database
CREATE DATABASE media_db;

-- Switch to media database
\c media_db;

-- Media files table
CREATE TABLE IF NOT EXISTS media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('image', 'video', 'audio', 'document')),
    width INTEGER,
    height INTEGER,
    duration INTEGER, -- in seconds for video/audio
    thumbnail_path TEXT,
    metadata JSONB DEFAULT '{}',
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media collections table
CREATE TABLE IF NOT EXISTS media_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collection items table
CREATE TABLE IF NOT EXISTS collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES media_collections(id) ON DELETE CASCADE,
    media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(collection_id, media_file_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_files_user_id ON media_files(user_id);
CREATE INDEX IF NOT EXISTS idx_media_files_file_type ON media_files(file_type);
CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_collections_user_id ON media_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON collection_items(collection_id);
```

### 6. Notification Service Database (`notifications_db`)
```sql
-- Create notifications database
CREATE DATABASE notifications_db;

-- Switch to notifications database
\c notifications_db;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
```

## 🔧 Service-Specific Repository Implementation

### Auth Service Repository
```typescript
// services/auth-service/database/userRepository.ts
import { authDb } from '@/infrastructure/database/connection';
import { User, CreateUserRequest } from '@/shared/types/user';

export class AuthUserRepository {
  async create(userData: CreateUserRequest): Promise<User> {
    const query = `
      INSERT INTO users (email, username, password_hash)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [userData.email, userData.username, userData.passwordHash];
    const result = await authDb.query(query, values);
    return this.mapRowToUser(result.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await authDb.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    const result = await authDb.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const authUserRepository = new AuthUserRepository();
```

### User Service Repository
```typescript
// services/user-service/database/userProfileRepository.ts
import { usersDb } from '@/infrastructure/database/connection';
import { UserProfile, CreateUserProfileRequest } from '@/shared/types/user';

export class UserProfileRepository {
  async create(profileData: CreateUserProfileRequest): Promise<UserProfile> {
    const query = `
      INSERT INTO user_profiles (
        id, email, username, first_name, last_name,
        date_of_birth, gender, phone_number, location, website,
        privacy_settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const values = [
      profileData.id,
      profileData.email,
      profileData.username,
      profileData.firstName,
      profileData.lastName,
      profileData.dateOfBirth,
      profileData.gender,
      profileData.phoneNumber,
      profileData.location,
      profileData.website,
      JSON.stringify(profileData.privacySettings || {})
    ];

    const result = await usersDb.query(query, values);
    return this.mapRowToUserProfile(result.rows[0]);
  }

  async findById(id: string): Promise<UserProfile | null> {
    const query = 'SELECT * FROM user_profiles WHERE id = $1 AND is_active = true';
    const result = await usersDb.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUserProfile(result.rows[0]);
  }

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const setClause = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'privacySettings') {
          setClause.push(`privacy_settings = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          setClause.push(`${dbKey} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    });

    if (setClause.length === 0) {
      throw new Error('No updates provided');
    }

    values.push(id);
    const query = `
      UPDATE user_profiles 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount} AND is_active = true
      RETURNING *
    `;

    const result = await usersDb.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('User profile not found');
    }
    
    return this.mapRowToUserProfile(result.rows[0]);
  }

  private mapRowToUserProfile(row: any): UserProfile {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      profilePicture: row.profile_picture_url,
      coverPhoto: row.cover_photo_url,
      bio: row.bio,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      phoneNumber: row.phone_number,
      location: row.location,
      website: row.website,
      isVerified: row.is_verified,
      isActive: row.is_active,
      privacySettings: row.privacy_settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const userProfileRepository = new UserProfileRepository();
```

## 🔄 Cross-Service Data Synchronization

### Event-Driven Data Consistency
```typescript
// shared/services/dataSyncService.ts
import { eventPublisher } from '@/infrastructure/rabbitmq/eventPublisher';
import { logger } from '@/shared/utils/logger';

export class DataSyncService {
  // When user registers in Auth Service, sync to User Service
  async syncUserRegistration(userData: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    try {
      await eventPublisher.publishUserRegistered(userData);
      logger.info('User registration synced to User Service', { userId: userData.id });
    } catch (error) {
      logger.error('Failed to sync user registration:', error);
      throw error;
    }
  }

  // When user profile updates in User Service, sync to other services
  async syncUserProfileUpdate(userId: string, changes: string[], updatedFields: Record<string, any>): Promise<void> {
    try {
      await eventPublisher.publishEvent({
        eventType: 'user.profile.updated',
        userId,
        changes,
        updatedFields
      }, 'user-service');
      logger.info('User profile update synced', { userId, changes });
    } catch (error) {
      logger.error('Failed to sync user profile update:', error);
      throw error;
    }
  }
}

export const dataSyncService = new DataSyncService();
```

## 🚀 Database Migration Strategy

### Service-Specific Migrations
```typescript
// services/auth-service/database/migrations.ts
import { authDb } from '@/infrastructure/database/connection';
import { logger } from '@/shared/utils/logger';

export class AuthMigrations {
  async runMigrations(): Promise<void> {
    try {
      // Create users table
      await authDb.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create sessions table
      await authDb.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create indexes
      await authDb.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      await authDb.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
      await authDb.query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');

      logger.info('Auth service migrations completed');
    } catch (error) {
      logger.error('Auth service migration failed:', error);
      throw error;
    }
  }
}

export const authMigrations = new AuthMigrations();
```

## 🔍 Advanced Queries

### Complex Feed Algorithm
```sql
-- Advanced feed algorithm with engagement scoring
WITH user_engagement AS (
  SELECT 
    p.user_id,
    AVG(p.like_count + p.comment_count * 2) as avg_engagement
  FROM posts p
  WHERE p.created_at > NOW() - INTERVAL '30 days'
  GROUP BY p.user_id
),
post_scores AS (
  SELECT 
    p.*,
    ue.avg_engagement,
    CASE 
      WHEN p.created_at > NOW() - INTERVAL '1 hour' THEN 1.5
      WHEN p.created_at > NOW() - INTERVAL '1 day' THEN 1.2
      ELSE 1.0
    END as recency_multiplier,
    (p.like_count + p.comment_count * 2) * 
    COALESCE(ue.avg_engagement, 1) * 
    CASE 
      WHEN p.created_at > NOW() - INTERVAL '1 hour' THEN 1.5
      WHEN p.created_at > NOW() - INTERVAL '1 day' THEN 1.2
      ELSE 1.0
    END as engagement_score
  FROM posts p
  LEFT JOIN user_engagement ue ON p.user_id = ue.user_id
  WHERE p.is_published = true
    AND p.privacy_level IN ('public', 'friends')
    AND p.created_at > NOW() - INTERVAL '7 days'
)
SELECT * FROM post_scores
ORDER BY engagement_score DESC, created_at DESC
LIMIT 20;
```

### Friendship Recommendations
```sql
-- Find mutual friends for friend recommendations
WITH mutual_friends AS (
  SELECT 
    f2.user1_id as recommended_user_id,
    COUNT(*) as mutual_friend_count
  FROM friendships f1
  JOIN friendships f2 ON (
    (f1.user1_id = f2.user1_id OR f1.user2_id = f2.user1_id) AND
    f2.user1_id != $1
  )
  WHERE f1.status = 'accepted'
    AND f2.status = 'accepted'
    AND (f1.user1_id = $1 OR f1.user2_id = $1)
    AND f2.user1_id != $1
  GROUP BY f2.user1_id
)
SELECT 
  u.id,
  u.username,
  u.first_name,
  u.last_name,
  u.profile_picture_url,
  mf.mutual_friend_count
FROM mutual_friends mf
JOIN users u ON mf.recommended_user_id = u.id
WHERE u.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM friendships f 
    WHERE (f.user1_id = $1 AND f.user2_id = u.id) 
       OR (f.user1_id = u.id AND f.user2_id = $1)
  )
ORDER BY mf.mutual_friend_count DESC, u.created_at DESC
LIMIT 10;
```

## 📊 Database Optimization

### Connection Pooling
```typescript
// infrastructure/database/pool.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  min: 5,  // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
  maxUses: 7500, // Close (and replace) a connection after it has been used this many times
  allowExitOnIdle: true, // Allow the application to close the pool gracefully
});

// Monitor pool metrics
setInterval(() => {
  console.log('Pool Status:', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
}, 30000);
```

### Query Performance Monitoring
```typescript
// infrastructure/database/queryMonitor.ts
import { logger } from '@/shared/utils/logger';

export function logSlowQueries(query: string, duration: number): void {
  if (duration > 1000) { // Log queries taking more than 1 second
    logger.warn('Slow query detected', {
      query: query.substring(0, 200),
      duration,
      timestamp: new Date().toISOString()
    });
  }
}

// Usage in repository methods
export class MonitoredRepository {
  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await db.query(text, params);
      const duration = Date.now() - start;
      logSlowQueries(text, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', { query: text, duration, error });
      throw error;
    }
  }
}
```

## 🔒 Security Considerations

### SQL Injection Prevention
```typescript
// Always use parameterized queries
const query = 'SELECT * FROM users WHERE email = $1 AND password_hash = $2';
const result = await db.query(query, [email, passwordHash]);

// Never do this:
// const query = `SELECT * FROM users WHERE email = '${email}'`; // VULNERABLE!
```

### Row Level Security (RLS)
```sql
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only see their own data
CREATE POLICY user_policy ON users
  FOR ALL TO authenticated_user
  USING (id = current_setting('app.current_user_id')::uuid);

-- Create policy for public posts
CREATE POLICY public_posts_policy ON posts
  FOR SELECT TO authenticated_user
  USING (
    privacy_level = 'public' OR
    (privacy_level = 'friends' AND (
      user_id = current_setting('app.current_user_id')::uuid OR
      EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.user1_id = user_id AND f.user2_id = current_setting('app.current_user_id')::uuid)
               OR (f.user2_id = user_id AND f.user1_id = current_setting('app.current_user_id')::uuid))
      )
    ))
  );
```

## 🧪 Testing

### Service-Specific Test Setup
```typescript
// tests/database/setup.ts
import { Pool } from 'pg';

// Create test databases for each service
const createTestDatabases = async () => {
  const adminPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL
  });

  const services = ['auth', 'users', 'posts', 'messages', 'media', 'notifications'];
  
  for (const service of services) {
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS ${service}_test_db`);
      await adminPool.query(`CREATE DATABASE ${service}_test_db`);
    } catch (error) {
      console.error(`Failed to create test database for ${service}:`, error);
    }
  }

  await adminPool.end();
};

beforeAll(async () => {
  await createTestDatabases();
});

export { createTestDatabases };
```

### Service-Specific Repository Tests
```typescript
// tests/auth-service/userRepository.test.ts
import { authUserRepository } from '@/services/auth-service/database/userRepository';
import { authDb } from '@/infrastructure/database/connection';

describe('AuthUserRepository', () => {
  beforeEach(async () => {
    await authDb.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  describe('create', () => {
    it('should create a new user in auth database', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword'
      };

      const user = await authUserRepository.create(userData);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.isActive).toBe(true);
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword'
      };

      await authUserRepository.create(userData);

      await expect(authUserRepository.create(userData)).rejects.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword'
      };

      await authUserRepository.create(userData);
      const foundUser = await authUserRepository.findByEmail(userData.email);

      expect(foundUser).toBeDefined();
      expect(foundUser!.email).toBe(userData.email);
    });
  });
});
```

### Cross-Service Integration Tests
```typescript
// tests/integration/userRegistration.test.ts
import { authUserRepository } from '@/services/auth-service/database/userRepository';
import { userProfileRepository } from '@/services/user-service/database/userProfileRepository';
import { eventConsumer } from '@/infrastructure/rabbitmq/eventConsumer';
import { dataSyncService } from '@/shared/services/dataSyncService';

describe('User Registration Integration', () => {
  it('should sync user data between Auth and User services', async () => {
    // Create user in Auth service
    const userData = {
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: 'hashedpassword'
    };

    const authUser = await authUserRepository.create(userData);

    // Sync to User service via events
    await dataSyncService.syncUserRegistration({
      id: authUser.id,
      email: authUser.email,
      username: authUser.username,
      firstName: 'Test',
      lastName: 'User'
    });

    // Verify user profile was created in User service
    const userProfile = await userProfileRepository.findById(authUser.id);
    expect(userProfile).toBeDefined();
    expect(userProfile!.email).toBe(authUser.email);
    expect(userProfile!.username).toBe(authUser.username);
  });
});
```

This updated PostgreSQL implementation provides:

1. **✅ Database per Service** - Each microservice has its own database
2. **✅ Service Isolation** - Data is completely separated between services
3. **✅ Independent Scaling** - Each database can be scaled independently
4. **✅ Service Autonomy** - Each service owns and manages its data
5. **✅ Event-Driven Sync** - Cross-service data consistency via events
6. **✅ Service-Specific Repositories** - Each service has its own data access layer
7. **✅ Independent Migrations** - Each service manages its own schema changes

The architecture now properly supports microservices principles while maintaining data integrity and consistency across services! 🎉
