import { Pool } from 'pg';
import { DatabaseConnection } from '../config/database';
import { User, Session, RefreshToken, PasswordReset, EmailVerification } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

export class UserRepository {
  private pool: Pool;

  constructor() {
    this.pool = DatabaseConnection.getInstance().getPool();
  }

  // User CRUD operations
  async createUser(userData: {
    email: string;
    username: string;
    password_hash: string;
  }): Promise<User> {
    const query = `
      INSERT INTO users (id, email, username, password_hash, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;

    const values = [uuidv4(), userData.email, userData.username, userData.password_hash, true];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findUserById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await this.pool.query(query, [email]);
    return result.rows[0] || null;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
    const result = await this.pool.query(query, [username]);
    return result.rows[0] || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING *
    `;

    const values = [id, ...Object.values(updates)];
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const query = 'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  // Session management
  async createSession(sessionData: {
    user_id: string;
    token_hash: string;
    expires_at: Date;
    ip_address?: string;
    user_agent?: string;
  }): Promise<Session> {
    const query = `
      INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const values = [
      uuidv4(),
      sessionData.user_id,
      sessionData.token_hash,
      sessionData.expires_at,
      sessionData.ip_address || null,
      sessionData.user_agent || null,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    const query = 'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > NOW()';
    const result = await this.pool.query(query, [tokenHash]);
    return result.rows[0] || null;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const query = 'DELETE FROM sessions WHERE id = $1';
    const result = await this.pool.query(query, [sessionId]);
    return (result.rowCount || 0) > 0;
  }

  async deleteExpiredSessions(): Promise<number> {
    const query = 'DELETE FROM sessions WHERE expires_at <= NOW()';
    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }

  // Refresh token management
  async createRefreshToken(tokenData: {
    user_id: string;
    token_hash: string;
    expires_at: Date;
  }): Promise<RefreshToken> {
    const query = `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, is_revoked, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const values = [uuidv4(), tokenData.user_id, tokenData.token_hash, tokenData.expires_at, false];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    const query = `
      SELECT * FROM refresh_tokens 
      WHERE token_hash = $1 AND is_revoked = false AND expires_at > NOW()
    `;
    const result = await this.pool.query(query, [tokenHash]);
    return result.rows[0] || null;
  }

  async revokeRefreshToken(tokenId: string): Promise<boolean> {
    const query = 'UPDATE refresh_tokens SET is_revoked = true WHERE id = $1';
    const result = await this.pool.query(query, [tokenId]);
    return (result.rowCount || 0) > 0;
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<number> {
    const query =
      'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false';
    const result = await this.pool.query(query, [userId]);
    return result.rowCount || 0;
  }

  // Password reset
  async createPasswordReset(resetData: {
    user_id: string;
    token_hash: string;
    expires_at: Date;
  }): Promise<PasswordReset> {
    const query = `
      INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;

    const values = [uuidv4(), resetData.user_id, resetData.token_hash, resetData.expires_at];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findPasswordResetByToken(tokenHash: string): Promise<PasswordReset | null> {
    const query = `
      SELECT * FROM password_resets 
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
    `;
    const result = await this.pool.query(query, [tokenHash]);
    return result.rows[0] || null;
  }

  async markPasswordResetAsUsed(tokenId: string): Promise<boolean> {
    const query = 'UPDATE password_resets SET used_at = NOW() WHERE id = $1';
    const result = await this.pool.query(query, [tokenId]);
    return (result.rowCount || 0) > 0;
  }

  // Email verification
  async createEmailVerification(verificationData: {
    user_id: string;
    token_hash: string;
    email: string;
    expires_at: Date;
  }): Promise<EmailVerification> {
    const query = `
      INSERT INTO email_verifications (id, user_id, token_hash, email, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const values = [
      uuidv4(),
      verificationData.user_id,
      verificationData.token_hash,
      verificationData.email,
      verificationData.expires_at,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findEmailVerificationByToken(tokenHash: string): Promise<EmailVerification | null> {
    const query = `
      SELECT * FROM email_verifications 
      WHERE token_hash = $1 AND verified_at IS NULL AND expires_at > NOW()
    `;
    const result = await this.pool.query(query, [tokenHash]);
    return result.rows[0] || null;
  }

  async markEmailAsVerified(tokenId: string): Promise<boolean> {
    const query = 'UPDATE email_verifications SET verified_at = NOW() WHERE id = $1';
    const result = await this.pool.query(query, [tokenId]);
    return (result.rowCount || 0) > 0;
  }
}
