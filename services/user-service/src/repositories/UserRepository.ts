import { DatabaseConnection } from '../config/database';
import { QueryResult } from 'pg';
import {
  UserProfile,
  PrivacySettings,
  FriendRequest,
  Friendship,
  UpdateProfileRequest,
  UpdatePrivacyRequest,
  SendFriendRequestRequest,
  RespondFriendRequestRequest,
} from '@shared/types';
import { createLogger } from '@shared/types';

const logger = createLogger('user');

export class UserRepository {
  private db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  // User Profile Operations
  async createUserProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    const query = `
      INSERT INTO user_profiles (user_id, first_name, last_name, bio, avatar_url, cover_url, 
                               date_of_birth, location, website, phone, is_public, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;

    const values = [
      userId,
      profileData.first_name || null,
      profileData.last_name || null,
      profileData.bio || null,
      profileData.avatar_url || null,
      profileData.cover_url || null,
      profileData.date_of_birth || null,
      profileData.location || null,
      profileData.website || null,
      profileData.phone || null,
      profileData.is_public ?? true,
      profileData.status || 'offline',
    ];

    const result: QueryResult<UserProfile> = await this.db.query(query, values);
    logger.info('User profile created', { userId });
    return result.rows[0]!;
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const query = 'SELECT * FROM user_profiles WHERE user_id = $1';
    const result: QueryResult<UserProfile> = await this.db.query(query, [userId]);
    return result.rows[0] || null;
  }

  async updateUserProfile(
    userId: string,
    updates: UpdateProfileRequest
  ): Promise<UserProfile | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.getUserProfile(userId);
    }

    values.push(userId);
    const query = `
      UPDATE user_profiles 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE user_id = $${paramCount}
      RETURNING *;
    `;

    const result: QueryResult<UserProfile> = await this.db.query(query, values);
    logger.info('User profile updated', { userId });
    return result.rows[0] || null;
  }

  // Privacy Settings Operations
  async createPrivacySettings(
    userId: string,
    settings: Partial<PrivacySettings>
  ): Promise<PrivacySettings> {
    const query = `
      INSERT INTO privacy_settings (user_id, profile_visibility, email_visibility, phone_visibility,
                                  location_visibility, friend_list_visibility, post_visibility_default,
                                  allow_friend_requests, allow_messages, allow_tagging, allow_sharing)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;

    const values = [
      userId,
      settings.profile_visibility || 'public',
      settings.email_visibility || 'friends',
      settings.phone_visibility || 'friends',
      settings.location_visibility || 'friends',
      settings.friend_list_visibility || 'friends',
      settings.post_visibility_default || 'public',
      settings.allow_friend_requests ?? true,
      settings.allow_messages || 'friends',
      settings.allow_tagging ?? true,
      settings.allow_sharing ?? true,
    ];

    const result: QueryResult<PrivacySettings> = await this.db.query(query, values);
    logger.info('Privacy settings created', { userId });
    return result.rows[0]!;
  }

  async getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    const query = 'SELECT * FROM privacy_settings WHERE user_id = $1';
    const result: QueryResult<PrivacySettings> = await this.db.query(query, [userId]);
    return result.rows[0] || null;
  }

  async updatePrivacySettings(
    userId: string,
    updates: UpdatePrivacyRequest
  ): Promise<PrivacySettings | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.getPrivacySettings(userId);
    }

    values.push(userId);
    const query = `
      UPDATE privacy_settings 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE user_id = $${paramCount}
      RETURNING *;
    `;

    const result: QueryResult<PrivacySettings> = await this.db.query(query, values);
    logger.info('Privacy settings updated', { userId });
    return result.rows[0] || null;
  }

  // Friend Request Operations
  async createFriendRequest(
    requestData: SendFriendRequestRequest & { requester_id: string }
  ): Promise<FriendRequest> {
    const query = `
      INSERT INTO friend_requests (requester_id, addressee_id, message)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const values = [
      requestData.requester_id,
      requestData.addressee_id,
      requestData.message || null,
    ];
    const result: QueryResult<FriendRequest> = await this.db.query(query, values);
    logger.info('Friend request created', {
      requesterId: requestData.requester_id,
      addresseeId: requestData.addressee_id,
    });
    return result.rows[0]!;
  }

  async getFriendRequest(requestId: string): Promise<FriendRequest | null> {
    const query = 'SELECT * FROM friend_requests WHERE id = $1';
    const result: QueryResult<FriendRequest> = await this.db.query(query, [requestId]);
    return result.rows[0] || null;
  }

  async getUserFriendRequests(userId: string, status?: string): Promise<FriendRequest[]> {
    let query = 'SELECT * FROM friend_requests WHERE addressee_id = $1';
    const values = [userId];

    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }

    query += ' ORDER BY created_at DESC';
    const result: QueryResult<FriendRequest> = await this.db.query(query, values);
    return result.rows;
  }

  async getSentFriendRequests(userId: string, status?: string): Promise<FriendRequest[]> {
    let query = 'SELECT * FROM friend_requests WHERE requester_id = $1';
    const values = [userId];

    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }

    query += ' ORDER BY created_at DESC';
    const result: QueryResult<FriendRequest> = await this.db.query(query, values);
    return result.rows;
  }

  async respondToFriendRequest(
    requestId: string,
    action: 'accept' | 'decline'
  ): Promise<FriendRequest | null> {
    const status = action === 'accept' ? 'accepted' : 'declined';
    const query = `
      UPDATE friend_requests 
      SET status = $1, responded_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result: QueryResult<FriendRequest> = await this.db.query(query, [status, requestId]);
    logger.info('Friend request responded', { requestId, action });
    return result.rows[0] || null;
  }

  // Friendship Operations
  async createFriendship(userId: string, friendId: string): Promise<Friendship> {
    // Create bidirectional friendship
    const query = `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'active'), ($2, $1, 'active')
      RETURNING *;
    `;

    const result: QueryResult<Friendship> = await this.db.query(query, [userId, friendId]);
    logger.info('Friendship created', { userId, friendId });
    return result.rows[0]!;
  }

  async getFriendships(userId: string): Promise<Friendship[]> {
    const query = `
      SELECT f.*, up.first_name, up.last_name, up.avatar_url, up.status as user_status
      FROM friendships f
      LEFT JOIN user_profiles up ON f.friend_id = up.user_id
      WHERE f.user_id = $1 AND f.status = 'active'
      ORDER BY f.created_at DESC;
    `;

    const result: QueryResult<Friendship> = await this.db.query(query, [userId]);
    return result.rows;
  }

  async removeFriendship(userId: string, friendId: string): Promise<boolean> {
    const query = `
      DELETE FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1);
    `;

    const result = await this.db.query(query, [userId, friendId]);
    const deleted = (result.rowCount || 0) > 0;

    if (deleted) {
      logger.info('Friendship removed', { userId, friendId });
    }

    return deleted;
  }

  async areFriends(userId: string, friendId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM friendships 
      WHERE user_id = $1 AND friend_id = $2 AND status = 'active'
      LIMIT 1;
    `;

    const result = await this.db.query(query, [userId, friendId]);
    return (result.rowCount || 0) > 0;
  }

  // Search Operations
  async searchUsers(
    query: string,
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const searchQuery = `
      SELECT 
        up.user_id,
        up.first_name,
        up.last_name,
        up.avatar_url,
        up.is_public,
        CASE WHEN f.user_id IS NOT NULL THEN true ELSE false END as is_friend,
        CASE 
          WHEN fr1.status = 'pending' AND fr1.requester_id = $2 THEN 'sent'
          WHEN fr1.status = 'pending' AND fr1.addressee_id = $2 THEN 'pending'
          ELSE 'none'
        END as friend_request_status
      FROM user_profiles up
      LEFT JOIN friendships f ON up.user_id = f.friend_id AND f.user_id = $2
      LEFT JOIN friend_requests fr1 ON (
        (fr1.requester_id = $2 AND fr1.addressee_id = up.user_id) OR
        (fr1.addressee_id = $2 AND fr1.requester_id = up.user_id)
      ) AND fr1.status = 'pending'
      WHERE up.user_id != $2
        AND (
          up.first_name ILIKE $1 OR 
          up.last_name ILIKE $1 OR 
          CONCAT(up.first_name, ' ', up.last_name) ILIKE $1
        )
        AND up.is_public = true
      ORDER BY 
        CASE WHEN up.first_name ILIKE $1 THEN 1 ELSE 2 END,
        up.first_name
      LIMIT $3 OFFSET $4;
    `;

    const searchTerm = `%${query}%`;
    const result = await this.db.query(searchQuery, [searchTerm, userId, limit, offset]);
    return result.rows;
  }
}
