# Database Utilities Examples

This folder contains examples of how to use the database migration and seeder utilities in your services.

## When to Use Migrations and Seeders

### Current Development Phase (Docker Init Scripts)
- Use Docker init scripts in `/deployment/docker/init-scripts/` for initial development
- Simple database setup for prototyping
- No complex migration management needed yet

### When You'll Actually Need Migrations

1. **Production Deployment** - When you can't just recreate databases
2. **Team Collaboration** - When multiple developers need consistent DB changes
3. **Schema Evolution** - When you need to modify existing tables without losing data
4. **Feature Additions** - When you add new tables/columns to existing services

### When You'll Actually Need Seeders

1. **Testing** - When you need consistent test data
2. **Development Environment** - When you need sample data for development
3. **Staging Environment** - When you need realistic data for testing

## Example Files

### `auth-service-migrations.ts`
Shows how to run migrations for the Auth Service using the shared migration utilities.

### `auth-service-seeders.ts`
Shows how to run seeders for the Auth Service using the shared seeder utilities.

### `auth-service-seed-data.ts`
Example seeder function that creates test users for development and testing.

## Usage

When you're ready to use migrations and seeders in your services:

1. Copy the example files to your service
2. Modify the database connection configuration
3. Create your migration SQL files in `src/migrations/`
4. Create your seeder functions in `src/seeders/`
5. Add npm scripts to your service's `package.json`:

```json
{
  "scripts": {
    "db:migrate": "ts-node src/migrations/run-migrations.ts",
    "db:seed": "ts-node src/seeders/run-seeders.ts",
    "db:reset": "npm run db:seed:cleanup && npm run db:seed"
  }
}
```

## For Now

Keep using the Docker init scripts in `/deployment/docker/init-scripts/` for your current development. These examples are here for when you need them later.
