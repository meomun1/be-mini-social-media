import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { ValidationMiddlewareImpl, AuthMiddlewareImpl } from '@shared/types';
import {
  UpdateProfileDto,
  UpdatePrivacyDto,
  SendFriendRequestDto,
  RespondFriendRequestDto,
  UserSearchDto,
} from '../dto/UserDto';

const router = Router();
const userController = new UserController();
const validationMiddleware = new ValidationMiddlewareImpl();
const authMiddleware = new AuthMiddlewareImpl(
  process.env.JWT_SECRET || 'fallback-secret',
  require('jsonwebtoken').verify
);

// Apply authentication middleware to all routes
router.use(authMiddleware.authenticate.bind(authMiddleware));

// User Profile Routes
router.get('/profile', userController.getProfile.bind(userController));
router.put(
  '/profile',
  validationMiddleware.validateBody(UpdateProfileDto),
  userController.updateProfile.bind(userController)
);

// Privacy Settings Routes
router.get('/privacy', userController.getPrivacySettings.bind(userController));
router.put(
  '/privacy',
  validationMiddleware.validateBody(UpdatePrivacyDto),
  userController.updatePrivacySettings.bind(userController)
);

// User Routes
router.get('/:id', userController.getUserById.bind(userController));

// Friend Request Routes
router.post(
  '/:id/friend',
  validationMiddleware.validateBody(SendFriendRequestDto),
  userController.sendFriendRequest.bind(userController)
);
router.delete('/:id/friend', userController.removeFriend.bind(userController));

// Friend Request Management Routes
router.post(
  '/friend-requests/respond',
  validationMiddleware.validateBody(RespondFriendRequestDto),
  userController.respondToFriendRequest.bind(userController)
);
router.get('/friend-requests', userController.getFriendRequests.bind(userController));

// Friends Routes
router.get('/friends', userController.getFriends.bind(userController));

// Search Routes
router.get('/search', userController.searchUsers.bind(userController));

export default router;
