// shared/src/types/common.ts → base types (ApiResponse, JWTConfig, etc.)
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  [key: string]: any;
}

export interface SearchParams extends PaginationParams, SortParams {
  q?: string;
  filters?: FilterParams;
}

export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface Timestamps {
  created_at: Date;
  updated_at: Date;
}

export interface SoftDelete {
  deleted_at?: Date;
}

export interface AuditFields extends Timestamps {
  created_by?: string;
  updated_by?: string;
}

export type ServiceName =
  | 'auth'
  | 'user'
  | 'post'
  | 'message'
  | 'media'
  | 'search'
  | 'notification';

export interface ServiceConfig {
  name: ServiceName;
  port: number;
  host: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface RabbitMQConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  vhost?: string;
}

export interface ElasticsearchConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
}

export interface LogLevel {
  level: 'error' | 'warn' | 'info' | 'debug';
  service: ServiceName;
  message: string;
  timestamp: Date;
  metadata?: any;
}
