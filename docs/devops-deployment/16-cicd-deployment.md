# CI/CD Pipeline & Deployment

## 🚀 Overview

This document outlines our Continuous Integration and Continuous Deployment (CI/CD) pipeline for the mini Facebook backend, including automated testing, building, security scanning, and deployment strategies.

## 🔧 CI/CD Pipeline Architecture

### Pipeline Stages
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Source    │    │     CI      │    │     CD      │    │  Production │
│   Control   │───►│  Pipeline   │───►│  Pipeline   │───►│  Deployment │
│   (Git)     │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │                    │
                          ▼                    ▼
                   ┌─────────────┐    ┌─────────────┐
                   │   Testing   │    │  Security   │
                   │   & Build   │    │  Scanning   │
                   └─────────────┘    └─────────────┘
```

## 🔄 GitHub Actions Workflows

### Main CI/CD Pipeline
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Code Quality and Testing
  test:
    runs-on: ubuntu-latest
    services:
      auth_db:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: auth_service_db_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      users_db:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: user_service_db_test
        ports:
          - 5433:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run type checking
      run: npm run type-check

    - name: Run unit tests
      run: npm run test:unit
      env:
        NODE_ENV: test
        AUTH_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/auth_service_db_test
        USERS_DATABASE_URL: postgresql://postgres:postgres@localhost:5433/user_service_db_test
        REDIS_URL: redis://localhost:6379

    - name: Run integration tests
      run: npm run test:integration
      env:
        NODE_ENV: test
        AUTH_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/auth_service_db_test
        USERS_DATABASE_URL: postgresql://postgres:postgres@localhost:5433/user_service_db_test
        REDIS_URL: redis://localhost:6379

    - name: Generate test coverage
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella

  # Security Scanning
  security:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results to GitHub Security tab
      uses: github/codeql-action/upload-sarif@v2
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'

    - name: Run npm audit
      run: npm audit --audit-level moderate

  # Build Docker Images
  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    strategy:
      matrix:
        service: [gateway, auth-service, user-service, post-service, message-service, media-service, search-service, notification-service]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/${{ matrix.service }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./services/${{ matrix.service }}/Dockerfile
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  # Deploy to Staging
  deploy-staging:
    needs: [build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG_STAGING }}

    - name: Deploy to staging (all services)
      run: |
        # Update image tags for each service manifest
        for svc in gateway auth-service user-service post-service message-service media-service search-service notification-service; do
          sed -i "s|image: .*/$svc:latest|image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/$svc:develop|g" k8s/$svc.yaml || true
        done

        # Apply Kubernetes manifests
        kubectl apply -f k8s/namespace.yaml
        kubectl apply -f k8s/configmap.yaml
        kubectl apply -f k8s/secrets.yaml
        kubectl apply -f k8s/

    - name: Run smoke tests
      run: |
        # Wait for deployment to be ready
        kubectl rollout status deployment/api-gateway -n mini-facebook --timeout=300s
        
        # Run smoke tests
        npm run test:smoke -- --base-url=https://staging-api.minifacebook.com

  # Deploy to Production
  deploy-production:
    needs: [build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG_PRODUCTION }}

    - name: Deploy to production (all services)
      run: |
        # Update image tags for each service manifest
        for svc in gateway auth-service user-service post-service message-service media-service search-service notification-service; do
          sed -i "s|image: .*/$svc:latest|image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/$svc:main|g" k8s/$svc.yaml || true
        done

        # Apply Kubernetes manifests with rolling update
        kubectl apply -f k8s/namespace.yaml
        kubectl apply -f k8s/configmap.yaml
        kubectl apply -f k8s/secrets.yaml
        kubectl apply -f k8s/
        
        # Wait for rolling update to complete
        kubectl rollout status deployment/api-gateway -n mini-facebook --timeout=600s

    - name: Run production health checks
      run: |
        # Wait for services to be healthy
        kubectl wait --for=condition=available --timeout=300s deployment/api-gateway -n mini-facebook
        
        # Run health checks
        npm run test:health -- --base-url=https://api.minifacebook.com

    - name: Notify deployment success
      uses: 8398a7/action-slack@v3
      with:
        status: success
        text: '🚀 Production deployment successful!'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Database Migration Pipeline
```yaml
# .github/workflows/migrate.yml
name: Database Migration

on:
  push:
    paths:
      - 'services/**/database/migrations/**'
  workflow_dispatch:

jobs:
  migrate-staging:
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run database migrations (per service)
      run: |
        npm run migrate:auth
        npm run migrate:user
        npm run migrate:post
        npm run migrate:message
        npm run migrate:media
        npm run migrate:notification
      env:
        NODE_ENV: staging
        AUTH_DATABASE_URL: ${{ secrets.STAGING_AUTH_DATABASE_URL }}
        USERS_DATABASE_URL: ${{ secrets.STAGING_USERS_DATABASE_URL }}
        POSTS_DATABASE_URL: ${{ secrets.STAGING_POSTS_DATABASE_URL }}
        MESSAGES_DATABASE_URL: ${{ secrets.STAGING_MESSAGES_DATABASE_URL }}
        MEDIA_DATABASE_URL: ${{ secrets.STAGING_MEDIA_DATABASE_URL }}
        NOTIFICATIONS_DATABASE_URL: ${{ secrets.STAGING_NOTIFICATIONS_DATABASE_URL }}

    - name: Verify migration
      run: npm run migrate:status
      env:
        NODE_ENV: staging
        DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}

  migrate-production:
    needs: migrate-staging
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run database migrations (per service)
      run: |
        npm run migrate:auth
        npm run migrate:user
        npm run migrate:post
        npm run migrate:message
        npm run migrate:media
        npm run migrate:notification
      env:
        NODE_ENV: production
        AUTH_DATABASE_URL: ${{ secrets.PRODUCTION_AUTH_DATABASE_URL }}
        USERS_DATABASE_URL: ${{ secrets.PRODUCTION_USERS_DATABASE_URL }}
        POSTS_DATABASE_URL: ${{ secrets.PRODUCTION_POSTS_DATABASE_URL }}
        MESSAGES_DATABASE_URL: ${{ secrets.PRODUCTION_MESSAGES_DATABASE_URL }}
        MEDIA_DATABASE_URL: ${{ secrets.PRODUCTION_MEDIA_DATABASE_URL }}
        NOTIFICATIONS_DATABASE_URL: ${{ secrets.PRODUCTION_NOTIFICATIONS_DATABASE_URL }}

    - name: Verify migration
      run: npm run migrate:status
      env:
        NODE_ENV: production
        DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

## 🔒 Security Pipeline

### Security Scanning Workflow
```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday at 2 AM
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run npm audit
      run: npm audit --audit-level moderate --json > audit-results.json

    - name: Upload audit results
      uses: actions/upload-artifact@v3
      with:
        name: npm-audit-results
        path: audit-results.json

  container-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Build Docker image
      run: docker build -t test-image .

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'test-image'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  code-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Initialize CodeQL
      uses: github/codeql-action/init@v2
      with:
        languages: javascript

    - name: Autobuild
      uses: github/codeql-action/autobuild@v2

    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v2
```

## 📊 Monitoring and Alerting

### Deployment Monitoring
```yaml
# .github/workflows/monitor.yml
name: Deployment Monitoring

on:
  workflow_run:
    workflows: ["CI/CD Pipeline"]
    types: [completed]

jobs:
  monitor-deployment:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    
    steps:
    - name: Check deployment health
      run: |
        # Check API health
        curl -f https://api.minifacebook.com/health || exit 1
        
        # Check database connectivity
        npm run health:check
        
        # Check Redis connectivity
        npm run redis:ping

    - name: Run performance tests
      run: npm run test:performance

    - name: Check error rates
      run: |
        # Query monitoring system for error rates
        npm run monitor:errors

    - name: Alert on issues
      if: failure()
      uses: 8398a7/action-slack@v3
      with:
        status: failure
        text: '⚠️ Deployment health check failed!'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 🚀 Deployment Strategies

### Blue-Green Deployment
```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

ENVIRONMENT=$1
VERSION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$VERSION" ]; then
    echo "Usage: $0 <environment> <version>"
    exit 1
fi

echo "Starting blue-green deployment for $ENVIRONMENT with version $VERSION"

# Get current active color
CURRENT_COLOR=$(kubectl get service api-gateway-service -n mini-facebook -o jsonpath='{.spec.selector.color}')
NEW_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")

echo "Current color: $CURRENT_COLOR"
echo "New color: $NEW_COLOR"

# Deploy to new color
kubectl set image deployment/api-gateway-$NEW_COLOR api-gateway=$REGISTRY/$IMAGE_NAME/gateway:$VERSION -n mini-facebook

# Wait for new deployment to be ready
kubectl rollout status deployment/api-gateway-$NEW_COLOR -n mini-facebook --timeout=300s

# Run health checks on new deployment
kubectl port-forward service/api-gateway-$NEW_COLOR-service 8080:80 -n mini-facebook &
PORT_FORWARD_PID=$!

sleep 10

if curl -f http://localhost:8080/health; then
    echo "Health check passed for $NEW_COLOR deployment"
    
    # Switch traffic to new color
    kubectl patch service api-gateway-service -n mini-facebook -p '{"spec":{"selector":{"color":"'$NEW_COLOR'"}}}'
    
    echo "Traffic switched to $NEW_COLOR deployment"
    
    # Wait and verify
    sleep 30
    
    # Scale down old deployment
    kubectl scale deployment api-gateway-$CURRENT_COLOR --replicas=0 -n mini-facebook
    
    echo "Blue-green deployment completed successfully"
else
    echo "Health check failed for $NEW_COLOR deployment"
    kubectl scale deployment api-gateway-$NEW_COLOR --replicas=0 -n mini-facebook
    exit 1
fi

# Cleanup port forward
kill $PORT_FORWARD_PID
```

### Canary Deployment
```yaml
# k8s/canary-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api-gateway-rollout
  namespace: mini-facebook
spec:
  replicas: 10
  strategy:
    canary:
      steps:
      - setWeight: 20
      - pause: {duration: 10m}
      - setWeight: 40
      - pause: {duration: 10m}
      - setWeight: 60
      - pause: {duration: 10m}
      - setWeight: 80
      - pause: {duration: 10m}
      canaryService: api-gateway-canary
      stableService: api-gateway-stable
      trafficRouting:
        nginx:
          stableIngress: api-gateway-ingress
      analysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: api-gateway
        startingStep: 2
        metrics:
        - name: success-rate
          successCondition: result[0] >= 0.95
          interval: 30s
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
        image: mini-facebook/gateway:latest
        ports:
        - containerPort: 3000
```

## 📈 Rollback Procedures

### Automated Rollback
```bash
#!/bin/bash
# scripts/rollback.sh

ENVIRONMENT=$1
REVISION=$2

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment> [revision]"
    exit 1
fi

echo "Rolling back deployment in $ENVIRONMENT"

if [ -z "$REVISION" ]; then
    # Rollback to previous revision
    kubectl rollout undo deployment/api-gateway -n mini-facebook
else
    # Rollback to specific revision
    kubectl rollout undo deployment/api-gateway --to-revision=$REVISION -n mini-facebook
fi

# Wait for rollback to complete
kubectl rollout status deployment/api-gateway -n mini-facebook --timeout=300s

# Verify rollback
kubectl get pods -n mini-facebook -l app=api-gateway

echo "Rollback completed"
```

This CI/CD pipeline provides comprehensive automation for testing, building, security scanning, and deploying our mini Facebook backend with proper monitoring, rollback procedures, and deployment strategies.

## ✅ Next Steps & Known Gaps (to fill when wiring environments)

- Secrets: Provide per-service DB URLs in repo/environment secrets:
  - STAGING_AUTH_DATABASE_URL, STAGING_USERS_DATABASE_URL, STAGING_POSTS_DATABASE_URL, STAGING_MESSAGES_DATABASE_URL, STAGING_MEDIA_DATABASE_URL, STAGING_NOTIFICATIONS_DATABASE_URL
  - PRODUCTION_AUTH_DATABASE_URL, PRODUCTION_USERS_DATABASE_URL, PRODUCTION_POSTS_DATABASE_URL, PRODUCTION_MESSAGES_DATABASE_URL, PRODUCTION_MEDIA_DATABASE_URL, PRODUCTION_NOTIFICATIONS_DATABASE_URL
- Manifests: Ensure `k8s/<service>.yaml` exists for all services referenced in the deploy loops.
- Image registry: Update `REGISTRY` if not using GitHub Container Registry.
- Smoke tests: Point to your staging/production domains and add minimal auth tokens if endpoints require them.

## 🧭 Runbook (Quick Commands)

### Local development
```bash
# Start full local stack (DBs per service, Redis, ES, RabbitMQ, gateway + services)
docker-compose -f docker-compose.dev.yml up -d

# Tail logs for a service
docker-compose -f docker-compose.dev.yml logs -f user-service

# Stop stack
docker-compose -f docker-compose.dev.yml down
```

### Database migrations (per service)
```bash
# Auth
npm run migrate:auth
# Users
npm run migrate:user
# Posts
npm run migrate:post
# Messages
npm run migrate:message
# Media
npm run migrate:media
# Notifications
npm run migrate:notification
```

### Seeding (if seeds are available)
```bash
npm run seed:auth && npm run seed:user && npm run seed:post
```

### Testing
```bash
# Unit
npm run test:unit
# Integration
npm run test:integration
# Coverage
npm run test:coverage
```

### Build images locally (all services)
```bash
./scripts/build.sh
```

### Kubernetes deploy (manually)
```bash
# Set context
kubectl config use-context <your-cluster>

# Apply core config
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Apply data plane (Redis/ES/RabbitMQ) and DBs
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/elasticsearch.yaml  # if present
kubectl apply -f k8s/rabbitmq.yaml       # if present
# DBs per service: auth-db shown as pattern; apply others when created
kubectl apply -f k8s/db-auth.yaml

# Apply apps
kubectl apply -f k8s/api-gateway.yaml
kubectl apply -f k8s/auth-service.yaml
kubectl apply -f k8s/user-service.yaml
kubectl apply -f k8s/post-service.yaml
kubectl apply -f k8s/message-service.yaml
kubectl apply -f k8s/media-service.yaml
kubectl apply -f k8s/search-service.yaml
kubectl apply -f k8s/notification-service.yaml

# Wait for readiness
kubectl rollout status deployment/auth-service -n mini-facebook
```

### CI/CD usage
```text
Merge to develop → builds images and deploys to staging.
Merge to main → builds images and deploys to production.
Database migrations run per-service via the Migrations workflow.
```

### Rollback
```bash
# Roll back API gateway (example)
kubectl rollout undo deployment/api-gateway -n mini-facebook
```
