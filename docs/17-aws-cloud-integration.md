# AWS Cloud Integration

## ☁️ Overview

AWS provides managed services that can replace or enhance our self-hosted components, offering better scalability, reliability, and operational simplicity for our mini Facebook backend.

## 🏗️ AWS Architecture for Mini Facebook

### High-Level AWS Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   Route 53      │    │   WAF           │
│   CDN           │    │   DNS           │    │   Security      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       ▼                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ALB           │    │   EKS           │    │   ECS           │
│   Load Balancer │    │   Kubernetes    │    │   Containers    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       ▼                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   RDS           │    │   ElastiCache   │    │   OpenSearch    │
│   PostgreSQL    │    │   Redis         │    │   Elasticsearch │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🗄️ Database Services

### Amazon RDS for PostgreSQL
```yaml
# AWS RDS Configuration
# Replace self-hosted PostgreSQL

RDS Configuration:
  Engine: PostgreSQL 15
  Instance Class: db.t3.medium (dev) / db.r5.large (prod)
  Multi-AZ: true (production)
  Storage: 
    Type: gp3
    Size: 100GB (dev) / 1TB (prod)
    IOPS: 3000 (prod)
  Backup:
    Retention: 7 days (dev) / 30 days (prod)
    Automated: true
  Monitoring: Enhanced monitoring with CloudWatch
  Security:
    Encryption: at rest and in transit
    VPC: Private subnets only
    Security Groups: Restricted access

Benefits:
  - Automated backups and point-in-time recovery
  - Automated failover with Multi-AZ
  - Read replicas for scaling reads
  - Performance Insights for optimization
  - Automated minor version upgrades
```

### Database Connection Updates
```typescript
// infrastructure/database/aws-rds-connection.ts
import { Pool } from 'pg';
import { logger } from '@/shared/utils/logger';

class AWSRDSConnection {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      // Use RDS endpoint
      host: process.env.RDS_HOSTNAME || process.env.DATABASE_HOST,
      port: parseInt(process.env.RDS_PORT || '5432'),
      database: process.env.RDS_DB_NAME || process.env.DATABASE_NAME,
      user: process.env.RDS_USERNAME || process.env.DATABASE_USER,
      password: process.env.RDS_PASSWORD || process.env.DATABASE_PASSWORD,
      
      // SSL configuration for RDS
      ssl: {
        rejectUnauthorized: false,
        ca: process.env.RDS_CA_CERT // RDS CA certificate
      },
      
      // Connection pool settings optimized for RDS
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      
      // RDS-specific optimizations
      application_name: 'mini-facebook-backend',
      statement_timeout: 30000,
      query_timeout: 30000
    });
  }

  // Enable connection pooling with RDS Proxy (optional)
  async enableRDSProxy(): Promise<void> {
    // RDS Proxy provides connection pooling and failover
    // Update connection string to use RDS Proxy endpoint
    const proxyEndpoint = process.env.RDS_PROXY_ENDPOINT;
    if (proxyEndpoint) {
      this.pool = new Pool({
        ...this.pool.options,
        host: proxyEndpoint
      });
    }
  }
}
```

## 🔴 Caching Services

### Amazon ElastiCache for Redis
```yaml
# ElastiCache Redis Configuration
# Replace self-hosted Redis

ElastiCache Configuration:
  Engine: Redis 7
  Node Type: cache.t3.micro (dev) / cache.r6g.large (prod)
  Cluster Mode: disabled (single node) / enabled (cluster mode)
  Multi-AZ: true (production)
  Security:
    Encryption: in transit and at rest
    Auth Token: enabled
    VPC: Private subnets
  Backup:
    Snapshot: daily (prod)
    Retention: 7 days (dev) / 30 days (prod)
  Monitoring: CloudWatch metrics and alarms

Benefits:
  - Automatic failover and backup
  - Cluster mode for horizontal scaling
  - Integration with CloudWatch
  - Security groups for network access control
```

### Redis Connection Updates
```typescript
// infrastructure/redis/aws-elasticache-connection.ts
import { createClient, RedisClientType } from 'redis';
import { logger } from '@/shared/utils/logger';

class AWSElastiCacheConnection {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      // Use ElastiCache endpoint
      url: `redis://${process.env.ELASTICACHE_ENDPOINT}:6379`,
      
      // ElastiCache with AUTH token
      password: process.env.ELASTICACHE_AUTH_TOKEN,
      
      // SSL for encryption in transit
      socket: {
        tls: true,
        rejectUnauthorized: false
      },
      
      // Connection settings
      retry_delay_on_failover: 100,
      enable_offline_queue: false,
      lazyConnect: true
    });
  }

  // Cluster mode support
  async enableClusterMode(): Promise<void> {
    if (process.env.ELASTICACHE_CLUSTER_MODE === 'true') {
      // Use Redis cluster client for cluster mode
      const { Cluster } = require('ioredis');
      this.client = new Cluster([
        {
          host: process.env.ELASTICACHE_CLUSTER_ENDPOINT,
          port: 6379
        }
      ], {
        redisOptions: {
          password: process.env.ELASTICACHE_AUTH_TOKEN,
          tls: {}
        }
      });
    }
  }
}
```

## 🔍 Search Services

### Amazon OpenSearch Service
```yaml
# OpenSearch Service Configuration
# Replace self-hosted Elasticsearch

OpenSearch Configuration:
  Engine: OpenSearch 2.11 (Elasticsearch 8.11 compatible)
  Instance Type: t3.small.search (dev) / r6g.large.search (prod)
  Instance Count: 1 (dev) / 3 (prod)
  Multi-AZ: true (production)
  Storage:
    Volume Type: gp3
    Volume Size: 20GB (dev) / 100GB (prod)
  Security:
    Encryption: at rest and in transit
    Domain Access Policy: VPC-only access
    Fine-grained Access Control: enabled
  Monitoring: CloudWatch logs and metrics

Benefits:
  - Managed service with automatic updates
  - Built-in security and encryption
  - Integration with CloudWatch
  - Automatic scaling and backup
```

### OpenSearch Connection Updates
```typescript
// infrastructure/elasticsearch/aws-opensearch-connection.ts
import { Client } from '@opensearch-project/opensearch';
import { logger } from '@/shared/utils/logger';

class AWSOpenSearchConnection {
  private client: Client;

  constructor() {
    this.client = new Client({
      // Use OpenSearch Service endpoint
      node: `https://${process.env.OPENSEARCH_ENDPOINT}`,
      
      // AWS IAM authentication
      auth: {
        username: process.env.OPENSEARCH_USERNAME,
        password: process.env.OPENSEARCH_PASSWORD
      },
      
      // SSL configuration
      ssl: {
        rejectUnauthorized: false
      },
      
      // Connection settings
      requestTimeout: 30000,
      pingTimeout: 3000,
      maxRetries: 3
    });
  }

  // Use AWS IAM for authentication (recommended)
  async enableIAMAuth(): Promise<void> {
    const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');
    
    this.client = new Client({
      ...this.client.options,
      ...AwsSigv4Signer({
        region: process.env.AWS_REGION,
        getCredentials: () => {
          const credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            sessionToken: process.env.AWS_SESSION_TOKEN
          };
          return Promise.resolve(credentials);
        }
      })
    });
  }
}
```

## 🚀 Container Services

### Amazon EKS (Elastic Kubernetes Service)
```yaml
# EKS Cluster Configuration
# Replace self-managed Kubernetes

EKS Configuration:
  Kubernetes Version: 1.28
  Cluster Endpoint: Private (production)
  Node Groups:
    - Name: general-purpose
      Instance Types: [t3.medium, t3.large]
      Min Size: 2
      Max Size: 10
      Desired Size: 3
    - Name: compute-optimized
      Instance Types: [c5.large, c5.xlarge]
      Min Size: 0
      Max Size: 5
      Desired Size: 0
  Networking:
    VPC: Custom VPC
    Subnets: Private and public subnets
    Security Groups: EKS managed
  Add-ons:
    - AWS Load Balancer Controller
    - AWS EBS CSI Driver
    - CoreDNS
    - kube-proxy
    - VPC CNI

Benefits:
  - Managed Kubernetes control plane
  - Integration with AWS services
  - Automatic updates and patches
  - Built-in security and networking
```

### EKS Deployment Updates
```yaml
# k8s/aws-eks-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: mini-facebook
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: 123456789012.dkr.ecr.us-west-2.amazonaws.com/mini-facebook/gateway:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: aws-rds-secret
              key: connection-string
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: aws-elasticache-secret
              key: connection-string
        - name: ELASTICSEARCH_URL
          valueFrom:
            secretKeyRef:
              name: aws-opensearch-secret
              key: endpoint
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-service
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
    service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
spec:
  type: LoadBalancer
  selector:
    app: api-gateway
  ports:
  - port: 80
    targetPort: 3000
```

### Amazon ECR (Elastic Container Registry)
```bash
# ECR Repository Setup
# Replace Docker Hub or other registries

# Create ECR repositories
aws ecr create-repository --repository-name mini-facebook/gateway
aws ecr create-repository --repository-name mini-facebook/auth-service
aws ecr create-repository --repository-name mini-facebook/user-service
aws ecr create-repository --repository-name mini-facebook/post-service
aws ecr create-repository --repository-name mini-facebook/message-service
aws ecr create-repository --repository-name mini-facebook/media-service
aws ecr create-repository --repository-name mini-facebook/search-service
aws ecr create-repository --repository-name mini-facebook/notification-service

# Get login token
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-west-2.amazonaws.com

# Build and push images
docker build -t 123456789012.dkr.ecr.us-west-2.amazonaws.com/mini-facebook/gateway:latest .
docker push 123456789012.dkr.ecr.us-west-2.amazonaws.com/mini-facebook/gateway:latest
```

## 🌐 Networking & Load Balancing

### Application Load Balancer (ALB)
```yaml
# ALB Configuration
# Replace Nginx load balancer

ALB Configuration:
  Scheme: Internet-facing (or Internal for private)
  IP Address Type: IPv4
  Security Groups:
    - Allow HTTP (80) from 0.0.0.0/0
    - Allow HTTPS (443) from 0.0.0.0/0
  Listeners:
    - Port: 80 (HTTP) -> Redirect to HTTPS
    - Port: 443 (HTTPS) -> Forward to target groups
  Target Groups:
    - Name: mini-facebook-api
      Protocol: HTTP
      Port: 3000
      Health Check Path: /health
      Health Check Interval: 30s
      Health Check Timeout: 5s
      Healthy Threshold: 2
      Unhealthy Threshold: 3
  SSL Certificate: ACM certificate for HTTPS

Benefits:
  - Layer 7 load balancing
  - SSL termination
  - Health checks and auto-scaling integration
  - Path-based routing
  - Integration with EKS and ECS
```

### AWS WAF (Web Application Firewall)
```yaml
# WAF Configuration
# Additional security layer

WAF Rules:
  - AWSManagedRulesCommonRuleSet
  - AWSManagedRulesKnownBadInputsRuleSet
  - AWSManagedRulesSQLiRuleSet
  - AWSManagedRulesLinuxOperatingSystemRuleSet
  - Custom Rules:
    - Rate limiting: 2000 requests per 5 minutes per IP
    - Geo blocking: Block specific countries
    - IP whitelist: Allow only specific IPs
    - SQL injection protection
    - XSS protection
    - Size restrictions

Integration:
  - CloudFront distribution
  - Application Load Balancer
  - API Gateway
```

## 📡 Message Queue Services

### Amazon SQS (Simple Queue Service)
```yaml
# SQS Configuration
# Alternative to RabbitMQ for simple use cases

SQS Queues:
  - Name: mini-facebook-notifications
    Type: Standard
    Visibility Timeout: 30 seconds
    Message Retention: 14 days
    Dead Letter Queue: enabled
  - Name: mini-facebook-search-indexing
    Type: Standard
    Visibility Timeout: 60 seconds
    Message Retention: 14 days
  - Name: mini-facebook-analytics
    Type: FIFO
    Content-based Deduplication: enabled
    Message Group ID: user-activity

Benefits:
  - Fully managed message queuing
  - Automatic scaling
  - Dead letter queues
  - Integration with Lambda and other AWS services
```

### Amazon SNS (Simple Notification Service)
```yaml
# SNS Configuration
# For pub/sub messaging

SNS Topics:
  - Name: mini-facebook-events
    Type: Standard
    Subscribers:
      - Lambda function (notifications)
      - SQS queue (analytics)
      - Email (admin alerts)
  - Name: mini-facebook-user-updates
    Type: Standard
    Subscribers:
      - Elasticsearch indexing Lambda
      - Cache invalidation Lambda

Benefits:
  - Pub/sub messaging
  - Multiple delivery protocols
  - Message filtering
  - Integration with Lambda, SQS, Email, SMS
```

### SQS/SNS Integration
```typescript
// infrastructure/messaging/aws-sqs-sns.ts
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

class AWSMessagingService {
  private sqsClient: SQSClient;
  private snsClient: SNSClient;

  constructor() {
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    this.snsClient = new SNSClient({ region: process.env.AWS_REGION });
  }

  async publishEvent(topicArn: string, message: any): Promise<void> {
    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: message.eventType
        }
      }
    });

    await this.snsClient.send(command);
  }

  async sendToQueue(queueUrl: string, message: any): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        messageType: {
          DataType: 'String',
          StringValue: message.type
        }
      }
    });

    await this.sqsClient.send(command);
  }
}
```

## 📁 File Storage Services

### Amazon S3 (Simple Storage Service)
```yaml
# S3 Configuration
# For media files and static assets

S3 Buckets:
  - Name: mini-facebook-media-prod
    Region: us-west-2
    Versioning: Enabled
    Encryption: AES-256
    Lifecycle:
      - Transition to IA after 30 days
      - Transition to Glacier after 90 days
      - Delete incomplete multipart uploads after 7 days
    CORS:
      - Allowed Origins: [https://app.minifacebook.com]
      - Allowed Methods: [GET, POST, PUT, DELETE]
      - Allowed Headers: [Authorization, Content-Type]
  - Name: mini-facebook-static-assets
    Region: us-west-2
    Public Read: true
    CloudFront Distribution: enabled

Benefits:
  - Unlimited storage capacity
  - High durability (99.999999999%)
  - Lifecycle policies for cost optimization
  - Integration with CloudFront CDN
  - Event notifications
```

### S3 Integration
```typescript
// infrastructure/storage/aws-s3-service.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

class AWSS3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    this.bucketName = process.env.S3_BUCKET_NAME!;
  }

  async uploadFile(key: string, file: Buffer, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: contentType,
      ACL: 'private' // or 'public-read' for public files
    });

    await this.s3Client.send(command);
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    await this.s3Client.send(command);
  }
}
```

## 🔒 Security Services

### AWS Secrets Manager
```yaml
# Secrets Manager Configuration
# Centralized secret management

Secrets:
  - Name: mini-facebook/rds-credentials
    Description: RDS database credentials
    Rotation: Enabled (every 30 days)
    KMS Key: Customer managed key
  - Name: mini-facebook/jwt-secrets
    Description: JWT signing keys
    Rotation: Enabled (every 90 days)
  - Name: mini-facebook/api-keys
    Description: Third-party API keys
    Rotation: Manual

Benefits:
  - Automatic rotation
  - Encryption at rest and in transit
  - Fine-grained access control
  - Integration with RDS, Lambda, ECS, EKS
  - Audit logging with CloudTrail
```

### AWS IAM (Identity and Access Management)
```yaml
# IAM Configuration
# Role-based access control

IAM Roles:
  - Name: MiniFacebookEKSNodeRole
    Policies:
      - AmazonEKSWorkerNodePolicy
      - AmazonEKS_CNI_Policy
      - AmazonEC2ContainerRegistryReadOnly
      - Custom: S3Access, SecretsManagerAccess
  - Name: MiniFacebookServiceRole
    Policies:
      - RDSFullAccess
      - ElastiCacheFullAccess
      - OpenSearchFullAccess
      - S3FullAccess
      - SQSFullAccess
      - SNSPublishAccess

IAM Policies:
  - Name: MiniFacebookSecretsAccess
    Resources: 
      - arn:aws:secretsmanager:*:*:secret:mini-facebook/*
    Actions:
      - secretsmanager:GetSecretValue
      - secretsmanager:DescribeSecret
```

## 📊 Monitoring & Logging

### Amazon CloudWatch
```yaml
# CloudWatch Configuration
# Centralized monitoring and logging

CloudWatch Logs:
  - Log Groups:
    - /aws/eks/mini-facebook/cluster
    - /aws/rds/mini-facebook/postgresql
    - /aws/elasticache/mini-facebook/redis
    - /aws/opensearch/mini-facebook/domain
  - Log Retention: 30 days (dev) / 90 days (prod)
  - Encryption: KMS

CloudWatch Metrics:
  - Custom Metrics:
    - API response times
    - User registration rate
    - Post creation rate
    - Message delivery rate
  - Alarms:
    - High error rate (>5%)
    - High response time (>500ms)
    - Low disk space (<10%)
    - High CPU utilization (>80%)

CloudWatch Dashboards:
  - Mini Facebook Backend Overview
  - Database Performance
  - API Performance
  - Error Tracking
```

### AWS X-Ray (Distributed Tracing)
```typescript
// infrastructure/monitoring/aws-xray.ts
import AWSXRay from 'aws-xray-sdk-core';
import AWSXRayExpress from 'aws-xray-sdk-express';

// Initialize X-Ray
AWSXRay.setContextMissingStrategy('LOG_ERROR');

// Express middleware
export const xrayMiddleware = AWSXRayExpress.openSegment('mini-facebook-api');

// Database tracing
export const tracedPostgres = AWSXRay.capturePostgres(require('pg'));

// HTTP client tracing
export const tracedHttp = AWSXRay.captureHTTPs(require('http'));
export const tracedHttps = AWSXRay.captureHTTPs(require('https'));

// Custom segments
export function createCustomSegment(name: string, fn: (segment: any) => Promise<any>) {
  return AWSXRay.captureAsyncFunc(name, fn);
}
```

## 🚀 Serverless Options

### AWS Lambda for Event Processing
```typescript
// lambda/notification-processor.ts
import { SQSHandler } from 'aws-lambda';
import { notificationService } from '../services/notification-service/notificationService';

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    
    try {
      await notificationService.processNotification(message);
    } catch (error) {
      console.error('Failed to process notification:', error);
      throw error; // This will trigger DLQ
    }
  }
};
```

### AWS Lambda for Search Indexing
```typescript
// lambda/search-indexer.ts
import { SNSEvent } from 'aws-lambda';
import { postSearchService } from '../infrastructure/elasticsearch/postSearchService';

export const handler = async (event: SNSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    
    if (message.eventType === 'post.created') {
      await postSearchService.indexPost(message.data);
    }
  }
};
```

## 💰 Cost Optimization

### AWS Cost Management
```yaml
# Cost Optimization Strategies

Reserved Instances:
  - RDS: 1-year term for production
  - ElastiCache: 1-year term for production
  - EKS Nodes: Spot instances for non-critical workloads

Auto Scaling:
  - EKS: Cluster autoscaler
  - RDS: Read replicas during peak hours
  - ElastiCache: Cluster mode for horizontal scaling

Lifecycle Policies:
  - S3: Transition to cheaper storage classes
  - CloudWatch Logs: Delete old logs
  - EBS: Delete unused volumes

Monitoring:
  - AWS Cost Explorer
  - AWS Budgets with alerts
  - AWS Trusted Advisor recommendations
```

## 🔄 Migration Strategy

### Phase 1: Database Migration
```bash
# 1. Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier mini-facebook-prod \
  --db-instance-class db.r5.large \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password $DB_PASSWORD \
  --allocated-storage 100 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-12345678 \
  --db-subnet-group-name mini-facebook-db-subnet-group \
  --multi-az \
  --backup-retention-period 7 \
  --storage-encrypted

# 2. Migrate data using AWS DMS
aws dms create-replication-instance \
  --replication-instance-identifier mini-facebook-migration \
  --replication-instance-class dms.t3.medium \
  --allocated-storage 50 \
  --vpc-security-group-ids sg-12345678 \
  --replication-subnet-group-identifier mini-facebook-dms-subnet-group
```

### Phase 2: Cache Migration
```bash
# Create ElastiCache cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id mini-facebook-redis \
  --cache-node-type cache.r6g.large \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --vpc-security-group-ids sg-12345678 \
  --cache-subnet-group-name mini-facebook-cache-subnet-group \
  --snapshot-retention-limit 7 \
  --automatic-failover-enabled
```

### Phase 3: Application Migration
```bash
# Deploy to EKS
eksctl create cluster \
  --name mini-facebook-prod \
  --region us-west-2 \
  --nodegroup-name general-purpose \
  --node-type t3.large \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 10 \
  --managed \
  --ssh-access \
  --ssh-public-key my-key.pub \
  --vpc-private-subnets subnet-12345678,subnet-87654321 \
  --vpc-public-subnets subnet-11111111,subnet-22222222
```

## 📈 Benefits of AWS Integration

### Operational Benefits
- **Managed Services**: Reduced operational overhead
- **Auto Scaling**: Automatic scaling based on demand
- **High Availability**: Multi-AZ deployments
- **Security**: Built-in security features and compliance
- **Monitoring**: Comprehensive monitoring and alerting
- **Backup & Recovery**: Automated backups and point-in-time recovery

### Cost Benefits
- **Pay-as-you-go**: Only pay for what you use
- **Reserved Instances**: Significant savings for predictable workloads
- **Spot Instances**: Up to 90% savings for fault-tolerant workloads
- **Lifecycle Policies**: Automatic cost optimization

### Performance Benefits
- **Global Infrastructure**: Low latency worldwide
- **CDN**: CloudFront for fast content delivery
- **Optimized Services**: Purpose-built for specific use cases
- **Auto Scaling**: Handle traffic spikes automatically

This AWS integration provides a production-ready, scalable, and cost-effective solution for our mini Facebook backend while maintaining all the functionality of our original design.
