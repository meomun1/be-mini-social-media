# Auth Service Database Migrations

## Overview

This directory contains database migrations for the Auth Service. These migrations are designed to work in both development and production environments.

## Development vs Production

### Development Environment
- **Database Setup**: Uses Docker init scripts in `deployment/docker/init-scripts/auth-db-init.sql`
- **Purpose**: Quick setup for local development
- **Tables**: All tables are created automatically when the Docker container starts
- **Migrations**: Can be run safely (they use `CREATE TABLE IF NOT EXISTS`)

### Production Environment
- **Database Setup**: Uses these migration files
- **Purpose**: Controlled, versioned database changes
- **Tables**: Created incrementally through migrations
- **Tracking**: Migration history is tracked in the `migrations` table

## Migration Files

1. **000_check_environment.sql** - Environment setup and table checking
2. **001_create_users_table.sql** - Users table and related indexes/triggers
3. **002_create_sessions_table.sql** - User sessions table
4. **003_create_refresh_tokens_table.sql** - JWT refresh tokens table
5. **004_create_password_resets_table.sql** - Password reset functionality
6. **005_create_email_verifications_table.sql** - Email verification system

## Usage

### Development
```bash
# Migrations are optional in development since Docker init script handles setup
npm run db:migrate  # Safe to run, won't duplicate tables
```

### Production
```bash
# Run migrations to set up the database
npm run db:migrate
```

### Seeding (Development Only)
```bash
# Add test users for development
npm run db:seed

# Clean up test users
npm run db:seed:cleanup

# Reset database (cleanup + seed)
npm run db:reset
```

## Safety Features

- All migrations use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`
- Safe to run multiple times without errors
- Migrations are tracked to prevent duplicate execution
- Environment-aware setup

## Notes

- The Docker init script and migrations create the same schema
- This duplication is intentional for flexibility
- In development, you can use either approach
- In production, use migrations for better control and versioning
