import { Client } from '@elastic/elasticsearch';
import { createLogger } from '@shared/types';

const logger = createLogger('elasticsearch-connection');

export interface ElasticsearchConfig {
  node: string;
  auth?: {
    username: string;
    password: string;
  };
  ssl?: {
    rejectUnauthorized: boolean;
  };
  requestTimeout: number;
  maxRetries: number;
}

export class ElasticsearchConnection {
  private client: Client;
  private static instance: ElasticsearchConnection;
  private isConnected = false;

  private constructor(config: ElasticsearchConfig) {
    const clientOptions: any = {
      node: config.node,
      requestTimeout: config.requestTimeout,
      maxRetries: config.maxRetries,
    };

    if (config.auth) {
      clientOptions.auth = config.auth;
    }

    this.client = new Client(clientOptions);

    this.setupEventHandlers();
  }

  public static getInstance(config?: ElasticsearchConfig): ElasticsearchConnection {
    if (!ElasticsearchConnection.instance) {
      if (!config) {
        throw new Error('Elasticsearch configuration required for first initialization');
      }
      ElasticsearchConnection.instance = new ElasticsearchConnection(config);
    }
    return ElasticsearchConnection.instance;
  }

  private setupEventHandlers(): void {
    // Note: Elasticsearch client doesn't have the same event system as Redis
    // Connection status is checked on each request
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      await this.client.ping();
      this.isConnected = true;
      logger.info('Elasticsearch connected successfully');
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

  isHealthy(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
      this.isConnected = false;
      logger.info('Elasticsearch connection closed');
    } catch (error) {
      logger.error('Error closing Elasticsearch connection:', error);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.client.ping();
      return response;
    } catch (error) {
      logger.error('Elasticsearch ping failed:', error);
      return false;
    }
  }
}

// Initialize with default configuration
export const initializeElasticsearch = (): ElasticsearchConnection => {
  const config: ElasticsearchConfig = {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    requestTimeout: parseInt(process.env.ELASTICSEARCH_REQUEST_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.ELASTICSEARCH_MAX_RETRIES || '3'),
  };

  if (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD) {
    config.auth = {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD,
    };
  }

  if (process.env.ELASTICSEARCH_SSL === 'true') {
    config.ssl = {
      rejectUnauthorized: false,
    };
  }

  return ElasticsearchConnection.getInstance(config);
};

export const elasticsearchConnection = initializeElasticsearch();
