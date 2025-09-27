// Common types
export * from './common';

// Domain types
export * from './auth';
export * from './user';
export * from './post';
export * from './events';

// Re-export commonly used types
export type {
  ApiResponse,
  PaginationParams,
  SortParams,
  FilterParams,
  SearchParams,
  BaseEntity,
  Timestamps,
  ServiceName,
  ServiceConfig,
  DatabaseConfig,
  RedisConfig,
  RabbitMQConfig,
  ElasticsearchConfig,
  JWTConfig,
  LogLevel,
} from './common';

export type {
  User,
  Session,
  RefreshToken,
  PasswordReset,
  EmailVerification,
  JWTPayload,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  ChangePasswordRequest,
  AuthError,
} from './auth';

export type {
  UserProfile,
  PrivacySettings,
  FriendRequest,
  Friendship,
  UserSearchResult,
  UpdateProfileRequest,
  UpdatePrivacyRequest,
  SendFriendRequestRequest,
  RespondFriendRequestRequest,
  BlockUserRequest,
  UserError,
} from './user';

export type {
  Post,
  Comment,
  Like,
  Share,
  PostTag,
  PostMention,
  PostSearchResult,
  CreatePostRequest,
  UpdatePostRequest,
  CreateCommentRequest,
  UpdateCommentRequest,
  SharePostRequest,
  PostFeedItem,
  PostFeedResponse,
  PostError,
} from './post';

export type {
  DomainEvent,
  EventHandler,
  EventPublisher,
  EventSubscriber,
  BaseEvent,
  UserCreatedEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserProfileUpdatedEvent,
  UserPrivacySettingsUpdatedEvent,
  FriendRequestSentEvent,
  FriendRequestAcceptedEvent,
  UserBlockedEvent,
  PostCreatedEvent,
  PostUpdatedEvent,
  PostDeletedEvent,
  PostLikedEvent,
  PostUnlikedEvent,
  CommentCreatedEvent,
  CommentUpdatedEvent,
  CommentDeletedEvent,
  PostSharedEvent,
  MediaUploadedEvent,
  MediaUpdatedEvent,
  MediaDeletedEvent,
  MessageSentEvent,
  MessageReadEvent,
  MessageDeletedEvent,
} from './events';
