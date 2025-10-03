import * as amqp from 'amqplib';
import { createLogger } from '@shared/types';

const logger = createLogger('rabbitmq-connection');

export interface RabbitMQConfig {
  url: string;
  reconnectDelay: number;
  maxReconnectAttempts: number;
}

export class RabbitMQConnection {
  private connection: any = null;
  private channel: any = null;
  private subscriber: any = null;
  private publisher: any = null;
  private static instance: RabbitMQConnection;
  private isConnected = false;
  private reconnectAttempts = 0;

  private constructor(config: RabbitMQConfig) {
    this.connect(config);
  }

  public static getInstance(config?: RabbitMQConfig): RabbitMQConnection {
    if (!RabbitMQConnection.instance) {
      if (!config) {
        throw new Error('RabbitMQ configuration required for first initialization');
      }
      RabbitMQConnection.instance = new RabbitMQConnection(config);
    }
    return RabbitMQConnection.instance;
  }

  private async connect(config: RabbitMQConfig): Promise<void> {
    try {
      this.connection = await amqp.connect(config.url);
      if (!this.connection) {
        throw new Error('Failed to establish RabbitMQ connection');
      }
      this.channel = await this.connection.createChannel();
      this.subscriber = await this.connection.createChannel();
      this.publisher = await this.connection.createChannel();

      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info('RabbitMQ connected successfully');

      // Handle connection errors
      if (this.connection) {
        this.connection.on('error', (err: Error) => {
          logger.error('RabbitMQ connection error:', err);
          this.isConnected = false;
        });

        this.connection.on('close', () => {
          logger.warn('RabbitMQ connection closed');
          this.isConnected = false;
          this.handleReconnect(config);
        });
      }
    } catch (error) {
      logger.error('RabbitMQ connection failed:', error);
      this.isConnected = false;
      this.handleReconnect(config);
    }
  }

  private handleReconnect(config: RabbitMQConfig): void {
    if (this.reconnectAttempts < config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.info(
        `Attempting to reconnect to RabbitMQ (${this.reconnectAttempts}/${config.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect(config);
      }, config.reconnectDelay);
    } else {
      logger.error('Max reconnection attempts reached. RabbitMQ connection failed.');
    }
  }

  getChannel(): any {
    if (!this.channel || !this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }
    return this.channel;
  }

  getSubscriber(): any {
    if (!this.subscriber || !this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }
    return this.subscriber;
  }

  getPublisher(): any {
    if (!this.publisher || !this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }
    return this.publisher;
  }

  isHealthy(): boolean {
    return this.isConnected && this.connection !== null;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.subscriber) {
        await this.subscriber.close();
      }
      if (this.publisher) {
        await this.publisher.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isConnected = false;
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (this.channel && this.isConnected) {
        // RabbitMQ doesn't have a direct ping, but we can check connection status
        return this.connection !== null && !this.connection.connection.destroyed;
      }
      return false;
    } catch (error) {
      logger.error('RabbitMQ ping failed:', error);
      return false;
    }
  }
}

// Initialize with default configuration
export const initializeRabbitMQ = (): RabbitMQConnection => {
  const config: RabbitMQConfig = {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    reconnectDelay: parseInt(process.env.RABBITMQ_RECONNECT_DELAY || '5000'),
    maxReconnectAttempts: parseInt(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS || '5'),
  };

  return RabbitMQConnection.getInstance(config);
};

export const rabbitMQConnection = initializeRabbitMQ();
