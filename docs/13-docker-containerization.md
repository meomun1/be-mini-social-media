# Docker Containerization

## 🐳 Overview

Docker provides containerization for our mini Facebook backend, ensuring consistent deployment across environments and simplifying the development workflow.

## 🏗️ Docker Configuration

### Base Dockerfile
```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy the built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create non-root user
USER nodejs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "dist/index.js"]
```

### Multi-stage Dockerfile for Services
```dockerfile
# services/auth-service/Dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Build stage
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3100

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy application files
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3100/health || exit 1

CMD ["node", "dist/index.js"]
```

## 🔧 Docker Compose Configuration

### Development Environment
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: mini-facebook-postgres
    environment:
      POSTGRES_DB: minifacebook
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    networks:
      - mini-facebook-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: mini-facebook-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - mini-facebook-network
    command: redis-server --appendonly yes

  # Elasticsearch
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: mini-facebook-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - mini-facebook-network

  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: mini-facebook-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: password
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - mini-facebook-network

  # API Gateway
  api-gateway:
    build:
      context: .
      dockerfile: gateway/Dockerfile
    container_name: mini-facebook-gateway
    environment:
      - NODE_ENV=development
      - PORT=3000
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/minifacebook
      - REDIS_URL=redis://redis:6379
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
      - elasticsearch
      - rabbitmq
    networks:
      - mini-facebook-network
    volumes:
      - ./gateway:/app
      - /app/node_modules

  # Auth Service
  auth-service:
    build:
      context: .
      dockerfile: services/auth-service/Dockerfile
    container_name: mini-facebook-auth
    environment:
      - NODE_ENV=development
      - PORT=3100
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/minifacebook
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    ports:
      - "3100:3100"
    depends_on:
      - postgres
      - redis
      - rabbitmq
    networks:
      - mini-facebook-network
    volumes:
      - ./services/auth-service:/app
      - /app/node_modules

  # User Service
  user-service:
    build:
      context: .
      dockerfile: services/user-service/Dockerfile
    container_name: mini-facebook-user
    environment:
      - NODE_ENV=development
      - PORT=3200
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/minifacebook
      - REDIS_URL=redis://redis:6379
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    ports:
      - "3200:3200"
    depends_on:
      - postgres
      - redis
      - elasticsearch
      - rabbitmq
    networks:
      - mini-facebook-network
    volumes:
      - ./services/user-service:/app
      - /app/node_modules

  # Post Service
  post-service:
    build:
      context: .
      dockerfile: services/post-service/Dockerfile
    container_name: mini-facebook-post
    environment:
      - NODE_ENV=development
      - PORT=3300
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/minifacebook
      - REDIS_URL=redis://redis:6379
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    ports:
      - "3300:3300"
    depends_on:
      - postgres
      - redis
      - elasticsearch
      - rabbitmq
    networks:
      - mini-facebook-network
    volumes:
      - ./services/post-service:/app
      - /app/node_modules

  # Message Service
  message-service:
    build:
      context: .
      dockerfile: services/message-service/Dockerfile
    container_name: mini-facebook-message
    environment:
      - NODE_ENV=development
      - PORT=3400
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/minifacebook
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    ports:
      - "3400:3400"
    depends_on:
      - postgres
      - redis
      - rabbitmq
    networks:
      - mini-facebook-network
    volumes:
      - ./services/message-service:/app
      - /app/node_modules

  # Media Service
  media-service:
    build:
      context: .
      dockerfile: services/media-service/Dockerfile
    container_name: mini-facebook-media
    environment:
      - NODE_ENV=development
      - PORT=3500
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/minifacebook
      - REDIS_URL=redis://redis:6379
    ports:
      - "3500:3500"
    depends_on:
      - postgres
      - redis
    networks:
      - mini-facebook-network
    volumes:
      - ./services/media-service:/app
      - /app/node_modules
      - media_uploads:/app/uploads

  # Search Service
  search-service:
    build:
      context: .
      dockerfile: services/search-service/Dockerfile
    container_name: mini-facebook-search
    environment:
      - NODE_ENV=development
      - PORT=3600
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    ports:
      - "3600:3600"
    depends_on:
      - elasticsearch
      - rabbitmq
    networks:
      - mini-facebook-network
    volumes:
      - ./services/search-service:/app
      - /app/node_modules

  # Notification Service
  notification-service:
    build:
      context: .
      dockerfile: services/notification-service/Dockerfile
    container_name: mini-facebook-notification
    environment:
      - NODE_ENV=development
      - PORT=3700
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/minifacebook
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    ports:
      - "3700:3700"
    depends_on:
      - postgres
      - redis
      - rabbitmq
    networks:
      - mini-facebook-network
    volumes:
      - ./services/notification-service:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
  rabbitmq_data:
  media_uploads:

networks:
  mini-facebook-network:
    driver: bridge
```

### Production Environment
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: mini-facebook-postgres-prod
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    networks:
      - mini-facebook-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: mini-facebook-redis-prod
    volumes:
      - redis_data:/data
    networks:
      - mini-facebook-network
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  # Elasticsearch
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: mini-facebook-elasticsearch-prod
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - mini-facebook-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: mini-facebook-rabbitmq-prod
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - mini-facebook-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  # API Gateway
  api-gateway:
    image: mini-facebook/gateway:latest
    container_name: mini-facebook-gateway-prod
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - ELASTICSEARCH_URL=${ELASTICSEARCH_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - mini-facebook-network
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  # Auth Service
  auth-service:
    image: mini-facebook/auth-service:latest
    container_name: mini-facebook-auth-prod
    environment:
      - NODE_ENV=production
      - PORT=3100
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - mini-facebook-network
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
  rabbitmq_data:

networks:
  mini-facebook-network:
    driver: bridge
```

## 🛠️ Build Scripts

### Build Script
```bash
#!/bin/bash
# scripts/build.sh

set -e

echo "Building Mini Facebook Backend Images..."

# Build base image
echo "Building base image..."
docker build -t mini-facebook/base:latest -f Dockerfile.base .

# Build service images
services=("gateway" "auth-service" "user-service" "post-service" "message-service" "media-service" "search-service" "notification-service")

for service in "${services[@]}"; do
    echo "Building $service..."
    docker build -t "mini-facebook/$service:latest" -f "services/$service/Dockerfile" .
done

echo "All images built successfully!"
```

### Development Scripts
```bash
#!/bin/bash
# scripts/dev.sh

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Show logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

## 📊 Monitoring & Health Checks

### Health Check Configuration
```dockerfile
# Health check in Dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1
```

### Monitoring Script
```bash
#!/bin/bash
# scripts/monitor.sh

echo "Mini Facebook Backend Health Status"
echo "=================================="

services=("postgres" "redis" "elasticsearch" "rabbitmq" "api-gateway" "auth-service" "user-service" "post-service" "message-service" "media-service" "search-service" "notification-service")

for service in "${services[@]}"; do
    if docker ps | grep -q "$service"; then
        echo "✅ $service: Running"
    else
        echo "❌ $service: Not running"
    fi
done

echo ""
echo "Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

## 🔒 Security Configuration

### Security-focused Dockerfile
```dockerfile
# Dockerfile.security
FROM node:18-alpine AS base

# Install security updates
RUN apk update && apk upgrade

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY --chown=nodejs:nodejs . .

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

### Docker Security Scanning
```bash
#!/bin/bash
# scripts/security-scan.sh

echo "Running security scan on Docker images..."

images=("mini-facebook/gateway:latest" "mini-facebook/auth-service:latest" "mini-facebook/user-service:latest")

for image in "${images[@]}"; do
    echo "Scanning $image..."
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        aquasec/trivy image $image
done
```

This Docker configuration provides a comprehensive containerization strategy for our mini Facebook backend with proper development and production environments, security measures, and monitoring capabilities.
