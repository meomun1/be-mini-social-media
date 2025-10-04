# Complete Testing Guide - Mini Facebook Backend

## 🎯 **Testing Types Overview**

### **1. Automated Tests (Jest) - Unit & Integration**
- **What**: Test individual functions and API endpoints in isolation
- **Speed**: Fast (milliseconds)
- **Dependencies**: Mocked (no real databases)
- **Purpose**: Ensure code logic works correctly
- **When**: During development, CI/CD

### **2. Manual API Testing - End-to-End**
- **What**: Test complete user journeys with real services
- **Speed**: Slower (requires running services)
- **Dependencies**: Real databases, Redis, services running
- **Purpose**: Verify integration between services
- **When**: Before deployment, manual verification

### **3. Postman Testing - Interactive API Testing**
- **What**: GUI-based API testing with collections
- **Speed**: Interactive (on-demand)
- **Dependencies**: Services running
- **Purpose**: Manual testing, documentation, sharing
- **When**: Development, QA, API exploration

### **4. Swagger Testing - API Documentation & Testing**
- **What**: Interactive API documentation with built-in testing
- **Speed**: Interactive (web-based)
- **Dependencies**: Services running
- **Purpose**: API documentation, testing, client generation
- **When**: API documentation, client development

---

## 🚀 **Setup Instructions**

### **Prerequisites**
```bash
# 1. Start Docker (for databases)
docker compose -f deployment/docker/docker-compose.dev.yml up -d

# 2. Install dependencies
cd services/auth-service && npm install
cd services/user-service && npm install
```

---

## 🧪 **1. Automated Tests (Jest)**

### **Run Tests**
```bash
# Auth Service Tests
cd services/auth-service
npm test                    # All tests
npm run test:unit          # Business logic only
npm run test:integration   # API endpoints only
npm run test:coverage      # Coverage report

# User Service Tests
cd services/user-service
npm test                    # All tests
npm run test:unit          # Business logic only
npm run test:integration   # API endpoints only
npm run test:coverage      # Coverage report
```

### **What Automated Tests Cover**
- ✅ User registration validation
- ✅ Login with credentials
- ✅ JWT token generation
- ✅ Password hashing
- ✅ API endpoint validation
- ✅ Error handling
- ✅ Redis integration (mocked)
- ✅ Database operations (mocked)

### **Test Results**
- **Auth Service**: 26/26 tests passing ✅
- **User Service**: 15/15 tests passing ✅

---

## 🌐 **2. Manual API Testing**

### **Start Services**
```bash
# Terminal 1 - Auth Service
cd services/auth-service
npm run dev

# Terminal 2 - User Service
cd services/user-service
npm run dev
```

### **Test Commands**
```bash
# 1. Register User
curl -X POST http://localhost:3100/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "SecurePassword123!",
    "firstName": "Test",
    "lastName": "User",
    "dateOfBirth": "1990-01-01"
  }'

# 2. Login
curl -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'

# 3. Get Profile (use token from login)
curl -X GET http://localhost:3100/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. Update User Profile
curl -X PUT http://localhost:3200/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Updated bio",
    "location": "New York, NY"
  }'

# 5. Search Users
curl -X GET "http://localhost:3200/api/v1/users/search?q=test" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 6. Logout
curl -X POST http://localhost:3100/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **Quick Test Script**
```bash
# Run the automated test script
./test-services.sh
```

---

## 📮 **3. Postman Testing**

### **Import Collections**

#### **Auth Service Collection**
```json
{
  "info": {
    "name": "Auth Service API",
    "description": "Authentication service endpoints",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3100",
      "type": "string"
    },
    {
      "key": "accessToken",
      "value": "",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "if (pm.response.code === 201) {",
                  "    const response = pm.response.json();",
                  "    pm.test('Registration successful', function () {",
                  "        pm.expect(response.success).to.be.true;",
                  "    });",
                  "}"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@example.com\",\n  \"username\": \"testuser\",\n  \"password\": \"SecurePassword123!\",\n  \"firstName\": \"Test\",\n  \"lastName\": \"User\",\n  \"dateOfBirth\": \"1990-01-01\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/v1/auth/register",
              "host": ["{{baseUrl}}"],
              "path": ["api", "v1", "auth", "register"]
            }
          }
        },
        {
          "name": "Login",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "if (pm.response.code === 200) {",
                  "    const response = pm.response.json();",
                  "    pm.test('Login successful', function () {",
                  "        pm.expect(response.success).to.be.true;",
                  "        pm.expect(response.data.accessToken).to.exist;",
                  "    });",
                  "    pm.collectionVariables.set('accessToken', response.data.accessToken);",
                  "}"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"SecurePassword123!\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/v1/auth/login",
              "host": ["{{baseUrl}}"],
              "path": ["api", "v1", "auth", "login"]
            }
          }
        },
        {
          "name": "Get Profile",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{accessToken}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/v1/auth/me",
              "host": ["{{baseUrl}}"],
              "path": ["api", "v1", "auth", "me"]
            }
          }
        },
        {
          "name": "Logout",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{accessToken}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/v1/auth/logout",
              "host": ["{{baseUrl}}"],
              "path": ["api", "v1", "auth", "logout"]
            }
          }
        }
      ]
    }
  ]
}
```

#### **User Service Collection**
```json
{
  "info": {
    "name": "User Service API",
    "description": "User management service endpoints",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3200",
      "type": "string"
    },
    {
      "key": "accessToken",
      "value": "",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Users",
      "item": [
        {
          "name": "Get Profile",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{accessToken}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/v1/users/profile",
              "host": ["{{baseUrl}}"],
              "path": ["api", "v1", "users", "profile"]
            }
          }
        },
        {
          "name": "Update Profile",
          "request": {
            "method": "PUT",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{accessToken}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"bio\": \"Updated bio from Postman\",\n  \"location\": \"San Francisco, CA\",\n  \"website\": \"https://test.com\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/v1/users/profile",
              "host": ["{{baseUrl}}"],
              "path": ["api", "v1", "users", "profile"]
            }
          }
        },
        {
          "name": "Search Users",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{accessToken}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/v1/users/search?q=test&limit=10",
              "host": ["{{baseUrl}}"],
              "path": ["api", "v1", "users", "search"],
              "query": [
                {
                  "key": "q",
                  "value": "test"
                },
                {
                  "key": "limit",
                  "value": "10"
                }
              ]
            }
          }
        }
      ]
    }
  ]
}
```

### **Postman Environment Variables**
```json
{
  "id": "mini-facebook-dev",
  "name": "Mini Facebook Development",
  "values": [
    {
      "key": "authBaseUrl",
      "value": "http://localhost:3100",
      "enabled": true
    },
    {
      "key": "userBaseUrl",
      "value": "http://localhost:3200",
      "enabled": true
    },
    {
      "key": "accessToken",
      "value": "",
      "enabled": true
    }
  ]
}
```

---

## 📚 **4. Swagger Documentation & Testing**

### **Install Swagger Dependencies**
```bash
# Add to each service
npm install swagger-ui-express swagger-jsdoc @types/swagger-ui-express
```

### **Auth Service Swagger Setup**
```typescript
// services/auth-service/src/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Auth Service API',
      version: '1.0.0',
      description: 'Authentication service for Mini Facebook',
    },
    servers: [
      {
        url: 'http://localhost:3100',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const specs = swaggerJsdoc(options);

export { swaggerUi, specs };
```

### **Swagger Annotations Example**
```typescript
/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@example.com
 *               username:
 *                 type: string
 *                 example: testuser
 *               password:
 *                 type: string
 *                 example: SecurePassword123!
 *               firstName:
 *                 type: string
 *                 example: Test
 *               lastName:
 *                 type: string
 *                 example: User
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: 1990-01-01
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       example: uuid-123
 *                     email:
 *                       type: string
 *                       example: test@example.com
 *                     username:
 *                       type: string
 *                       example: testuser
 *       400:
 *         description: Validation error
 */
```

### **Add Swagger to Express App**
```typescript
// services/auth-service/src/index.ts
import { swaggerUi, specs } from './swagger';

// Add Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
```

---

## 🔄 **Testing Workflow**

### **Development Workflow**
1. **Write Code** → **Run Automated Tests** → **Fix Issues**
2. **Manual Testing** → **Postman Testing** → **Verify Integration**
3. **Swagger Documentation** → **API Documentation** → **Client Generation**

### **Testing Strategy**
```bash
# 1. Fast feedback loop (during development)
npm test                    # Automated tests

# 2. Integration testing (before commit)
./test-services.sh         # Manual API testing

# 3. Documentation & exploration
# Open http://localhost:3100/api-docs (Swagger)
# Use Postman collections for interactive testing
```

---

## 📊 **Test Coverage Comparison**

| Test Type | Speed | Dependencies | Coverage | Purpose |
|-----------|-------|--------------|----------|---------|
| **Automated (Jest)** | ⚡ Fast | Mocked | Unit + Integration | Development |
| **Manual API** | 🐌 Slow | Real | End-to-End | Verification |
| **Postman** | 🔄 Interactive | Real | Manual | Exploration |
| **Swagger** | 🔄 Interactive | Real | Documentation | API Docs |

---

## 🎯 **When to Use Each**

### **Use Automated Tests When:**
- Writing new code
- Refactoring existing code
- Setting up CI/CD
- Need fast feedback

### **Use Manual API Testing When:**
- Testing complete user journeys
- Verifying service integration
- Testing with real data
- Before deployment

### **Use Postman When:**
- Exploring APIs
- Sharing test scenarios
- Manual QA testing
- API debugging

### **Use Swagger When:**
- Documenting APIs
- Generating client code
- API exploration
- Team collaboration

---

## 🚀 **Quick Start**

### **1. Run Automated Tests**
```bash
cd services/auth-service && npm test
cd services/user-service && npm test
```

### **2. Start Services & Test Manually**
```bash
# Start Docker
docker compose -f deployment/docker/docker-compose.dev.yml up -d

# Start services
cd services/auth-service && npm run dev &
cd services/user-service && npm run dev &

# Test with script
./test-services.sh
```

### **3. Use Postman**
- Import the collections above
- Set environment variables
- Run test scenarios

### **4. Use Swagger**
- Visit http://localhost:3100/api-docs (Auth Service)
- Visit http://localhost:3200/api-docs (User Service)
- Test APIs interactively

This comprehensive testing approach ensures your services are robust, well-documented, and ready for production! 🎉
