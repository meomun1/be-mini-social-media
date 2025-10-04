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

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the authenticated user's profile information
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *                   example: "Profile retrieved successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/profile', userController.getProfile.bind(userController));
/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update user profile
 *     description: Update the authenticated user's profile information
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/profile',
  validationMiddleware.validateBody(UpdateProfileDto),
  userController.updateProfile.bind(userController)
);

// Privacy Settings Routes
/**
 * @swagger
 * /users/privacy:
 *   get:
 *     summary: Get privacy settings
 *     description: Get current user's privacy settings
 *     tags: [Privacy Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Privacy settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PrivacySettings'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/privacy', userController.getPrivacySettings.bind(userController));

/**
 * @swagger
 * /users/privacy:
 *   put:
 *     summary: Update privacy settings
 *     description: Update current user's privacy settings
 *     tags: [Privacy Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PrivacySettings'
 *     responses:
 *       200:
 *         description: Privacy settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PrivacySettings'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/privacy',
  validationMiddleware.validateBody(UpdatePrivacyDto),
  userController.updatePrivacySettings.bind(userController)
);

// User Routes
/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Get public user profile by user ID
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserSearchResult'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', userController.getUserById.bind(userController));

// Friend Request Routes
/**
 * @swagger
 * /users/{id}/friend:
 *   post:
 *     summary: Send friend request
 *     description: Send a friend request to another user
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Target user ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Hi! I'd like to be friends."
 *     responses:
 *       200:
 *         description: Friend request sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Friend request sent"
 *       400:
 *         description: Validation error or already friends
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:id/friend',
  validationMiddleware.validateBody(SendFriendRequestDto),
  userController.sendFriendRequest.bind(userController)
);

/**
 * @swagger
 * /users/{id}/friend:
 *   delete:
 *     summary: Remove friend or reject friend request
 *     description: Remove a friend or reject a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Target user ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Friend removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Friend removed"
 *       404:
 *         description: Friendship not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id/friend', userController.removeFriend.bind(userController));

// Friend Request Management Routes
/**
 * @swagger
 * /users/friend-requests/respond:
 *   post:
 *     summary: Respond to friend request
 *     description: Accept or decline a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [friendshipId, action]
 *             properties:
 *               friendshipId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               action:
 *                 type: string
 *                 enum: [accept, decline]
 *                 example: "accept"
 *     responses:
 *       200:
 *         description: Friend request responded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Friend request accepted"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/friend-requests/respond',
  validationMiddleware.validateBody(RespondFriendRequestDto),
  userController.respondToFriendRequest.bind(userController)
);

/**
 * @swagger
 * /users/friend-requests:
 *   get:
 *     summary: Get friend requests
 *     description: Get pending friend requests for current user
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Friend requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     friendRequests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           fromUser:
 *                             $ref: '#/components/schemas/UserSearchResult'
 *                           status:
 *                             type: string
 *                             example: "pending"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/friend-requests', userController.getFriendRequests.bind(userController));

// Friends Routes
/**
 * @swagger
 * /users/friends:
 *   get:
 *     summary: Get friends list
 *     description: Get current user's friends list
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Friends list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     friends:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/UserSearchResult'
 *                           - type: object
 *                             properties:
 *                               isOnline:
 *                                 type: boolean
 *                                 example: true
 *                               lastSeen:
 *                                 type: string
 *                                 format: date-time
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/friends', userController.getFriends.bind(userController));

// Search Routes
/**
 * @swagger
 * /users/search:
 *   get:
 *     summary: Search users
 *     description: Search for users by name or username
 *     tags: [User Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *         example: "john doe"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResponse'
 *       400:
 *         description: Invalid search parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/search', userController.searchUsers.bind(userController));

export default router;
