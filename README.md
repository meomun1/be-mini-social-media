# Mini Facebook Backend

A comprehensive backend system for a mini social media platform built with modern technologies and best practices.

## 🎯 Project Overview

This project demonstrates a full-stack backend development approach using TypeScript, microservices architecture, and modern DevOps practices. It's designed as a learning project to showcase backend development skills with production-ready technologies.

## 🏗️ Architecture

### Technology Stack
- **Language**: TypeScript
- **Framework**: Node.js/Express
- **Database**: PostgreSQL / AWS RDS
- **Cache**: Redis / AWS ElastiCache
- **Search**: Elasticsearch / AWS OpenSearch
- **Message Queue**: RabbitMQ / AWS SQS/SNS
- **Authentication**: JWT
- **Web Server**: Nginx / AWS ALB
- **Containerization**: Docker
- **Orchestration**: Kubernetes / AWS EKS
- **Testing**: Jest
- **Real-time**: WebSockets
- **Cloud Provider**: AWS (Optional)

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Load Balancer │    │   API Gateway   │
│  (Web/Mobile)   │◄──►│     (Nginx)     │◄──►│   (Express)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────────────────────┼─────────────────────────────────┐
                       │                                 ▼                                 │
              ┌──────────────┐                ┌──────────────┐                ┌──────────────┐
              │   Auth       │                │   Posts      │                │   Messages   │
              │   Service    │                │   Service    │                │   Service    │
              │   (Port 3100)│                │   (Port 3300)│                │   (Port 3400)│
              └──────────────┘                └──────────────┘                └──────────────┘
                       │                                 │                                 │
              ┌──────────────┐                ┌──────────────┐                ┌──────────────┐
              │   Users      │                │   Media      │                │   Search     │
              │   Service    │                │   Service    │                │   Service    │
              │   (Port 3200)│                │   (Port 3500)│                │   (Port 3600)│
              └──────────────┘                └──────────────┘                └──────────────┘
                       │                                 │                                 │
              ┌──────────────┐                ┌──────────────┐                ┌──────────────┐
              │ Notification │                │   RabbitMQ   │                │  Elasticsearch│
              │   Service    │                │  Event Bus   │                │   Search     │
              │   (Port 3700)│                │   (Port 5672)│                │   (Port 9200)│
              └──────────────┘                └──────────────┘                └──────────────┘
                       │                                 │                                 │
                       └─────────────────────────────────┼─────────────────────────────────┘
                                                         ▼
                                    ┌─────────────────────────────────┐
                                    │        Data Layer               │
                                    │  Multiple Databases + Redis    │
                                    └─────────────────────────────────┘
```

### Microservices Architecture
- **Database per Service**: Each service owns its database
- **Event-Driven Communication**: Services communicate through RabbitMQ events
- **Loose Coupling**: No direct service-to-service calls
- **Independent Deployment**: Each service can be deployed separately

## 📁 Project Structure

```
be-mini-social-media/
├── docs/                           # Comprehensive documentation
│   ├── 00-system-overview.md      # System architecture overview
│   ├── 01-core-features.md        # Feature specifications
│   ├── 02-database-design.md      # Database schema and design
│   ├── 03-microservices-architecture.md # Service architecture
│   ├── 04-api-specifications.md   # REST API documentation
│   ├── 05-typescript-backend.md   # TypeScript setup and patterns
│   ├── 06-postgresql-database.md  # Database implementation
│   ├── 07-redis-caching.md        # Caching strategies
│   ├── 08-elasticsearch-search.md # Search implementation
│   ├── 09-rabbitmq-messaging.md   # Event-driven messaging
│   ├── 10-websocket-realtime.md   # Real-time communication
│   ├── 11-jwt-authentication.md   # Authentication system
│   ├── 12-nginx-load-balancer.md  # Load balancing and proxy
│   ├── 13-docker-containerization.md # Container setup
│   ├── 14-kubernetes-orchestration.md # Container orchestration
│   ├── 15-jest-testing.md         # Testing framework
│   └── 16-cicd-deployment.md      # CI/CD pipeline
├── src/
│   ├── shared/                    # Shared utilities and types
│   ├── services/                  # Microservices (Database per Service)
│   │   ├── auth-service/
│   │   │   ├── src/
│   │   │   ├── database/          # Auth service database
│   │   │   └── Dockerfile
│   │   ├── user-service/
│   │   │   ├── src/
│   │   │   ├── database/          # User service database
│   │   │   └── Dockerfile
│   │   ├── post-service/
│   │   │   ├── src/
│   │   │   ├── database/          # Post service database
│   │   │   └── Dockerfile
│   │   ├── message-service/
│   │   │   ├── src/
│   │   │   ├── database/          # Message service database
│   │   │   └── Dockerfile
│   │   ├── media-service/
│   │   │   ├── src/
│   │   │   ├── database/          # Media service database
│   │   │   └── Dockerfile
│   │   ├── search-service/
│   │   │   ├── src/
│   │   │   └── Dockerfile
│   │   └── notification-service/
│   │       ├── src/
│   │       ├── database/          # Notification service database
│   │       └── Dockerfile
│   ├── gateway/                   # API Gateway
│   └── infrastructure/            # Infrastructure code
├── docker/                        # Docker configurations
├── k8s/                          # Kubernetes manifests
└── tests/                        # Test suites
```

## 🚀 Features

### Core Features
- **User Management**: Registration, authentication, profile management
- **Social Features**: Friends, posts, comments, reactions, news feed
- **Real-time Communication**: Live chat, notifications, typing indicators
- **Content Management**: Media upload, search, content moderation
- **Analytics**: User engagement, system monitoring

### Technical Features
- **Microservices Architecture**: Database per service, loose coupling
- **Event-Driven Communication**: RabbitMQ for async service communication
- **Database per Service**: Each service owns its PostgreSQL database
- **Caching Strategy**: Multi-layer caching with Redis
- **Search Engine**: Full-text search with Elasticsearch
- **Real-time Updates**: WebSocket-based live features
- **Security**: JWT authentication, rate limiting, input validation
- **Monitoring**: Health checks, metrics, logging
- **Testing**: Unit, integration, and performance tests
- **CI/CD**: Automated testing, building, and deployment

## 📖 Documentation

Each technology and component has comprehensive documentation:

1. **[System Overview](docs/system-design/00-system-overview.md)** - High-level architecture and design principles
2. **[Core Features](docs/system-design/01-core-features.md)** - Detailed feature specifications
3. **[Database Design](docs/system-design/02-database-design.md)** - Database per service schema
4. **[Microservices](docs/system-design/03-microservices-architecture.md)** - Service boundaries and event communication
5. **[API Specifications](docs/api-implementation/04-api-specifications.md)** - REST API documentation
6. **[TypeScript Backend](docs/api-implementation/05-typescript-backend.md)** - Development setup and patterns
7. **[PostgreSQL](docs/infrastructure/06-postgresql-database.md)** - Database implementation and queries
8. **[Redis Caching](docs/infrastructure/07-redis-caching.md)** - Caching strategies and session management
9. **[Elasticsearch](docs/infrastructure/08-elasticsearch-search.md)** - Search implementation and indexing
10. **[RabbitMQ](docs/infrastructure/09-rabbitmq-messaging.md)** - Event-driven messaging
11. **[WebSockets](docs/infrastructure/10-websocket-realtime.md)** - Real-time communication
12. **[JWT Authentication](docs/security/11-jwt-authentication.md)** - Security and authentication
13. **[Nginx](docs/infrastructure/12-nginx-load-balancer.md)** - Load balancing and reverse proxy
14. **[Docker](docs/devops/13-docker-containerization.md)** - Containerization setup
15. **[Kubernetes](docs/devops/14-kubernetes-orchestration.md)** - Container orchestration
16. **[Jest Testing](docs/testing/15-jest-testing.md)** - Testing framework and strategies
17. **[CI/CD](docs/devops/16-cicd-deployment.md)** - Deployment pipeline and automation

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (Multiple instances - one per service)
- Redis 7+
- Elasticsearch 8+
- RabbitMQ 3+

### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd be-mini-social-media

# Install dependencies
npm install

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Run migrations for each service
npm run migrate:auth
npm run migrate:user
npm run migrate:post
npm run migrate:message
npm run migrate:media
npm run migrate:notification

# Start development server
npm run dev
```

### Testing
```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:coverage
```

### Building
```bash
# Build for production
npm run build

# Build Docker images
docker-compose -f docker-compose.prod.yml build
```

## 🎓 Learning Objectives

This project demonstrates:

- **Modern Backend Architecture**: Microservices with database per service
- **Event-Driven Design**: Asynchronous communication through events
- **Database Design**: Multiple PostgreSQL instances, relational modeling
- **Service Boundaries**: Clear domain separation and data ownership
- **Caching Strategies**: Multi-layer caching, session management
- **Search Implementation**: Full-text search, indexing, analytics
- **Real-time Features**: WebSockets, live updates, notifications
- **Security Best Practices**: Authentication, authorization, input validation
- **DevOps Practices**: Containerization, orchestration, CI/CD
- **Testing Strategies**: Unit, integration, performance testing
- **API Design**: RESTful APIs, documentation, versioning
- **Monitoring & Observability**: Health checks, metrics, logging

## 📊 Technology Compatibility

All technologies in the stack are compatible and work together seamlessly:

✅ **No Conflicts**: All technologies complement each other  
✅ **Production Ready**: Industry-standard tools and practices  
✅ **Scalable**: Database per service enables independent scaling  
✅ **Maintainable**: Clear service boundaries and data ownership  
✅ **Testable**: Comprehensive testing strategies  
✅ **Secure**: Multiple layers of security  
✅ **Resilient**: Event-driven architecture with loose coupling  

## 🚀 Deployment

### Development
```bash
docker-compose -f docker-compose.dev.yml up
```

### Production
```bash
# Using Kubernetes
kubectl apply -f k8s/

# Using Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

## 📈 Performance

- **Response Time**: < 200ms for API calls
- **Throughput**: 1000+ concurrent users
- **Availability**: 99.9% uptime target
- **Scalability**: Horizontal scaling capability

## 🔒 Security

- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive validation and sanitization
- **Rate Limiting**: Protection against abuse
- **Data Protection**: Encryption at rest and in transit

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

This is a learning project. Feel free to use it as a reference for your own projects or contribute improvements.

---

## ☁️ AWS Integration Options

The system can be deployed using either self-managed infrastructure or AWS managed services:

| Component | Self-Managed | AWS Managed Service | Benefits |
|-----------|--------------|-------------------|----------|
| **Database** | PostgreSQL | Amazon RDS | Auto-scaling, backups, Multi-AZ |
| **Cache** | Redis | Amazon ElastiCache | Auto-failover, cluster mode |
| **Search** | Elasticsearch | Amazon OpenSearch | Managed service, auto-updates |
| **Message Queue** | RabbitMQ | Amazon SQS/SNS | Serverless, auto-scaling |
| **Load Balancer** | Nginx | AWS ALB | Layer 7 routing, SSL termination |
| **Container Orchestration** | Kubernetes | Amazon EKS | Managed control plane |
| **File Storage** | Local/Volume | Amazon S3 | Unlimited, CDN integration |
| **Monitoring** | Prometheus | Amazon CloudWatch | Integrated monitoring |

### Deployment Options
1. **Self-Managed**: Full control, learning experience
2. **AWS Hybrid**: Mix of self-managed and AWS services
3. **AWS Full**: All managed services for production

See [AWS Cloud Integration](docs/cloud/17-aws-cloud-integration.md) for detailed AWS setup and migration strategies.

---

This is a comprehensive backend system designed for learning and demonstrating modern backend development practices. It includes production-ready patterns and can serve as a foundation for real-world applications.
