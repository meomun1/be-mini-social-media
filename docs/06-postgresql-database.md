# PostgreSQL Database Guide

## 🗄️ Overview

PostgreSQL serves as our primary relational database, providing ACID compliance, advanced indexing, and robust data integrity for our mini Facebook backend.

## 🏗️ Database Architecture

### Connection Management
```typescript
// infrastructure/database/connection.ts
import { Pool, PoolClient } from 'pg';
import { logger } from '@/shared/utils/logger';

class DatabaseConnection {
  private pool: Pool;
  private isConnected = false;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_SIZE || '10'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Query executed', { query: text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Database query error:', error);
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
    logger.info('Database connection closed');
  }
}

export const db = new DatabaseConnection();
export const connectDatabase = () => db.connect();
```

## 📊 Database Schema

### Users Schema
```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
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
    privacy_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_username_check CHECK (username ~* '^[a-zA-Z0-9_]{3,50}$'),
    CONSTRAINT users_password_length CHECK (char_length(password_hash) >= 60)
);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_users_search ON users USING gin(
    to_tsvector('english', first_name || ' ' || last_name || ' ' || username)
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Posts Schema
```sql
-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Create indexes for posts
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_privacy_level ON posts(privacy_level);
CREATE INDEX IF NOT EXISTS idx_posts_is_published ON posts(is_published);
CREATE INDEX IF NOT EXISTS idx_posts_like_count ON posts(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_comment_count ON posts(comment_count DESC);

-- Create full-text search index for posts
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING gin(
    to_tsvector('english', content)
);

-- Create GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING gin(tags);

-- Create trigger for updated_at
CREATE TRIGGER update_posts_updated_at 
    BEFORE UPDATE ON posts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Comments Schema
```sql
-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT comments_content_not_empty CHECK (char_length(trim(content)) > 0),
    CONSTRAINT comments_like_count_positive CHECK (like_count >= 0)
);

-- Create indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Friendships Schema
```sql
-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT friendships_different_users CHECK (user1_id != user2_id),
    UNIQUE(user1_id, user2_id)
);

-- Create indexes for friendships
CREATE INDEX IF NOT EXISTS idx_friendships_user1_id ON friendships(user1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user2_id ON friendships(user2_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_created_at ON friendships(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_friendships_updated_at 
    BEFORE UPDATE ON friendships 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Reactions Schema
```sql
-- Create reactions table
CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Create indexes for reactions
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_comment_id ON reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_reactions_type ON reactions(type);
CREATE INDEX IF NOT EXISTS idx_reactions_created_at ON reactions(created_at DESC);
```

## 🔧 Database Operations

### User Repository
```typescript
// infrastructure/database/repositories/userRepository.ts
import { db } from '../connection';
import { User, CreateUserRequest, UpdateUserRequest } from '@/shared/types/user';

export class UserRepository {
  async create(userData: CreateUserRequest): Promise<User> {
    const query = `
      INSERT INTO users (
        email, username, password_hash, first_name, last_name,
        date_of_birth, gender, phone_number, location, website,
        privacy_settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const values = [
      userData.email,
      userData.username,
      userData.passwordHash,
      userData.firstName,
      userData.lastName,
      userData.dateOfBirth,
      userData.gender,
      userData.phoneNumber,
      userData.location,
      userData.website,
      JSON.stringify(userData.privacySettings || {})
    ];

    const result = await db.query(query, values);
    return this.mapRowToUser(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await db.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  async findByUsername(username: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
    const result = await db.query(query, [username]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  async update(id: string, updates: UpdateUserRequest): Promise<User> {
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
      UPDATE users 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount} AND is_active = true
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  async search(query: string, limit: number = 20, offset: number = 0): Promise<User[]> {
    const searchQuery = `
      SELECT *, ts_rank(
        to_tsvector('english', first_name || ' ' || last_name || ' ' || username),
        plainto_tsquery('english', $1)
      ) as rank
      FROM users 
      WHERE is_active = true 
        AND (
          first_name ILIKE $2 OR 
          last_name ILIKE $2 OR 
          username ILIKE $2 OR
          to_tsvector('english', first_name || ' ' || last_name || ' ' || username) @@ plainto_tsquery('english', $1)
        )
      ORDER BY rank DESC, created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const searchTerm = `%${query}%`;
    const result = await db.query(searchQuery, [query, searchTerm, limit, offset]);
    
    return result.rows.map(row => this.mapRowToUser(row));
  }

  async delete(id: string): Promise<void> {
    const query = 'UPDATE users SET is_active = false WHERE id = $1';
    await db.query(query, [id]);
  }

  private mapRowToUser(row: any): User {
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

export const userRepository = new UserRepository();
```

### Post Repository
```typescript
// infrastructure/database/repositories/postRepository.ts
import { db } from '../connection';
import { Post, CreatePostRequest, UpdatePostRequest } from '@/shared/types/post';

export class PostRepository {
  async create(postData: CreatePostRequest): Promise<Post> {
    const query = `
      INSERT INTO posts (
        user_id, content, media_urls, location, privacy_level, tags
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      postData.userId,
      postData.content,
      postData.mediaUrls || [],
      postData.location,
      postData.privacyLevel || 'friends',
      postData.tags || []
    ];

    const result = await db.query(query, values);
    return this.mapRowToPost(result.rows[0]);
  }

  async findById(id: string): Promise<Post | null> {
    const query = 'SELECT * FROM posts WHERE id = $1 AND is_published = true';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToPost(result.rows[0]);
  }

  async findByUserId(userId: string, limit: number = 20, offset: number = 0): Promise<Post[]> {
    const query = `
      SELECT * FROM posts 
      WHERE user_id = $1 AND is_published = true
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [userId, limit, offset]);
    return result.rows.map(row => this.mapRowToPost(row));
  }

  async getFeed(userId: string, limit: number = 20, offset: number = 0): Promise<Post[]> {
    const query = `
      WITH friend_posts AS (
        SELECT p.*
        FROM posts p
        INNER JOIN friendships f ON (
          (f.user1_id = $1 OR f.user2_id = $1) AND
          f.status = 'accepted' AND
          (f.user1_id = p.user_id OR f.user2_id = p.user_id)
        )
        WHERE p.privacy_level IN ('public', 'friends') 
          AND p.is_published = true
          AND p.user_id != $1
      ),
      public_posts AS (
        SELECT * FROM posts 
        WHERE privacy_level = 'public' 
          AND is_published = true
          AND user_id != $1
      )
      SELECT * FROM (
        SELECT * FROM friend_posts
        UNION ALL
        SELECT * FROM public_posts
      ) combined_posts
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [userId, limit, offset]);
    return result.rows.map(row => this.mapRowToPost(row));
  }

  async update(id: string, userId: string, updates: UpdatePostRequest): Promise<Post> {
    const setClause = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setClause.push(`${dbKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (setClause.length === 0) {
      throw new Error('No updates provided');
    }

    values.push(id, userId);
    const query = `
      UPDATE posts 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1} AND is_published = true
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Post not found or not authorized');
    }
    
    return this.mapRowToPost(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<void> {
    const query = 'UPDATE posts SET is_published = false WHERE id = $1 AND user_id = $2';
    const result = await db.query(query, [id, userId]);
    
    if (result.rowCount === 0) {
      throw new Error('Post not found or not authorized');
    }
  }

  async incrementLikeCount(id: string): Promise<void> {
    const query = 'UPDATE posts SET like_count = like_count + 1 WHERE id = $1';
    await db.query(query, [id]);
  }

  async decrementLikeCount(id: string): Promise<void> {
    const query = 'UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1';
    await db.query(query, [id]);
  }

  private mapRowToPost(row: any): Post {
    return {
      id: row.id,
      userId: row.user_id,
      content: row.content,
      mediaUrls: row.media_urls || [],
      location: row.location,
      privacyLevel: row.privacy_level,
      tags: row.tags || [],
      likeCount: row.like_count,
      commentCount: row.comment_count,
      shareCount: row.share_count,
      isPublished: row.is_published,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const postRepository = new PostRepository();
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

### Database Test Setup
```typescript
// tests/database/setup.ts
import { Pool } from 'pg';

let testPool: Pool;

beforeAll(async () => {
  testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    max: 5,
  });
  
  // Run migrations for test database
  await runMigrations(testPool);
});

afterAll(async () => {
  await testPool.end();
});

beforeEach(async () => {
  // Clean up test data before each test
  await testPool.query('TRUNCATE TABLE reactions, comments, posts, friendships, users RESTART IDENTITY CASCADE');
});

export { testPool };
```

### Repository Tests
```typescript
// tests/repositories/userRepository.test.ts
import { userRepository } from '@/infrastructure/database/repositories/userRepository';
import { testPool } from '../database/setup';

describe('UserRepository', () => {
  beforeEach(async () => {
    await testPool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: '1990-01-01',
        gender: 'male' as const,
        privacySettings: { profileVisibility: 'public' as const }
      };

      const user = await userRepository.create(userData);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.isActive).toBe(true);
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User'
      };

      await userRepository.create(userData);

      await expect(userRepository.create(userData)).rejects.toThrow();
    });
  });
});
```

This PostgreSQL setup provides a robust, scalable, and secure database foundation for our mini Facebook backend with proper indexing, query optimization, and security measures.
