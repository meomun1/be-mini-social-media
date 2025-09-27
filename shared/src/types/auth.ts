import { BaseEntity, Timestamps } from './common';

export interface User extends BaseEntity {
  email: string;
  username: string;
  password_hash: string;
  is_active: boolean;
}

export interface Session extends BaseEntity {
  user_id: string;
  token_hash: string;
  expires_at: Date;
  ip_address?: string;
  user_agent?: string;
}

export interface RefreshToken extends BaseEntity {
  user_id: string;
  token_hash: string;
  expires_at: Date;
  is_revoked: boolean;
}

export interface PasswordReset extends BaseEntity {
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at?: Date;
}

export interface EmailVerification extends BaseEntity {
  user_id: string;
  token_hash: string;
  email: string;
  expires_at: Date;
  verified_at?: Date;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  username: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  type: 'access' | 'refresh';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
  };
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface AuthError {
  code: 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' | 'EMAIL_NOT_VERIFIED' | 'ACCOUNT_LOCKED' | 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'PASSWORD_TOO_WEAK' | 'EMAIL_ALREADY_EXISTS' | 'USERNAME_ALREADY_EXISTS';
  message: string;
  details?: any;
}
