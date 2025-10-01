import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../repositories/UserRepository';
import { jwtConfig, bcryptConfig } from '../config/app';
import {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  JWTPayload,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  ChangePasswordRequest,
} from '@shared/types';
import { createLogger } from '../utils/logger';
import { AuthError } from '../utils/AuthError';

const logger = createLogger('auth');

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  // User Registration
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      logger.info('User registration attempt', {
        email: userData.email,
        username: userData.username,
      });

      // Check if user already exists
      const existingUserByEmail = await this.userRepository.findUserByEmail(userData.email);
      if (existingUserByEmail) {
        throw new AuthError('EMAIL_ALREADY_EXISTS', 'Email address is already registered');
      }

      const existingUserByUsername = await this.userRepository.findUserByUsername(
        userData.username
      );
      if (existingUserByUsername) {
        throw new AuthError('USERNAME_ALREADY_EXISTS', 'Username is already taken');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, bcryptConfig.rounds);

      // Create user
      const user = await this.userRepository.createUser({
        email: userData.email,
        username: userData.username,
        password_hash: passwordHash,
      });

      logger.info('User registered successfully', { userId: user.id, email: user.email });

      // Generate tokens
      const { access_token, refresh_token } = await this.generateTokenPair(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
        access_token,
        refresh_token,
        expires_in: 15 * 60, // 15 minutes
      };
    } catch (error) {
      const err = error as Error;
      logger.error('User registration failed', { error: err.message, email: userData.email });
      throw error;
    }
  }

  // User Login
  async login(
    credentials: LoginRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResponse> {
    try {
      logger.info('User login attempt', { email: credentials.email });

      // Find user
      const user = await this.userRepository.findUserByEmail(credentials.email);
      if (!user) {
        throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
      if (!isPasswordValid) {
        throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new AuthError('ACCOUNT_LOCKED', 'Account is locked');
      }

      logger.info('User login successful', { userId: user.id, email: user.email });

      // Generate tokens
      const { access_token, refresh_token } = await this.generateTokenPair(user);

      // Create session
      const sessionTokenHash = await this.hashToken(access_token);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      const sessionData: any = {
        user_id: user.id,
        token_hash: sessionTokenHash,
        expires_at: expiresAt,
      };

      if (ipAddress) sessionData.ip_address = ipAddress;
      if (userAgent) sessionData.user_agent = userAgent;

      await this.userRepository.createSession(sessionData);

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
        access_token,
        refresh_token,
        expires_in: 15 * 60, // 15 minutes
      };
    } catch (error) {
      const err = error as Error;
      logger.error('User login failed', { error: err.message, email: credentials.email });
      throw error;
    }
  }

  // Token Refresh
  async refreshToken(
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, jwtConfig.secret) as JWTPayload;

      if (decoded.type !== 'refresh') {
        throw new AuthError('TOKEN_INVALID', 'Invalid token type');
      }

      // Check if token exists in database and is not revoked
      const tokenHash = await this.hashToken(refreshToken);
      const storedToken = await this.userRepository.findRefreshTokenByHash(tokenHash);

      if (!storedToken) {
        throw new AuthError('TOKEN_INVALID', 'Refresh token not found or revoked');
      }

      // Get user
      const user = await this.userRepository.findUserById(decoded.sub);
      if (!user || !user.is_active) {
        throw new AuthError('USER_NOT_FOUND', 'User not found or inactive');
      }

      // Revoke old refresh token
      await this.userRepository.revokeRefreshToken(storedToken.id);

      // Generate new token pair
      const tokenPair = await this.generateTokenPair(user);

      logger.info('Token refreshed successfully', { userId: user.id });

      return tokenPair;
    } catch (error) {
      const err = error as Error;
      logger.error('Token refresh failed', { error: err.message });
      throw error;
    }
  }

  // Logout
  async logout(accessToken: string): Promise<void> {
    try {
      const tokenHash = await this.hashToken(accessToken);

      // Find and delete session
      const session = await this.userRepository.findSessionByTokenHash(tokenHash);
      if (session) {
        await this.userRepository.deleteSession(session.id);
      }

      logger.info('User logged out successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Logout failed', { error: err.message });
      throw error;
    }
  }

  // Forgot Password
  async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
    try {
      const user = await this.userRepository.findUserByEmail(request.email);
      if (!user) {
        // Don't reveal if email exists for security
        logger.info('Password reset requested for non-existent email', { email: request.email });
        return;
      }

      // Generate reset token
      const resetToken = uuidv4();
      const tokenHash = await this.hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await this.userRepository.createPasswordReset({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      // TODO: Send email with reset link
      logger.info('Password reset token created', { userId: user.id, email: user.email });

      // In a real application, you would send an email here
      console.log(`Password reset link: /reset-password?token=${resetToken}`);
    } catch (error) {
      const err = error as Error;
      logger.error('Forgot password failed', { error: err.message, email: request.email });
      throw error;
    }
  }

  // Reset Password
  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    try {
      const tokenHash = await this.hashToken(request.token);
      const resetRecord = await this.userRepository.findPasswordResetByToken(tokenHash);

      if (!resetRecord) {
        throw new AuthError('TOKEN_INVALID', 'Invalid or expired reset token');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(request.password, bcryptConfig.rounds);

      // Update user password
      await this.userRepository.updateUser(resetRecord.user_id, {
        password_hash: passwordHash,
      });

      // Mark reset token as used
      await this.userRepository.markPasswordResetAsUsed(resetRecord.id);

      // Revoke all refresh tokens for security
      await this.userRepository.revokeAllUserRefreshTokens(resetRecord.user_id);

      logger.info('Password reset successfully', { userId: resetRecord.user_id });
    } catch (error) {
      const err = error as Error;
      logger.error('Password reset failed', { error: err.message });
      throw error;
    }
  }

  // Verify Email
  async verifyEmail(request: VerifyEmailRequest): Promise<void> {
    try {
      const tokenHash = await this.hashToken(request.token);
      const verificationRecord = await this.userRepository.findEmailVerificationByToken(tokenHash);

      if (!verificationRecord) {
        throw new AuthError('TOKEN_INVALID', 'Invalid or expired verification token');
      }

      // Mark email as verified
      await this.userRepository.markEmailAsVerified(verificationRecord.id);

      logger.info('Email verified successfully', { userId: verificationRecord.user_id });
    } catch (error) {
      const err = error as Error;
      logger.error('Email verification failed', { error: err.message });
      throw error;
    }
  }

  // Change Password
  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    try {
      const user = await this.userRepository.findUserById(userId);
      if (!user) {
        throw new AuthError('USER_NOT_FOUND', 'User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        request.current_password,
        user.password_hash
      );
      if (!isCurrentPasswordValid) {
        throw new AuthError('INVALID_CREDENTIALS', 'Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(request.new_password, bcryptConfig.rounds);

      // Update password
      await this.userRepository.updateUser(userId, {
        password_hash: newPasswordHash,
      });

      // Revoke all refresh tokens for security
      await this.userRepository.revokeAllUserRefreshTokens(userId);

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      const err = error as Error;
      logger.error('Password change failed', { error: err.message, userId });
      throw error;
    }
  }

  // Validate JWT Token
  async validateToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret) as JWTPayload;

      if (decoded.type !== 'access') {
        throw new AuthError('TOKEN_INVALID', 'Invalid token type');
      }

      // Check if token is expired
      if (decoded.exp < Date.now() / 1000) {
        throw new AuthError('TOKEN_EXPIRED', 'Token has expired');
      }

      return decoded;
    } catch (error) {
      const err = error as Error;
      if (err.name === 'TokenExpiredError') {
        throw new AuthError('TOKEN_EXPIRED', 'Token has expired');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new AuthError('TOKEN_INVALID', 'Invalid token');
      }
      throw error;
    }
  }

  // Generate token pair (access + refresh)
  private async generateTokenPair(
    user: User
  ): Promise<{ access_token: string; refresh_token: string }> {
    const accessTokenPayload: JWTPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
      iss: jwtConfig.issuer,
      aud: jwtConfig.audience,
      type: 'access',
    };

    const refreshTokenPayload: JWTPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
      iss: jwtConfig.issuer,
      aud: jwtConfig.audience,
      type: 'refresh',
    };

    const access_token = jwt.sign(accessTokenPayload, jwtConfig.secret);
    const refresh_token = jwt.sign(refreshTokenPayload, jwtConfig.secret);

    // Store refresh token in database
    const refreshTokenHash = await this.hashToken(refresh_token);
    await this.userRepository.createRefreshToken({
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at: new Date(refreshTokenPayload.exp * 1000),
    });

    return { access_token, refresh_token };
  }

  // Hash token for storage
  private async hashToken(token: string): Promise<string> {
    return await bcrypt.hash(token, bcryptConfig.rounds);
  }
}
