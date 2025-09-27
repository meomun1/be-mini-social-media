import { BaseEntity, Timestamps } from './common';

export interface UserProfile extends BaseEntity {
  user_id: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  date_of_birth?: Date;
  location?: string;
  website?: string;
  phone?: string;
  is_public: boolean;
  last_seen?: Date;
  status: 'online' | 'offline' | 'away' | 'busy';
}

export interface PrivacySettings extends BaseEntity {
  user_id: string;
  profile_visibility: 'public' | 'friends' | 'private';
  email_visibility: 'public' | 'friends' | 'private';
  phone_visibility: 'public' | 'friends' | 'private';
  location_visibility: 'public' | 'friends' | 'private';
  friend_list_visibility: 'public' | 'friends' | 'private';
  post_visibility_default: 'public' | 'friends' | 'private';
  allow_friend_requests: boolean;
  allow_messages: 'everyone' | 'friends' | 'none';
  allow_tagging: boolean;
  allow_sharing: boolean;
}

export interface FriendRequest extends BaseEntity {
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message?: string;
  responded_at?: Date;
}

export interface Friendship extends BaseEntity {
  user_id: string;
  friend_id: string;
  status: 'active' | 'blocked';
  created_at: Date;
}

export interface UserSearchResult {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  is_friend: boolean;
  friend_request_status?: 'pending' | 'sent' | 'none';
  mutual_friends_count: number;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  date_of_birth?: string;
  location?: string;
  website?: string;
  phone?: string;
  is_public?: boolean;
}

export interface UpdatePrivacyRequest {
  profile_visibility?: 'public' | 'friends' | 'private';
  email_visibility?: 'public' | 'friends' | 'private';
  phone_visibility?: 'public' | 'friends' | 'private';
  location_visibility?: 'public' | 'friends' | 'private';
  friend_list_visibility?: 'public' | 'friends' | 'private';
  post_visibility_default?: 'public' | 'friends' | 'private';
  allow_friend_requests?: boolean;
  allow_messages?: 'everyone' | 'friends' | 'none';
  allow_tagging?: boolean;
  allow_sharing?: boolean;
}

export interface SendFriendRequestRequest {
  addressee_id: string;
  message?: string;
}

export interface RespondFriendRequestRequest {
  request_id: string;
  action: 'accept' | 'decline';
}

export interface BlockUserRequest {
  user_id: string;
  reason?: string;
}

export interface UserError {
  code: 'USER_NOT_FOUND' | 'PROFILE_NOT_FOUND' | 'FRIEND_REQUEST_EXISTS' | 'ALREADY_FRIENDS' | 'CANNOT_FRIEND_SELF' | 'INVALID_PRIVACY_SETTING' | 'BLOCKED_USER' | 'PRIVACY_RESTRICTED';
  message: string;
  details?: any;
}
