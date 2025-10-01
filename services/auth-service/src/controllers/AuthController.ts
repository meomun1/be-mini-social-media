import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { ApiResponseHelper } from '../utils/response';
import { createLogger } from '../utils/logger';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
} from '../dto/AuthDto';
import { AuthError } from '../utils/AuthError';

const logger = createLogger('auth');

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // POST /api/v1/auth/register
  async register(req: Request, res: Response): Promise<void> {
    try {
      const registerData = req.body as RegisterDto;

      logger.info('Registration request received', { email: registerData.email });

      const result = await this.authService.register(registerData);

      logger.info('Registration successful', { userId: result.user.id, email: result.user.email });

      ApiResponseHelper.success(res, result, 201);
    } catch (error) {
      const err = error as Error;
      logger.error('Registration failed', { error: err.message, email: req.body.email });

      if (error instanceof AuthError) {
        const statusCode = this.getStatusCodeForAuthError(error.code);
        ApiResponseHelper.error(res, error.code, error.message, statusCode);
      } else {
        ApiResponseHelper.internalError(res, 'Registration failed');
      }
    }
  }

  // POST /api/v1/auth/login
  async login(req: Request, res: Response): Promise<void> {
    try {
      const loginData = req.body as LoginDto;
      const ipAddress = req.ip || req.socket?.remoteAddress;
      const userAgent = req.get('User-Agent');

      logger.info('Login request received', { email: loginData.email, ip: ipAddress });

      const result = await this.authService.login(loginData, ipAddress, userAgent);

      logger.info('Login successful', { userId: result.user.id, email: result.user.email });

      ApiResponseHelper.success(res, result);
    } catch (error) {
      const err = error as Error;
      logger.error('Login failed', { error: err.message, email: req.body.email });

      if (error instanceof AuthError) {
        const statusCode = this.getStatusCodeForAuthError(error.code);
        ApiResponseHelper.error(res, error.code, error.message, statusCode);
      } else {
        ApiResponseHelper.internalError(res, 'Login failed');
      }
    }
  }

  // POST /api/v1/auth/logout
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        ApiResponseHelper.unauthorized(res, 'Authorization header is required');
        return;
      }

      const token = authHeader.replace('Bearer ', '');

      await this.authService.logout(token);

      logger.info('Logout successful', { userId: req.user?.id });

      ApiResponseHelper.success(res, { message: 'Logged out successfully' });
    } catch (error) {
      const err = error as Error;
      logger.error('Logout failed', { error: err.message, userId: req.user?.id });
      ApiResponseHelper.internalError(res, 'Logout failed');
    }
  }

  // POST /api/v1/auth/refresh
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body as RefreshTokenDto;

      logger.info('Token refresh request received');

      const result = await this.authService.refreshToken(refresh_token);

      logger.info('Token refresh successful');

      ApiResponseHelper.success(res, result);
    } catch (error) {
      const err = error as Error;
      logger.error('Token refresh failed', { error: err.message });

      if (error instanceof AuthError) {
        const statusCode = this.getStatusCodeForAuthError(error.code);
        ApiResponseHelper.error(res, error.code, error.message, statusCode);
      } else {
        ApiResponseHelper.internalError(res, 'Token refresh failed');
      }
    }
  }

  // POST /api/v1/auth/forgot-password
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body as ForgotPasswordDto;

      logger.info('Forgot password request received', { email });

      await this.authService.forgotPassword({ email });

      // Always return success for security (don't reveal if email exists)
      ApiResponseHelper.success(res, {
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Forgot password failed', { error: err.message, email: req.body.email });
      ApiResponseHelper.internalError(res, 'Password reset request failed');
    }
  }

  // POST /api/v1/auth/reset-password
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const resetData = req.body as ResetPasswordDto;

      logger.info('Password reset request received');

      await this.authService.resetPassword(resetData);

      logger.info('Password reset successful');

      ApiResponseHelper.success(res, { message: 'Password has been reset successfully' });
    } catch (error) {
      const err = error as Error;
      logger.error('Password reset failed', { error: err.message });

      if (error instanceof AuthError) {
        const statusCode = this.getStatusCodeForAuthError(error.code);
        ApiResponseHelper.error(res, error.code, error.message, statusCode);
      } else {
        ApiResponseHelper.internalError(res, 'Password reset failed');
      }
    }
  }

  // POST /api/v1/auth/verify-email
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body as VerifyEmailDto;

      logger.info('Email verification request received');

      await this.authService.verifyEmail({ token });

      logger.info('Email verification successful');

      ApiResponseHelper.success(res, { message: 'Email has been verified successfully' });
    } catch (error) {
      const err = error as Error;
      logger.error('Email verification failed', { error: err.message });

      if (error instanceof AuthError) {
        const statusCode = this.getStatusCodeForAuthError(error.code);
        ApiResponseHelper.error(res, error.code, error.message, statusCode);
      } else {
        ApiResponseHelper.internalError(res, 'Email verification failed');
      }
    }
  }

  // POST /api/v1/auth/change-password
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ApiResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      const changePasswordData = req.body as ChangePasswordDto;

      logger.info('Change password request received', { userId: req.user.id });

      await this.authService.changePassword(req.user.id, changePasswordData);

      logger.info('Password change successful', { userId: req.user.id });

      ApiResponseHelper.success(res, { message: 'Password has been changed successfully' });
    } catch (error) {
      const err = error as Error;
      logger.error('Password change failed', { error: err.message, userId: req.user?.id });

      if (error instanceof AuthError) {
        const statusCode = this.getStatusCodeForAuthError(error.code);
        ApiResponseHelper.error(res, error.code, error.message, statusCode);
      } else {
        ApiResponseHelper.internalError(res, 'Password change failed');
      }
    }
  }

  // GET /api/v1/auth/me
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ApiResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      const user = {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
      };

      ApiResponseHelper.success(res, { user });
    } catch (error) {
      const err = error as Error;
      logger.error('Get profile failed', { error: err.message, userId: req.user?.id });
      ApiResponseHelper.internalError(res, 'Failed to get user profile');
    }
  }

  // Helper method to map auth error codes to HTTP status codes
  private getStatusCodeForAuthError(errorCode: string): number {
    switch (errorCode) {
      case 'INVALID_CREDENTIALS':
      case 'TOKEN_INVALID':
        return 401;
      case 'EMAIL_ALREADY_EXISTS':
      case 'USERNAME_ALREADY_EXISTS':
        return 409;
      case 'USER_NOT_FOUND':
        return 404;
      case 'TOKEN_EXPIRED':
        return 401;
      case 'ACCOUNT_LOCKED':
        return 423;
      case 'PASSWORD_TOO_WEAK':
        return 422;
      default:
        return 400;
    }
  }
}
