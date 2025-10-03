import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { ValidationMiddlewareImpl } from '@shared/types';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
} from '../dto/AuthDto';

const router = Router();
const authController = new AuthController();
const validationMiddleware = new ValidationMiddlewareImpl();

// Public routes (no authentication required)
router.post(
  '/register',
  validationMiddleware.validateBody(RegisterDto),
  authController.register.bind(authController)
);

router.post(
  '/login',
  validationMiddleware.validateBody(LoginDto),
  authController.login.bind(authController)
);

router.post(
  '/refresh',
  validationMiddleware.validateBody(RefreshTokenDto),
  authController.refreshToken.bind(authController)
);

router.post(
  '/forgot-password',
  validationMiddleware.validateBody(ForgotPasswordDto),
  authController.forgotPassword.bind(authController)
);

router.post(
  '/reset-password',
  validationMiddleware.validateBody(ResetPasswordDto),
  authController.resetPassword.bind(authController)
);

router.post(
  '/verify-email',
  validationMiddleware.validateBody(VerifyEmailDto),
  authController.verifyEmail.bind(authController)
);

// Protected routes (authentication required)
// Note: Auth middleware will be added in the main app setup

router.post('/logout', authController.logout.bind(authController));

router.post(
  '/change-password',
  validationMiddleware.validateBody(ChangePasswordDto),
  authController.changePassword.bind(authController)
);

router.get('/me', authController.getProfile.bind(authController));

export default router;
