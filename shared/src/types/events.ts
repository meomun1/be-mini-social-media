import { ServiceName } from './common';

export interface BaseEvent {
  id: string;
  type: string;
  service: ServiceName;
  timestamp: Date;
  version: string;
  correlation_id?: string;
  causation_id?: string;
}

// Auth Service Events
export interface UserCreatedEvent extends BaseEvent {
  type: 'user.created';
  data: {
    user_id: string;
    email: string;
    username: string;
    created_at: Date;
  };
}

export interface UserLoggedInEvent extends BaseEvent {
  type: 'user.logged_in';
  data: {
    user_id: string;
    ip_address?: string;
    user_agent?: string;
    timestamp: Date;
  };
}

export interface UserLoggedOutEvent extends BaseEvent {
  type: 'user.logged_out';
  data: {
    user_id: string;
    session_id: string;
    timestamp: Date;
  };
}

// User Service Events
export interface UserProfileUpdatedEvent extends BaseEvent {
  type: 'user.profile_updated';
  data: {
    user_id: string;
    changes: Record<string, any>;
    updated_at: Date;
  };
}

export interface UserPrivacySettingsUpdatedEvent extends BaseEvent {
  type: 'user.privacy_updated';
  data: {
    user_id: string;
    changes: Record<string, any>;
    updated_at: Date;
  };
}

export interface FriendRequestSentEvent extends BaseEvent {
  type: 'friend.request_sent';
  data: {
    requester_id: string;
    addressee_id: string;
    request_id: string;
    message?: string;
    timestamp: Date;
  };
}

export interface FriendRequestAcceptedEvent extends BaseEvent {
  type: 'friend.request_accepted';
  data: {
    requester_id: string;
    addressee_id: string;
    friendship_id: string;
    timestamp: Date;
  };
}

export interface UserBlockedEvent extends BaseEvent {
  type: 'user.blocked';
  data: {
    blocker_id: string;
    blocked_id: string;
    reason?: string;
    timestamp: Date;
  };
}

// Post Service Events
export interface PostCreatedEvent extends BaseEvent {
  type: 'post.created';
  data: {
    post_id: string;
    user_id: string;
    content: string;
    visibility: 'public' | 'friends' | 'private';
    media_urls?: string[];
    location?: string;
    tags?: string[];
    mentions?: string[];
    created_at: Date;
  };
}

export interface PostUpdatedEvent extends BaseEvent {
  type: 'post.updated';
  data: {
    post_id: string;
    user_id: string;
    changes: Record<string, any>;
    updated_at: Date;
  };
}

export interface PostDeletedEvent extends BaseEvent {
  type: 'post.deleted';
  data: {
    post_id: string;
    user_id: string;
    deleted_at: Date;
  };
}

export interface PostLikedEvent extends BaseEvent {
  type: 'post.liked';
  data: {
    post_id: string;
    user_id: string;
    like_id: string;
    timestamp: Date;
  };
}

export interface PostUnlikedEvent extends BaseEvent {
  type: 'post.unliked';
  data: {
    post_id: string;
    user_id: string;
    like_id: string;
    timestamp: Date;
  };
}

export interface CommentCreatedEvent extends BaseEvent {
  type: 'comment.created';
  data: {
    comment_id: string;
    post_id: string;
    user_id: string;
    content: string;
    parent_comment_id?: string;
    created_at: Date;
  };
}

export interface CommentUpdatedEvent extends BaseEvent {
  type: 'comment.updated';
  data: {
    comment_id: string;
    post_id: string;
    user_id: string;
    changes: Record<string, any>;
    updated_at: Date;
  };
}

export interface CommentDeletedEvent extends BaseEvent {
  type: 'comment.deleted';
  data: {
    comment_id: string;
    post_id: string;
    user_id: string;
    deleted_at: Date;
  };
}

export interface PostSharedEvent extends BaseEvent {
  type: 'post.shared';
  data: {
    post_id: string;
    user_id: string;
    share_id: string;
    message?: string;
    timestamp: Date;
  };
}

// Media Service Events
export interface MediaUploadedEvent extends BaseEvent {
  type: 'media.uploaded';
  data: {
    media_id: string;
    user_id: string;
    file_name: string;
    file_url: string;
    file_type: string;
    file_size: number;
    metadata?: Record<string, any>;
    uploaded_at: Date;
  };
}

export interface MediaUpdatedEvent extends BaseEvent {
  type: 'media.updated';
  data: {
    media_id: string;
    user_id: string;
    changes: Record<string, any>;
    updated_at: Date;
  };
}

export interface MediaDeletedEvent extends BaseEvent {
  type: 'media.deleted';
  data: {
    media_id: string;
    user_id: string;
    deleted_at: Date;
  };
}

// Message Service Events
export interface MessageSentEvent extends BaseEvent {
  type: 'message.sent';
  data: {
    message_id: string;
    sender_id: string;
    recipient_id: string;
    content: string;
    message_type: 'text' | 'image' | 'video' | 'file';
    media_url?: string;
    sent_at: Date;
  };
}

export interface MessageReadEvent extends BaseEvent {
  type: 'message.read';
  data: {
    message_id: string;
    reader_id: string;
    read_at: Date;
  };
}

export interface MessageDeletedEvent extends BaseEvent {
  type: 'message.deleted';
  data: {
    message_id: string;
    user_id: string;
    deleted_at: Date;
  };
}

// Union type for all events
export type DomainEvent =
  | UserCreatedEvent
  | UserLoggedInEvent
  | UserLoggedOutEvent
  | UserProfileUpdatedEvent
  | UserPrivacySettingsUpdatedEvent
  | FriendRequestSentEvent
  | FriendRequestAcceptedEvent
  | UserBlockedEvent
  | PostCreatedEvent
  | PostUpdatedEvent
  | PostDeletedEvent
  | PostLikedEvent
  | PostUnlikedEvent
  | CommentCreatedEvent
  | CommentUpdatedEvent
  | CommentDeletedEvent
  | PostSharedEvent
  | MediaUploadedEvent
  | MediaUpdatedEvent
  | MediaDeletedEvent
  | MessageSentEvent
  | MessageReadEvent
  | MessageDeletedEvent;

// Event handler interfaces
export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
  canHandle(eventType: string): boolean;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
}

export interface EventSubscriber {
  subscribe(eventType: string, handler: EventHandler): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}
