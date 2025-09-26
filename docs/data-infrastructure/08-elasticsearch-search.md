# Elasticsearch Search Engine

## 🔍 Overview

Elasticsearch provides powerful full-text search capabilities for our mini Facebook backend microservices, enabling users to search posts, comments, users, and other content with advanced filtering and ranking. The Search Service (Port 3600) owns and manages all Elasticsearch operations while receiving indexing events from other microservices.

## 🏗️ Elasticsearch Setup

### Connection Management
```typescript
// infrastructure/elasticsearch/connection.ts
import { Client } from '@elastic/elasticsearch';
import { logger } from '@/shared/utils/logger';

class ElasticsearchConnection {
  private client: Client;
  private isConnected = false;

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || '',
        password: process.env.ELASTICSEARCH_PASSWORD || ''
      },
      maxRetries: 3,
      requestTimeout: 30000,
      sniffOnStart: true,
      sniffOnConnectionFault: true
    });
  }

  async connect(): Promise<void> {
    try {
      const health = await this.client.cluster.health();
      this.isConnected = true;
      logger.info('Elasticsearch connected', { 
        status: health.status,
        nodes: health.number_of_nodes 
      });
    } catch (error) {
      logger.error('Elasticsearch connection failed:', error);
      throw error;
    }
  }

  getClient(): Client {
    if (!this.isConnected) {
      throw new Error('Elasticsearch not connected');
    }
    return this.client;
  }

  async close(): Promise<void> {
    await this.client.close();
    this.isConnected = false;
    logger.info('Elasticsearch connection closed');
  }
}

export const elasticsearchConnection = new ElasticsearchConnection();
export const connectElasticsearch = () => elasticsearchConnection.connect();
```

## 🏗️ Microservices Integration

### Search Service Architecture
```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Post Service  │   │   User Service  │   │  Media Service  │
│   (Port 3300)   │   │   (Port 3200)   │   │   (Port 3500)   │
│ Publishes:      │   │ Publishes:      │   │ Publishes:      │
│ • post.created  │   │ • user.updated  │   │ • media.uploaded│
│ • post.updated  │   │ • user.deleted  │   │ • media.deleted │
│ • post.deleted  │   │                 │   │                 │
└─────────┬───────┘   └─────────┬───────┘   └─────────┬───────┘
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                   ┌───────────────────────────┐
                   │       Search Service      │ (Port 3600)
                   │  • Index posts/users/comments/media
                   │  • Exposes /search APIs   │
                   │  ┌──────────────────────┐ │
                   │  │   Elasticsearch      │ │
                   │  │  posts/users/comments│ │
                   │  │  media (indices)     │ │
                   │  └──────────────────────┘ │
                   └───────────────────────────┘
```

Search APIs (served by Search Service):
- GET /search/posts
- GET /search/users
- GET /search/comments
- GET /search/media

### Event-Driven Indexing
How documents reach Elasticsearch:
1) A domain change happens in the owning service (e.g., post.created).
2) The service publishes an event to RabbitMQ.
3) Search Service consumes the event and fetches the latest, authoritative record via the service’s REST API.
4) Search Service upserts/deletes the corresponding document in the ES index.
5) Queries hit ES for fast, relevance-ranked results (DB remains source of truth).

The Search Service listens to events from other microservices to keep search indices synchronized:

```typescript
// Search Service Event Handlers (Posts, Users, Comments, Media)
import { postSearchService } from './postSearchService';
import { userSearchService } from './userSearchService';
import { commentSearchService } from './commentSearchService';
import { mediaSearchService } from './mediaSearchService';

class SearchEventHandlers {
  // Post events
  async handlePostCreated(event: PostCreatedEvent): Promise<void> {
    await postSearchService.indexPost(event.data.post);
  }

  async handlePostUpdated(event: PostUpdatedEvent): Promise<void> {
    await postSearchService.updatePost(event.data.postId, event.data.updates);
  }

  async handlePostDeleted(event: PostDeletedEvent): Promise<void> {
    await postSearchService.deletePost(event.data.postId);
  }

  // User events
  async handleUserUpdated(event: UserUpdatedEvent): Promise<void> {
    await userSearchService.updateUser(event.data.userId, event.data.updates);
  }

  async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    await userSearchService.deleteUser(event.data.userId);
  }

  // Comment events
  async handleCommentCreated(event: CommentAddedEvent): Promise<void> {
    // Fetch full comment from Comment API if needed, or accept payload
    await commentSearchService.indexComment(event.data.comment);
  }

  async handleCommentUpdated(event: CommentUpdatedEvent): Promise<void> {
    await commentSearchService.updateComment(event.data.commentId, event.data.updates);
  }

  async handleCommentDeleted(event: CommentDeletedEvent): Promise<void> {
    await commentSearchService.deleteComment(event.data.commentId);
  }

  // Media events
  async handleMediaUploaded(event: MediaUploadedEvent): Promise<void> {
    await mediaSearchService.indexMedia(event.data.media);
  }

  async handleMediaUpdated(event: MediaUpdatedEvent): Promise<void> {
    await mediaSearchService.updateMedia(event.data.mediaId, event.data.updates);
  }

  async handleMediaDeleted(event: MediaDeletedEvent): Promise<void> {
    await mediaSearchService.deleteMedia(event.data.mediaId);
  }
}
```

## 📊 Index Mapping Configuration

### Users Index
```json
{
  "posts": {
    "mappings": {
      "properties": {
        "id": { "type": "keyword" },
        "userId": { "type": "keyword" },
        "user": {
          "properties": {
            "username": { "type": "keyword" },
            "firstName": { "type": "text" },
            "lastName": { "type": "text" },
            "profilePicture": { "type": "keyword" }
          }
        },
        "content": {
          "type": "text",
          "analyzer": "standard",
          "fields": {
            "keyword": { "type": "keyword" },
            "suggest": {
              "type": "completion",
              "analyzer": "simple",
              "preserve_separators": true,
              "preserve_position_increments": true,
              "max_input_length": 50
            }
          }
        },
        "tags": {
          "type": "keyword",
          "fields": {
            "text": { "type": "text" }
          }
        },
        "location": {
          "type": "geo_point",
          "fields": {
            "text": { "type": "text" }
          }
        },
        "privacyLevel": { "type": "keyword" },
        "likeCount": { "type": "integer" },
        "commentCount": { "type": "integer" },
        "shareCount": { "type": "integer" },
        "createdAt": { "type": "date" },
        "updatedAt": { "type": "date" }
      }
    },
    "settings": {
      "number_of_shards": 2,
      "number_of_replicas": 1,
      "analysis": {
        "analyzer": {
          "custom_text_analyzer": {
            "type": "custom",
            "tokenizer": "standard",
            "filter": ["lowercase", "stop", "snowball"]
          }
        }
      }
    }
  }
}
```

### Posts Index
```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "autocomplete": { "tokenizer": "standard", "filter": ["lowercase", "edge_ngram"] }
      },
      "filter": { "edge_ngram": { "type": "edge_ngram", "min_gram": 2, "max_gram": 20 } }
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "postId": { "type": "keyword" },
      "parentCommentId": { "type": "keyword" },
      "content": {
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword", "ignore_above": 256 },
          "suggest": { "type": "completion" },
          "autocomplete": { "type": "text", "analyzer": "autocomplete" }
        }
      },
      "author": {
        "properties": {
          "id": { "type": "keyword" },
          "username": { "type": "keyword" },
          "displayName": { "type": "text" },
          "avatarUrl": { "type": "keyword" }
        }
      },
      "likeCount": { "type": "integer" },
      "replyCount": { "type": "integer" },
      "isFlagged": { "type": "boolean" },
      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" },
      "privacyLevel": { "type": "keyword" },
      "indexedAt": { "type": "date" }
    }
  }
}
```

```ts
// indices/commentsIndex.ts
export async function ensureCommentsIndex(client: any): Promise<void> {
  const exists = await client.indices.exists({ index: 'comments' });
  if (!exists.body) {
    await client.indices.create({ index: 'comments', body: /* mapping above */ undefined });
  }
}
```

### Comments Index
```json
{
  "users": {
    "mappings": {
      "properties": {
        "id": { "type": "keyword" },
        "email": { "type": "keyword" },
        "username": {
          "type": "text",
          "fields": {
            "keyword": { "type": "keyword" },
            "suggest": {
              "type": "completion",
              "analyzer": "simple"
            }
          }
        },
        "firstName": { "type": "text" },
        "lastName": { "type": "text" },
        "fullName": {
          "type": "text",
          "analyzer": "standard"
        },
        "bio": { "type": "text" },
        "location": {
          "type": "text",
          "fields": {
            "keyword": { "type": "keyword" }
          }
        },
        "isVerified": { "type": "boolean" },
        "isActive": { "type": "boolean" },
        "createdAt": { "type": "date" },
        "updatedAt": { "type": "date" }
      }
    }
  }
}
```

### Media Index
```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "autocomplete": { "tokenizer": "standard", "filter": ["lowercase", "edge_ngram"] }
      },
      "filter": { "edge_ngram": { "type": "edge_ngram", "min_gram": 2, "max_gram": 20 } }
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "ownerId": { "type": "keyword" },
      "ownerUsername": { "type": "keyword" },
      "type": { "type": "keyword" },
      "mimeType": { "type": "keyword" },
      "width": { "type": "integer" },
      "height": { "type": "integer" },
      "duration": { "type": "float" },
      "altText": { "type": "text" },
      "extractedText": { "type": "text" },
      "tags": { "type": "keyword" },
      "contentSafetyLabels": { "type": "keyword" },
      "postId": { "type": "keyword" },
      "privacyLevel": { "type": "keyword" },
      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" },
      "indexedAt": { "type": "date" }
    }
  }
}
```

```ts
// indices/mediaIndex.ts
export async function ensureMediaIndex(client: any): Promise<void> {
  const exists = await client.indices.exists({ index: 'media' });
  if (!exists.body) {
    await client.indices.create({ index: 'media', body: /* mapping above */ undefined });
  }
}
```

## 🔧 Search Service Implementation

### Base Search Service
```typescript
// infrastructure/elasticsearch/searchService.ts
import { elasticsearchConnection } from './connection';
import { logger } from '@/shared/utils/logger';

export class SearchService {
  private client = elasticsearchConnection.getClient();

  async search<T>(
    index: string,
    query: any,
    options: {
      from?: number;
      size?: number;
      sort?: any[];
      highlight?: any;
      aggs?: any;
    } = {}
  ): Promise<{
    hits: T[];
    total: number;
    aggregations?: any;
    took: number;
  }> {
    try {
      const searchBody = {
        query,
        from: options.from || 0,
        size: options.size || 20,
        ...(options.sort && { sort: options.sort }),
        ...(options.highlight && { highlight: options.highlight }),
        ...(options.aggs && { aggs: options.aggs })
      };

      const response = await this.client.search({
        index,
        body: searchBody
      });

      return {
        hits: response.body.hits.hits.map((hit: any) => ({
          ...hit._source,
          _score: hit._score,
          _id: hit._id,
          ...(hit.highlight && { highlight: hit.highlight })
        })),
        total: response.body.hits.total.value,
        aggregations: response.body.aggregations,
        took: response.body.took
      };
    } catch (error) {
      logger.error('Search error:', { index, query, error });
      throw error;
    }
  }

  async indexDocument(index: string, id: string, document: any): Promise<void> {
    try {
      await this.client.index({
        index,
        id,
        body: document
      });
    } catch (error) {
      logger.error('Index document error:', { index, id, error });
      throw error;
    }
  }

  async updateDocument(index: string, id: string, document: any): Promise<void> {
    try {
      await this.client.update({
        index,
        id,
        body: {
          doc: document
        }
      });
    } catch (error) {
      logger.error('Update document error:', { index, id, error });
      throw error;
    }
  }

  async deleteDocument(index: string, id: string): Promise<void> {
    try {
      await this.client.delete({
        index,
        id
      });
    } catch (error) {
      logger.error('Delete document error:', { index, id, error });
      throw error;
    }
  }

  async bulkIndex(index: string, documents: Array<{ id: string; document: any }>): Promise<void> {
    try {
      const body = documents.flatMap(doc => [
        { index: { _index: index, _id: doc.id } },
        doc.document
      ]);

      await this.client.bulk({ body });
    } catch (error) {
      logger.error('Bulk index error:', { index, error });
      throw error;
    }
  }
}

export const searchService = new SearchService();
```

### Post Search Service
```typescript
// infrastructure/elasticsearch/postSearchService.ts
import { searchService } from './searchService';
import { logger } from '@/shared/utils/logger';

export class PostSearchService {
  private readonly INDEX_NAME = 'posts';

  async searchPosts(query: string, filters: {
    userId?: string;
    tags?: string[];
    location?: string;
    dateRange?: { from: Date; to: Date };
    privacyLevel?: string;
  } = {}): Promise<any[]> {
    const mustQueries: any[] = [];
    const shouldQueries: any[] = [];
    const filterQueries: any[] = [];

    // Main search query
    if (query.trim()) {
      mustQueries.push({
        multi_match: {
          query,
          fields: ['content^2', 'tags.text', 'user.username', 'user.firstName', 'user.lastName'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    } else {
      mustQueries.push({ match_all: {} });
    }

    // Filters
    if (filters.userId) {
      filterQueries.push({ term: { userId: filters.userId } });
    }

    if (filters.tags && filters.tags.length > 0) {
      filterQueries.push({ terms: { tags: filters.tags } });
    }

    if (filters.location) {
      filterQueries.push({
        geo_distance: {
          location: filters.location,
          distance: '10km'
        }
      });
    }

    if (filters.dateRange) {
      filterQueries.push({
        range: {
          createdAt: {
            gte: filters.dateRange.from.toISOString(),
            lte: filters.dateRange.to.toISOString()
          }
        }
      });
    }

    if (filters.privacyLevel) {
      filterQueries.push({ term: { privacyLevel: filters.privacyLevel } });
    }

    // Boost recent posts
    shouldQueries.push({
      function_score: {
        query: { match_all: {} },
        functions: [
          {
            gauss: {
              createdAt: {
                origin: 'now',
                scale: '7d',
                decay: 0.5
              }
            }
          }
        ],
        boost_mode: 'multiply'
      }
    });

    // Boost popular posts
    shouldQueries.push({
      function_score: {
        query: { match_all: {} },
        functions: [
          {
            field_value_factor: {
              field: 'likeCount',
              factor: 0.1,
              modifier: 'log1p'
            }
          }
        ],
        boost_mode: 'multiply'
      }
    });

    const searchQuery = {
      bool: {
        must: mustQueries,
        should: shouldQueries,
        filter: filterQueries,
        minimum_should_match: shouldQueries.length > 0 ? 1 : 0
      }
    };

    const result = await searchService.search(this.INDEX_NAME, searchQuery, {
      highlight: {
        fields: {
          content: {
            fragment_size: 150,
            number_of_fragments: 3
          }
        }
      }
    });

    return result.hits;
  }

  async searchSuggestions(query: string, size: number = 10): Promise<string[]> {
    const searchQuery = {
      suggest: {
        post_suggest: {
          prefix: query,
          completion: {
            field: 'content.suggest',
            size,
            skip_duplicates: true
          }
        }
      }
    };

    try {
      const response = await searchService.getClient().search({
        index: this.INDEX_NAME,
        body: searchQuery
      });

      return response.body.suggest.post_suggest[0].options.map(
        (option: any) => option.text
      );
    } catch (error) {
      logger.error('Search suggestions error:', { query, error });
      return [];
    }
  }

  async getTrendingPosts(limit: number = 20): Promise<any[]> {
    const query = {
      function_score: {
        query: { match_all: {} },
        functions: [
          {
            field_value_factor: {
              field: 'likeCount',
              factor: 1,
              modifier: 'log1p'
            }
          },
          {
            field_value_factor: {
              field: 'commentCount',
              factor: 2,
              modifier: 'log1p'
            }
          },
          {
            gauss: {
              createdAt: {
                origin: 'now',
                scale: '24h',
                decay: 0.5
              }
            }
          }
        ],
        boost_mode: 'multiply',
        score_mode: 'sum'
      }
    };

    const result = await searchService.search(this.INDEX_NAME, query, {
      size: limit,
      sort: [{ _score: { order: 'desc' } }]
    });

    return result.hits;
  }

  async indexPost(post: any): Promise<void> {
    const document = {
      ...post,
      fullName: `${post.user.firstName} ${post.user.lastName}`,
      indexedAt: new Date().toISOString()
    };

    await searchService.indexDocument(this.INDEX_NAME, post.id, document);
  }

  async updatePost(postId: string, updates: any): Promise<void> {
    await searchService.updateDocument(this.INDEX_NAME, postId, updates);
  }

  async deletePost(postId: string): Promise<void> {
    await searchService.deleteDocument(this.INDEX_NAME, postId);
  }
}

export const postSearchService = new PostSearchService();
```

### User Search Service
```typescript
// infrastructure/elasticsearch/userSearchService.ts
import { searchService } from './searchService';
import { logger } from '@/shared/utils/logger';

export class UserSearchService {
  private readonly INDEX_NAME = 'users';

  async searchUsers(query: string, filters: {
    isVerified?: boolean;
    isActive?: boolean;
    location?: string;
  } = {}): Promise<any[]> {
    const mustQueries: any[] = [];
    const filterQueries: any[] = [];

    // Main search query
    if (query.trim()) {
      mustQueries.push({
        multi_match: {
          query,
          fields: [
            'username^3',
            'firstName^2',
            'lastName^2',
            'fullName^2',
            'bio'
          ],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    } else {
      mustQueries.push({ match_all: {} });
    }

    // Filters
    if (filters.isVerified !== undefined) {
      filterQueries.push({ term: { isVerified: filters.isVerified } });
    }

    if (filters.isActive !== undefined) {
      filterQueries.push({ term: { isActive: filters.isActive } });
    }

    if (filters.location) {
      filterQueries.push({
        match: {
          location: filters.location
        }
      });
    }

    const searchQuery = {
      bool: {
        must: mustQueries,
        filter: filterQueries
      }
    };

    const result = await searchService.search(this.INDEX_NAME, searchQuery, {
      highlight: {
        fields: {
          username: {},
          firstName: {},
          lastName: {},
          bio: {
            fragment_size: 100,
            number_of_fragments: 2
          }
        }
      }
    });

    return result.hits;
  }

  async searchSuggestions(query: string, size: number = 10): Promise<string[]> {
    const searchQuery = {
      suggest: {
        user_suggest: {
          prefix: query,
          completion: {
            field: 'username.suggest',
            size,
            skip_duplicates: true
          }
        }
      }
    };

    try {
      const response = await searchService.getClient().search({
        index: this.INDEX_NAME,
        body: searchQuery
      });

      return response.body.suggest.user_suggest[0].options.map(
        (option: any) => option.text
      );
    } catch (error) {
      logger.error('User search suggestions error:', { query, error });
      return [];
    }
  }

  async indexUser(user: any): Promise<void> {
    const document = {
      ...user,
      fullName: `${user.firstName} ${user.lastName}`,
      indexedAt: new Date().toISOString()
    };

    await searchService.indexDocument(this.INDEX_NAME, user.id, document);
  }

  async updateUser(userId: string, updates: any): Promise<void> {
    await searchService.updateDocument(this.INDEX_NAME, userId, updates);
  }

  async deleteUser(userId: string): Promise<void> {
    await searchService.deleteDocument(this.INDEX_NAME, userId);
  }
}

export const userSearchService = new UserSearchService();
```

### Comment Search Service
```ts
// infrastructure/elasticsearch/commentSearchService.ts
import { elasticsearchConnection } from './connection';

export class CommentSearchService {
  private client = elasticsearchConnection.getClient();
  private index = 'comments';

  async search(query: string, filters: { postId?: string }, from = 0, size = 20) {
    const must: any[] = [];
    if (query) must.push({ match: { content: query } });
    if (filters.postId) must.push({ term: { postId: filters.postId } });

    return this.client.search({
      index: this.index,
      from,
      size,
      body: {
        query: { bool: { must } },
        sort: [{ createdAt: 'desc' }]
      }
    });
  }

  async indexComment(doc: any) {
    await this.client.index({ index: this.index, id: doc.id, body: doc, refresh: 'wait_for' });
  }

  async updateComment(id: string, partial: any) {
    await this.client.update({ index: this.index, id, body: { doc: partial }, refresh: 'wait_for' });
  }

  async deleteComment(id: string) {
    await this.client.delete({ index: this.index, id, refresh: 'wait_for' });
  }
}
export const commentSearchService = new CommentSearchService();
```

### Media Search Service
```ts
// infrastructure/elasticsearch/mediaSearchService.ts
import { elasticsearchConnection } from './connection';

export class MediaSearchService {
  private client = elasticsearchConnection.getClient();
  private index = 'media';

  async search(query: string, filters: { ownerId?: string; type?: string }, from = 0, size = 20) {
    const must: any[] = [];
    if (query) must.push({ multi_match: { query, fields: ['altText', 'extractedText', 'tags'] } });
    if (filters.ownerId) must.push({ term: { ownerId: filters.ownerId } });
    if (filters.type) must.push({ term: { type: filters.type } });

    return this.client.search({
      index: this.index,
      from,
      size,
      body: {
        query: { bool: { must } },
        sort: [{ createdAt: 'desc' }]
      }
    });
  }

  async indexMedia(doc: any) {
    await this.client.index({ index: this.index, id: doc.id, body: doc, refresh: 'wait_for' });
  }

  async updateMedia(id: string, partial: any) {
    await this.client.update({ index: this.index, id, body: { doc: partial }, refresh: 'wait_for' });
  }

  async deleteMedia(id: string) {
    await this.client.delete({ index: this.index, id, refresh: 'wait_for' });
  }
}
export const mediaSearchService = new MediaSearchService();
```

## 📊 Analytics and Insights

### Search Analytics Service
```typescript
// infrastructure/elasticsearch/searchAnalyticsService.ts
import { searchService } from './searchService';
import { logger } from '@/shared/utils/logger';

export class SearchAnalyticsService {
  async getPopularSearches(timeRange: string = '7d'): Promise<any[]> {
    const query = {
      aggs: {
        popular_searches: {
          terms: {
            field: 'query.keyword',
            size: 20
          }
        }
      }
    };

    const result = await searchService.search('search_logs', query, {
      size: 0
    });

    return result.aggregations.popular_searches.buckets;
  }

  async getSearchTrends(timeRange: string = '30d'): Promise<any[]> {
    const query = {
      aggs: {
        search_trends: {
          date_histogram: {
            field: 'timestamp',
            calendar_interval: 'day'
          },
          aggs: {
            unique_searches: {
              cardinality: {
                field: 'userId'
              }
            }
          }
        }
      }
    };

    const result = await searchService.search('search_logs', query, {
      size: 0
    });

    return result.aggregations.search_trends.buckets;
  }

  async logSearch(query: string, userId: string, results: number): Promise<void> {
    const document = {
      query,
      userId,
      resultsCount: results,
      timestamp: new Date().toISOString()
    };

    await searchService.indexDocument('search_logs', undefined, document);
  }
}

export const searchAnalyticsService = new SearchAnalyticsService();
```

## 🔧 Service-Specific Document Types

### Document Type Definitions
```typescript
// shared/types/search.ts
export interface PostDocument {
  id: string;
  userId: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  content: string;
  mediaUrls: string[];
  tags: string[];
  location?: {
    lat: number;
    lon: number;
    name: string;
  };
  privacyLevel: 'public' | 'friends' | 'custom';
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
  indexedAt: string;
}

export interface UserDocument {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  bio?: string;
  location?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  indexedAt: string;
}

export interface CommentDocument {
  id: string;
  postId: string;
  userId: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  content: string;
  parentCommentId?: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  indexedAt: string;
}

export interface MediaDocument {
  id: string;
  userId: string;
  user: {
    id: string;
    username: string;
  };
  originalFilename: string;
  fileType: 'image' | 'video' | 'audio' | 'document';
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  indexedAt: string;
}
```

## 🔄 Cross-Service Data Synchronization

### Data Consistency Strategy
Since each microservice owns its data, the Search Service maintains search indices through events:

```typescript
// Search Service Event Consumer
class SearchEventConsumer {
  constructor(
    private rabbitMQConsumer: RabbitMQConsumer,
    private postSearchService: PostSearchService,
    private userSearchService: UserSearchService,
    private commentSearchService: CommentSearchService,
    private mediaSearchService: MediaSearchService
  ) {}

  async startConsuming(): Promise<void> {
    // Post events
    await this.rabbitMQConsumer.subscribe('post.created', this.handlePostCreated.bind(this));
    await this.rabbitMQConsumer.subscribe('post.updated', this.handlePostUpdated.bind(this));
    await this.rabbitMQConsumer.subscribe('post.deleted', this.handlePostDeleted.bind(this));

    // User events
    await this.rabbitMQConsumer.subscribe('user.registered', this.handleUserRegistered.bind(this));
    await this.rabbitMQConsumer.subscribe('user.profile.updated', this.handleUserUpdated.bind(this));
    await this.rabbitMQConsumer.subscribe('user.deleted', this.handleUserDeleted.bind(this));

    // Comment events
    await this.rabbitMQConsumer.subscribe('comment.added', this.handleCommentAdded.bind(this));
    await this.rabbitMQConsumer.subscribe('comment.updated', this.handleCommentUpdated.bind(this));
    await this.rabbitMQConsumer.subscribe('comment.deleted', this.handleCommentDeleted.bind(this));

    // Media events
    await this.rabbitMQConsumer.subscribe('media.uploaded', this.handleMediaUploaded.bind(this));
    await this.rabbitMQConsumer.subscribe('media.deleted', this.handleMediaDeleted.bind(this));
  }

  private async handlePostCreated(event: PostCreatedEvent): Promise<void> {
    try {
      // Fetch full post data from Post Service
      const post = await this.fetchPostFromService(event.data.postId);
      await this.postSearchService.indexPost(post);
      
      logger.info('Post indexed successfully', { postId: event.data.postId });
    } catch (error) {
      logger.error('Failed to index post', { postId: event.data.postId, error });
      // Implement retry logic or dead letter queue
    }
  }

  private async fetchPostFromService(postId: string): Promise<PostDocument> {
    // Call Post Service API to get full post data
    const response = await axios.get(`${process.env.POST_SERVICE_URL}/api/v1/posts/${postId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.SERVICE_TOKEN}`,
        'X-Service-ID': 'search-service'
      }
    });
    
    return response.data.data;
  }
}
```

### Search Service API Integration
```typescript
// Search Service Controller
export class SearchController {
  constructor(
    private postSearchService: PostSearchService,
    private userSearchService: UserSearchService,
    private commentSearchService: CommentSearchService,
    private mediaSearchService: MediaSearchService
  ) {}

  async searchPosts(req: Request, res: Response): Promise<void> {
    try {
      const { q, filters } = req.query;
      const userId = req.user?.id;

      // Apply privacy filters based on user context
      const searchFilters = {
        ...filters,
        userId: userId, // Only show posts user can see
        privacyLevel: this.determinePrivacyLevel(userId, filters)
      };

      const results = await this.postSearchService.searchPosts(q as string, searchFilters);
      
      res.json({
        success: true,
        data: {
          posts: results,
          pagination: {
            total: results.length,
            limit: parseInt(req.query.limit as string) || 20,
            offset: parseInt(req.query.offset as string) || 0
          }
        }
      });
    } catch (error) {
      logger.error('Search posts error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SEARCH_FAILED', message: 'Search failed. Please try again.' }
      });
    }
  }

  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { q, isVerified, isActive, location } = req.query as any;
      const results = await this.userSearchService.searchUsers(q as string || '', {
        isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        location
      });

      res.json({ success: true, data: { users: results } });
    } catch (error) {
      logger.error('Search users error:', error);
      res.status(500).json({ success: false, error: { code: 'SEARCH_FAILED', message: 'Search failed. Please try again.' } });
    }
  }

  async searchComments(req: Request, res: Response): Promise<void> {
    try {
      const { q, postId, from, size } = req.query as any;
      const response = await this.commentSearchService.search(q as string || '', { postId }, parseInt(from || '0', 10), parseInt(size || '20', 10));
      res.json({ success: true, data: response.body?.hits?.hits?.map((h: any) => h._source) || [] });
    } catch (error) {
      logger.error('Search comments error:', error);
      res.status(500).json({ success: false, error: { code: 'SEARCH_FAILED', message: 'Search failed. Please try again.' } });
    }
  }

  async searchMedia(req: Request, res: Response): Promise<void> {
    try {
      const { q, ownerId, type, from, size } = req.query as any;
      const response = await this.mediaSearchService.search(
        q as string || '',
        { ownerId, type },
        parseInt(from || '0', 10),
        parseInt(size || '20', 10)
      );
      res.json({ success: true, data: response.body?.hits?.hits?.map((h: any) => h._source) || [] });
    } catch (error) {
      logger.error('Search media error:', error);
      res.status(500).json({ success: false, error: { code: 'SEARCH_FAILED', message: 'Search failed. Please try again.' } });
    }
  }

  private determinePrivacyLevel(userId: string | undefined, filters: any): string[] {
    if (!userId) {
      return ['public']; // Anonymous users only see public posts
    }
    
    return ['public', 'friends']; // Authenticated users see public and friends' posts
  }
}
```