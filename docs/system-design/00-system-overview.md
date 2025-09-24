# Mini Facebook Backend - System Overview

## 🎯 Project Vision
A comprehensive backend system for a mini social media platform similar to Facebook, built with modern technologies and best practices.

## 🏗️ Architecture Overview

### High-Level Architecture
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

## 🎨 Design Principles

### 1. Domain-Driven Design (DDD)
- **Bounded Contexts**: Each service owns its domain and data
- **Ubiquitous Language**: Consistent terminology across teams
- **Aggregate Roots**: Clear data ownership boundaries

### 2. Event-Driven Architecture
- **Asynchronous Communication**: Services communicate via events (RabbitMQ)
- **Loose Coupling**: Services are independent and don't call each other directly
- **Event Sourcing**: Track all changes for audit and replay

### 3. Database per Service Pattern
- **Data Ownership**: Each service owns its database/schema
- **Data Independence**: Services can't access other services' data directly
- **Eventual Consistency**: Data consistency through events

## 🗄️ Database Architecture

### Service-Specific Databases
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Auth Service  │    │   User Service  │    │   Post Service  │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Auth DB     │ │    │ │ User DB     │ │    │ │ Post DB     │ │
│ │ - sessions  │ │    │ │ - users     │ │    │ │ - posts     │ │
│ │ - tokens    │ │    │ │ - profiles  │ │    │ │ - comments  │ │
│ │ - passwords │ │    │ │ - friends   │ │    │ │ - reactions │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Message Service  │    │ Media Service   │    │ Search Service  │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Message DB  │ │    │ │ Media DB    │ │    │ │ Elasticsearch│ │
│ │ - messages  │ │    │ │ - files     │ │    │ │ - search    │ │
│ │ - convos    │ │    │ │ - metadata  │ │    │ │ - indices   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Shared Infrastructure
- **Redis**: Shared cache and session store
- **RabbitMQ**: Event bus for service communication
- **Elasticsearch**: Shared search index

## 🔄 Service Communication

### Event-Driven Communication (Recommended)
```
User Service ──► Post Created Event ──► RabbitMQ ──► Search Service
     │                                        │
     │                                        ▼
     └───► User Updated Event ──► RabbitMQ ──► Notification Service
```

### No Direct Service-to-Service Calls
❌ **Wrong**: `POST /api/users/{id}/posts` (User service calling Post service)  
✅ **Correct**: User service publishes "User Created Post" event, Post service listens

## 🚀 Core Features

### User Management
- User registration and authentication
- Profile management
- Privacy settings
- Account verification

### Social Features
- Friend requests and connections
- News feed algorithm
- Post creation and sharing
- Comments and reactions
- Groups and pages

### Communication
- Real-time messaging
- Video/voice calls (future)
- Notifications
- Live chat

### Content Management
- Media upload and storage
- Content moderation
- Search and discovery
- Trending topics

### Analytics & Insights
- User engagement metrics
- Content performance
- System monitoring
- Business intelligence

## 🛠️ Technology Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Language** | TypeScript | Type-safe backend development |
| **Framework** | Node.js/Express | Web server and API |
| **Database** | PostgreSQL | Primary data storage (multiple instances) |
| **Cache** | Redis | Session, caching, pub/sub |
| **Search** | Elasticsearch | Full-text search |
| **Message Queue** | RabbitMQ | Event-driven communication |
| **Authentication** | JWT + Cookies | Secure user sessions |
| **Web Server** | Nginx | Reverse proxy, load balancing |
| **Containerization** | Docker | Application packaging |
| **Orchestration** | Kubernetes | Container management |
| **Testing** | Jest + Supertest | Unit and integration tests |
| **Real-time** | WebSockets | Live communication |

## 📊 System Requirements

### Performance Targets
- **Response Time**: < 200ms for API calls
- **Throughput**: 1000+ concurrent users
- **Availability**: 99.9% uptime
- **Scalability**: Horizontal scaling capability

### Security Requirements
- **Authentication**: Multi-factor authentication
- **Authorization**: Role-based access control
- **Data Protection**: Encryption at rest and in transit
- **Privacy**: GDPR compliance ready

## 🔄 Development Phases

### Phase 1: Foundation (Weeks 1-2)
- Project setup and infrastructure
- Basic authentication system
- User management service
- Database design and setup

### Phase 2: Core Features (Weeks 3-4)
- Posts and comments system
- Friend connections
- Basic news feed
- File upload system

### Phase 3: Advanced Features (Weeks 5-6)
- Real-time messaging
- Search functionality
- Notifications system
- Performance optimization

### Phase 4: Production Ready (Weeks 7-8)
- Monitoring and logging
- CI/CD pipeline
- Security hardening
- Load testing and optimization

## 📁 Project Structure
```
be-mini-social-media/
├── docs/                    # Documentation
├── src/
│   ├── shared/             # Shared utilities
│   ├── services/           # Microservices
│   │   ├── auth-service/
│   │   │   ├── src/
│   │   │   ├── database/   # Auth service database
│   │   │   └── Dockerfile
│   │   ├── user-service/
│   │   │   ├── src/
│   │   │   ├── database/   # User service database
│   │   │   └── Dockerfile
│   │   ├── post-service/
│   │   │   ├── src/
│   │   │   ├── database/   # Post service database
│   │   │   └── Dockerfile
│   │   ├── message-service/
│   │   │   ├── src/
│   │   │   ├── database/   # Message service database
│   │   │   └── Dockerfile
│   │   ├── media-service/
│   │   │   ├── src/
│   │   │   ├── database/   # Media service database
│   │   │   └── Dockerfile
│   │   ├── search-service/
│   │   │   ├── src/
│   │   │   └── Dockerfile
│   │   └── notification-service/
│   │       ├── src/
│   │       ├── database/   # Notification service database
│   │       └── Dockerfile
│   ├── gateway/            # API Gateway
│   └── infrastructure/     # Infrastructure code
├── docker/                 # Docker configurations
├── k8s/                   # Kubernetes manifests
└── tests/                 # Test suites
```

## 🎓 Learning Objectives

By the end of this project, you will have hands-on experience with:
- Modern backend architecture patterns
- Microservices design and implementation
- Event-driven systems
- Database per service pattern
- Container orchestration
- Database design and optimization
- API design and documentation
- Security best practices
- Testing strategies
- DevOps and deployment

This project will serve as a comprehensive portfolio piece demonstrating your full-stack backend development capabilities.