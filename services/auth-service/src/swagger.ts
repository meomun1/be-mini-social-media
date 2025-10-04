import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Auth Service API',
      version: '1.0.0',
      description: 'Authentication service for Mini Facebook Backend',
      contact: {
        name: 'Mini Facebook Team',
        email: 'dev@minifacebook.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
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
        RegisterRequest: {
          type: 'object',
          required: ['email', 'username', 'password', 'firstName', 'lastName'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 50,
              example: 'johndoe',
            },
            password: {
              type: 'string',
              minLength: 8,
              example: 'SecurePassword123!',
            },
            firstName: {
              type: 'string',
              maxLength: 100,
              example: 'John',
            },
            lastName: {
              type: 'string',
              maxLength: 100,
              example: 'Doe',
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              example: '1990-01-15',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              example: 'SecurePassword123!',
            },
            rememberMe: {
              type: 'boolean',
              default: false,
              example: true,
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                expiresIn: {
                  type: 'number',
                  example: 3600,
                },
                user: {
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
                      example: 'user@example.com',
                    },
                    username: {
                      type: 'string',
                      example: 'johndoe',
                    },
                    firstName: {
                      type: 'string',
                      example: 'John',
                    },
                    lastName: {
                      type: 'string',
                      example: 'Doe',
                    },
                    profilePicture: {
                      type: 'string',
                      example: 'https://cdn.example.com/profile.jpg',
                    },
                  },
                },
              },
            },
            message: {
              type: 'string',
              example: 'Login successful',
            },
          },
        },
        ForgotPasswordRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
          },
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: {
              type: 'string',
              example: 'reset-token-123',
            },
            newPassword: {
              type: 'string',
              minLength: 8,
              example: 'NewSecurePassword123!',
            },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: {
              type: 'string',
              example: 'CurrentPassword123!',
            },
            newPassword: {
              type: 'string',
              minLength: 8,
              example: 'NewSecurePassword123!',
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
                        example: 'email',
                      },
                      message: {
                        type: 'string',
                        example: 'Email is required',
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
