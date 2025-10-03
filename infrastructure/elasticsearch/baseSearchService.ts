import { ElasticsearchConnection } from './connection';
import { createLogger } from '@shared/types';

const logger = createLogger('elasticsearch-search');

export interface SearchOptions {
  size?: number;
  from?: number;
  sort?: any[];
  filters?: any;
}

export interface SearchResult<T> {
  hits: T[];
  total: number;
  maxScore?: number | undefined;
}

/**
 * Base search service that all microservices should extend
 * Provides common Elasticsearch operations
 */
export abstract class BaseSearchService {
  protected elasticsearch: ElasticsearchConnection;
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.elasticsearch = ElasticsearchConnection.getInstance();
  }

  // Index operations
  async createIndex(indexName: string, mapping: any): Promise<boolean> {
    try {
      const client = this.elasticsearch.getClient();
      const exists = await client.indices.exists({ index: indexName });

      if (exists) {
        logger.info(`Index ${indexName} already exists`);
        return true;
      }

      await client.indices.create({
        index: indexName,
        ...mapping,
      });

      logger.info(`Index ${indexName} created successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to create index ${indexName}:`, error);
      return false;
    }
  }

  async deleteIndex(indexName: string): Promise<boolean> {
    try {
      const client = this.elasticsearch.getClient();
      await client.indices.delete({ index: indexName });
      logger.info(`Index ${indexName} deleted successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete index ${indexName}:`, error);
      return false;
    }
  }

  async indexDocument(indexName: string, id: string, document: any): Promise<boolean> {
    try {
      const client = this.elasticsearch.getClient();
      await client.index({
        index: indexName,
        id,
        body: document,
      });

      logger.debug(`Document indexed successfully`, {
        service: this.serviceName,
        index: indexName,
        id,
      });
      return true;
    } catch (error) {
      logger.error(`Failed to index document:`, {
        service: this.serviceName,
        index: indexName,
        id,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async updateDocument(indexName: string, id: string, document: any): Promise<boolean> {
    try {
      const client = this.elasticsearch.getClient();
      await client.update({
        index: indexName,
        id,
        body: {
          doc: document,
        },
      });

      logger.debug(`Document updated successfully`, {
        service: this.serviceName,
        index: indexName,
        id,
      });
      return true;
    } catch (error) {
      logger.error(`Failed to update document:`, {
        service: this.serviceName,
        index: indexName,
        id,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async deleteDocument(indexName: string, id: string): Promise<boolean> {
    try {
      const client = this.elasticsearch.getClient();
      await client.delete({
        index: indexName,
        id,
      });

      logger.debug(`Document deleted successfully`, {
        service: this.serviceName,
        index: indexName,
        id,
      });
      return true;
    } catch (error) {
      logger.error(`Failed to delete document:`, {
        service: this.serviceName,
        index: indexName,
        id,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async getDocument<T>(indexName: string, id: string): Promise<T | null> {
    try {
      const client = this.elasticsearch.getClient();
      const response = await client.get({
        index: indexName,
        id,
      });

      return response._source as T;
    } catch (error) {
      logger.error(`Failed to get document:`, {
        service: this.serviceName,
        index: indexName,
        id,
        error: (error as Error).message,
      });
      return null;
    }
  }

  // Search operations
  async search<T>(
    indexName: string,
    query: any,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>> {
    try {
      const client = this.elasticsearch.getClient();
      const searchBody: any = {
        query,
      };

      if (options.size) searchBody.size = options.size;
      if (options.from) searchBody.from = options.from;
      if (options.sort) searchBody.sort = options.sort;

      const response = await client.search({
        index: indexName,
        ...searchBody,
      });

      const hits = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _id: hit._id,
        _score: hit._score,
      }));

      return {
        hits,
        total:
          typeof response.hits.total === 'number'
            ? response.hits.total
            : response.hits.total?.value || 0,
        maxScore: response.hits.max_score || undefined,
      };
    } catch (error) {
      logger.error(`Search failed:`, {
        service: this.serviceName,
        index: indexName,
        error: (error as Error).message,
      });
      return {
        hits: [],
        total: 0,
      };
    }
  }

  async searchByTerm<T>(
    indexName: string,
    field: string,
    value: any,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>> {
    const query = {
      term: {
        [field]: value,
      },
    };

    return this.search<T>(indexName, query, options);
  }

  async searchByMatch<T>(
    indexName: string,
    field: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>> {
    const searchQuery = {
      match: {
        [field]: {
          query,
          fuzziness: 'AUTO',
        },
      },
    };

    return this.search<T>(indexName, searchQuery, options);
  }

  async searchByMultiMatch<T>(
    indexName: string,
    fields: string[],
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>> {
    const searchQuery = {
      multi_match: {
        query,
        fields,
        fuzziness: 'AUTO',
        type: 'best_fields',
      },
    };

    return this.search<T>(indexName, searchQuery, options);
  }

  // Bulk operations
  async bulkIndex(
    indexName: string,
    documents: Array<{ id: string; document: any }>
  ): Promise<boolean> {
    try {
      const client = this.elasticsearch.getClient();
      const body = documents.flatMap(({ id, document }) => [
        { index: { _index: indexName, _id: id } },
        document,
      ]);

      const response = await client.bulk({ body });

      if (response.errors) {
        logger.error(`Bulk index had errors:`, {
          service: this.serviceName,
          index: indexName,
          errors: response.items.filter((item: any) => item.index.error),
        });
        return false;
      }

      logger.info(`Bulk index completed successfully`, {
        service: this.serviceName,
        index: indexName,
        count: documents.length,
      });
      return true;
    } catch (error) {
      logger.error(`Bulk index failed:`, {
        service: this.serviceName,
        index: indexName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      return await this.elasticsearch.ping();
    } catch (error) {
      logger.error(`Search service health check failed`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Abstract methods that each service should implement
  abstract getIndexName(): string;
  abstract getIndexMapping(): any;
}
