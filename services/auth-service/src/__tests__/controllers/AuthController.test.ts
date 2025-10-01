import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/authRoutes';

// Mock logger to avoid console spam during tests
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('AuthController - Simple Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes);
  });

  describe('POST /api/v1/auth/register', () => {
    it('should return validation error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        username: 'testuser',
        password: 'Test123!@#',
      };

      const response = await request(app).post('/api/v1/auth/register').send(userData).expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.email).toBeDefined();
    });

    it('should return validation error for weak password', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: '123',
      };

      const response = await request(app).post('/api/v1/auth/register').send(userData).expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.password).toBeDefined();
    });

    it('should return validation error for short username', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'ab',
        password: 'Test123!@#',
      };

      const response = await request(app).post('/api/v1/auth/register').send(userData).expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.username).toBeDefined();
    });

    it('should return validation error for missing fields', async () => {
      const userData = {
        email: 'test@example.com',
        // Missing username and password
      };

      const response = await request(app).post('/api/v1/auth/register').send(userData).expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return validation error for invalid email format', async () => {
      const credentials = {
        email: 'invalid-email',
        password: 'Test123!@#',
      };

      const response = await request(app).post('/api/v1/auth/login').send(credentials).expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.email).toBeDefined();
    });

    it('should return validation error for missing password', async () => {
      const credentials = {
        email: 'test@example.com',
        // Missing password
      };

      const response = await request(app).post('/api/v1/auth/login').send(credentials).expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return validation error for missing refresh token', async () => {
      const response = await request(app).post('/api/v1/auth/refresh').send({}).expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for empty refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: '' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should return validation error for invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.email).toBeDefined();
    });

    it('should return validation error for missing email', async () => {
      const response = await request(app).post('/api/v1/auth/forgot-password').send({}).expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should return validation error for missing token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ password: 'Test123!@#' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'valid-token', password: '123' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.password).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('should return validation error for missing token', async () => {
      const response = await request(app).post('/api/v1/auth/verify-email').send({}).expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should return validation error for missing current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({ new_password: 'NewTest123!@#' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for weak new password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          current_password: 'OldTest123!@#',
          new_password: '123',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.new_password).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return error without authorization header', async () => {
      const response = await request(app).get('/api/v1/auth/me').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return error with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should return error without authorization header', async () => {
      const response = await request(app).post('/api/v1/auth/logout').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
