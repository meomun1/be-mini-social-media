# Elasticsearch Search Engine

## 🔍 Overview

Elasticsearch provides powerful full-text search capabilities for our mini Facebook backend, enabling users to search posts, comments, users, and other content with advanced filtering and ranking.

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

## 📊 Index Mapping Configuration

### Posts Index
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

### Users Index
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

This Elasticsearch implementation provides powerful search capabilities with full-text search, filtering, suggestions, and analytics for our mini Facebook backend.
