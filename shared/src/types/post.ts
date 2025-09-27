import { BaseEntity, Timestamps } from './common';

export interface Post extends BaseEntity {
  user_id: string;
  content: string;
  media_urls?: string[];
  visibility: 'public' | 'friends' | 'private';
  location?: string;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  shares_count: number;
}

export interface Comment extends BaseEntity {
  post_id: string;
  user_id: string;
  content: string;
  parent_comment_id?: string;
  likes_count: number;
  replies_count: number;
  is_edited: boolean;
}

export interface Like extends BaseEntity {
  user_id: string;
  target_type: 'post' | 'comment';
  target_id: string;
}

export interface Share extends BaseEntity {
  user_id: string;
  post_id: string;
  message?: string;
}

export interface PostTag extends BaseEntity {
  post_id: string;
  tag: string;
}

export interface PostMention extends BaseEntity {
  post_id: string;
  mentioned_user_id: string;
  position: number;
}

export interface PostSearchResult {
  id: string;
  user_id: string;
  content: string;
  media_urls?: string[];
  visibility: 'public' | 'friends' | 'private';
  location?: string;
  created_at: Date;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  user: {
    id: string;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
  tags?: string[];
  mentions?: Array<{
    user_id: string;
    username: string;
    position: number;
  }>;
}

export interface CreatePostRequest {
  content: string;
  media_urls?: string[];
  visibility?: 'public' | 'friends' | 'private';
  location?: string;
  tags?: string[];
  mentions?: string[];
}

export interface UpdatePostRequest {
  content?: string;
  media_urls?: string[];
  visibility?: 'public' | 'friends' | 'private';
  location?: string;
  tags?: string[];
  mentions?: string[];
}

export interface CreateCommentRequest {
  content: string;
  parent_comment_id?: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface SharePostRequest {
  message?: string;
}

export interface PostFeedItem {
  post: PostSearchResult;
  user_has_liked: boolean;
  user_has_shared: boolean;
  user_can_edit: boolean;
  user_can_delete: boolean;
}

export interface PostFeedResponse {
  posts: PostFeedItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PostError {
  code: 'POST_NOT_FOUND' | 'COMMENT_NOT_FOUND' | 'ACCESS_DENIED' | 'CONTENT_TOO_LONG' | 'INVALID_VISIBILITY' | 'USER_NOT_FOUND' | 'ALREADY_LIKED' | 'NOT_LIKED' | 'INVALID_MEDIA_URL' | 'TOO_MANY_MEDIA';
  message: string;
  details?: any;
}
