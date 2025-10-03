import { RabbitMQConnection } from './connection';
import { createLogger } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('rabbitmq-message-broker');

export interface Message {
  messageId: string;
  eventType: string;
  timestamp: Date;
  source: string;
  data: any;
  version: string;
}

export interface MessageHandler {
  (message: Message): Promise<void>;
}

export interface QueueConfig {
  name: string;
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: any;
}

export interface ExchangeConfig {
  name: string;
  type: string;
  durable?: boolean;
  autoDelete?: boolean;
}

/**
 * Base message broker service that all microservices should extend
 * Provides common RabbitMQ operations for event-driven communication
 */
export abstract class BaseMessageBroker {
  protected rabbitMQ: RabbitMQConnection;
  protected serviceName: string;
  private readonly EXCHANGE_NAME = 'mini-facebook.events';
  private readonly EXCHANGE_TYPE = 'topic';

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.rabbitMQ = RabbitMQConnection.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      const publisher = this.rabbitMQ.getPublisher();
      await publisher.assertExchange(this.EXCHANGE_NAME, this.EXCHANGE_TYPE, {
        durable: true,
      });
      logger.info(`Message broker initialized for service: ${this.serviceName}`);
    } catch (error) {
      logger.error(`Failed to initialize message broker for service: ${this.serviceName}`, error);
      throw error;
    }
  }

  async publishEvent(eventType: string, data: any, routingKey?: string): Promise<boolean> {
    try {
      const publisher = this.rabbitMQ.getPublisher();

      const message: Message = {
        messageId: uuidv4(),
        eventType,
        timestamp: new Date(),
        source: this.serviceName,
        data,
        version: '1.0',
      };

      const key = routingKey || eventType;

      await publisher.publish(this.EXCHANGE_NAME, key, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        messageId: message.messageId,
        timestamp: message.timestamp.getTime(),
      });

      logger.info(`Event published successfully`, {
        service: this.serviceName,
        eventType,
        messageId: message.messageId,
        routingKey: key,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to publish event:`, {
        service: this.serviceName,
        eventType,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async subscribe(
    queueName: string,
    routingPatterns: string[],
    handler: MessageHandler,
    queueConfig: QueueConfig = { name: queueName }
  ): Promise<boolean> {
    try {
      const subscriber = this.rabbitMQ.getSubscriber();

      // Create queue
      const queue = await subscriber.assertQueue(queueConfig.name, {
        durable: queueConfig.durable ?? true,
        exclusive: queueConfig.exclusive ?? false,
        autoDelete: queueConfig.autoDelete ?? false,
        arguments: queueConfig.arguments,
      });

      // Bind queue to exchange with routing patterns
      for (const pattern of routingPatterns) {
        await subscriber.bindQueue(queue.queue, this.EXCHANGE_NAME, pattern);
      }

      // Set up consumer
      await subscriber.consume(queue.queue, async (msg: any) => {
        if (!msg) return;

        try {
          const message = JSON.parse(msg.content.toString()) as Message;
          await handler(message);

          // Acknowledge message after successful processing
          subscriber.ack(msg);

          logger.debug(`Message processed successfully`, {
            service: this.serviceName,
            queueName,
            eventType: message.eventType,
            messageId: message.messageId,
          });
        } catch (error) {
          logger.error(`Message processing failed:`, {
            service: this.serviceName,
            queueName,
            error: (error as Error).message,
          });

          // Reject and requeue message
          subscriber.nack(msg, false, true);
        }
      });

      logger.info(`Subscribed to queue successfully`, {
        service: this.serviceName,
        queueName,
        routingPatterns,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to queue:`, {
        service: this.serviceName,
        queueName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async createQueue(
    queueName: string,
    config: QueueConfig = { name: queueName }
  ): Promise<boolean> {
    try {
      const channel = this.rabbitMQ.getChannel();
      await channel.assertQueue(config.name, {
        durable: config.durable ?? true,
        exclusive: config.exclusive ?? false,
        autoDelete: config.autoDelete ?? false,
        arguments: config.arguments,
      });

      logger.info(`Queue created successfully`, {
        service: this.serviceName,
        queueName,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to create queue:`, {
        service: this.serviceName,
        queueName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async createExchange(config: ExchangeConfig): Promise<boolean> {
    try {
      const channel = this.rabbitMQ.getChannel();
      await channel.assertExchange(config.name, config.type, {
        durable: config.durable ?? true,
        autoDelete: config.autoDelete ?? false,
      });

      logger.info(`Exchange created successfully`, {
        service: this.serviceName,
        exchangeName: config.name,
        exchangeType: config.type,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to create exchange:`, {
        service: this.serviceName,
        exchangeName: config.name,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async bindQueue(queueName: string, exchangeName: string, routingKey: string): Promise<boolean> {
    try {
      const channel = this.rabbitMQ.getChannel();
      await channel.bindQueue(queueName, exchangeName, routingKey);

      logger.info(`Queue bound to exchange successfully`, {
        service: this.serviceName,
        queueName,
        exchangeName,
        routingKey,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to bind queue to exchange:`, {
        service: this.serviceName,
        queueName,
        exchangeName,
        routingKey,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async purgeQueue(queueName: string): Promise<number> {
    try {
      const channel = this.rabbitMQ.getChannel();
      const result = await channel.purgeQueue(queueName);

      logger.info(`Queue purged successfully`, {
        service: this.serviceName,
        queueName,
        purgedCount: result.messageCount,
      });

      return result.messageCount;
    } catch (error) {
      logger.error(`Failed to purge queue:`, {
        service: this.serviceName,
        queueName,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  async deleteQueue(queueName: string): Promise<boolean> {
    try {
      const channel = this.rabbitMQ.getChannel();
      await channel.deleteQueue(queueName);

      logger.info(`Queue deleted successfully`, {
        service: this.serviceName,
        queueName,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to delete queue:`, {
        service: this.serviceName,
        queueName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async getQueueInfo(queueName: string): Promise<any> {
    try {
      const channel = this.rabbitMQ.getChannel();
      const queue = await channel.checkQueue(queueName);
      return queue;
    } catch (error) {
      logger.error(`Failed to get queue info:`, {
        service: this.serviceName,
        queueName,
        error: (error as Error).message,
      });
      return null;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      return await this.rabbitMQ.ping();
    } catch (error) {
      logger.error(`Message broker health check failed`, {
        service: this.serviceName,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Abstract methods that each service should implement
  abstract initializeEventHandlers(): Promise<void>;
}
