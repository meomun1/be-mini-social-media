import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Service API',
      version: '1.0.0',
      description: 'User management service for Mini Facebook Backend',
      contact: {
        name: 'Mini Facebook Team',
        email: 'dev@minifacebook.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Development server',
      },
      {
        url: 'https://api.minifacebook.com',
        description: 'Production server',
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
      schemas: {
        UserProfile: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'test@example.com',
            },
            username: {
              type: 'string',
              example: 'testuser',
            },
            firstName: {
              type: 'string',
              example: 'Test',
            },
            lastName: {
              type: 'string',
              example: 'User',
            },
            profilePicture: {
              type: 'string',
              example: 'https://cdn.example.com/profile.jpg',
            },
            coverPhoto: {
              type: 'string',
              example: 'https://cdn.example.com/cover.jpg',
            },
            bio: {
              type: 'string',
              example: 'Software developer and tech enthusiast',
            },
            location: {
              type: 'string',
              example: 'San Francisco, CA',
            },
            website: {
              type: 'string',
              example: 'https://testuser.com',
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              example: '1990-01-01',
            },
            gender: {
              type: 'string',
              enum: ['male', 'female', 'other'],
              example: 'male',
            },
            isVerified: {
              type: 'boolean',
              example: true,
            },
            privacySettings: {
              $ref: '#/components/schemas/PrivacySettings',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z',
            },
          },
        },
        PrivacySettings: {
          type: 'object',
          properties: {
            profileVisibility: {
              type: 'string',
              enum: ['public', 'friends', 'private'],
              example: 'friends',
            },
            emailVisibility: {
              type: 'string',
              enum: ['public', 'friends', 'private'],
              example: 'friends',
            },
            phoneVisibility: {
              type: 'string',
              enum: ['public', 'friends', 'private'],
              example: 'private',
            },
            searchVisibility: {
              type: 'string',
              enum: ['public', 'friends', 'private'],
              example: 'public',
            },
          },
        },
        UpdateProfileRequest: {
          type: 'object',
          properties: {
            firstName: {
              type: 'string',
              maxLength: 100,
              example: 'Updated',
            },
            lastName: {
              type: 'string',
              maxLength: 100,
              example: 'Name',
            },
            bio: {
              type: 'string',
              maxLength: 500,
              example: 'Updated bio',
            },
            location: {
              type: 'string',
              maxLength: 255,
              example: 'New York, NY',
            },
            website: {
              type: 'string',
              maxLength: 255,
              example: 'https://updated-website.com',
            },
            privacySettings: {
              $ref: '#/components/schemas/PrivacySettings',
            },
          },
        },
        UserSearchResult: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            username: {
              type: 'string',
              example: 'testuser',
            },
            firstName: {
              type: 'string',
              example: 'Test',
            },
            lastName: {
              type: 'string',
              example: 'User',
            },
            profilePicture: {
              type: 'string',
              example: 'https://cdn.example.com/profile.jpg',
            },
            isFriend: {
              type: 'boolean',
              example: false,
            },
            friendRequestStatus: {
              type: 'string',
              enum: ['none', 'pending', 'accepted'],
              example: 'none',
            },
            mutualFriendsCount: {
              type: 'number',
              example: 5,
            },
          },
        },
        SearchResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                users: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/UserSearchResult',
                  },
                },
                pagination: {
                  $ref: '#/components/schemas/PaginationInfo',
                },
              },
            },
          },
        },
        PaginationInfo: {
          type: 'object',
          properties: {
            total: {
              type: 'number',
              example: 25,
            },
            limit: {
              type: 'number',
              example: 20,
            },
            offset: {
              type: 'number',
              example: 0,
            },
            hasMore: {
              type: 'boolean',
              example: true,
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Invalid input data',
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                        example: 'firstName',
                      },
                      message: {
                        type: 'string',
                        example: 'First name is required',
                      },
                    },
                  },
                },
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z',
            },
            requestId: {
              type: 'string',
              example: 'req_123456789',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const specs = swaggerJsdoc(options);

export { swaggerUi, specs };
