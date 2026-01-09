# TEEEM API

Rails API for TEEEM application.

## Setup

```bash
# Install dependencies
bundle install

# Create database
rails db:create

# Run migrations
rails db:migrate

# Seed database (optional)
rails db:seed

# Start server
rails server
```

The API will be available at [http://localhost:3000](http://localhost:3000).

## Database

PostgreSQL is used for all environments. Configure in `config/database.yml`.

## CORS Configuration

CORS is configured in `config/initializers/cors.rb`. Set allowed origins via the `CORS_ORIGINS` environment variable:

```bash
export CORS_ORIGINS=http://localhost:5173,https://your-app.vercel.app
```

## API Endpoints

Add your API routes in `config/routes.rb`.

Example:
```ruby
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :items
    end
  end
end
```

## Heroku Deployment

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:essential-0

# Set environment variables
heroku config:set RAILS_ENV=production
heroku config:set CORS_ORIGINS=https://your-frontend.vercel.app

# Deploy
git push heroku main

# Run migrations
heroku run rails db:migrate
```

## Testing

Rails uses Minitest by default (skipped in this setup). To add tests:

```bash
# Add to Gemfile
gem "minitest-rails"

# Run tests
rails test
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `RAILS_ENV` - Rails environment (development/production)
- `CORS_ORIGINS` - Comma-separated list of allowed origins
- `SECRET_KEY_BASE` - Secret for sessions (generate with `rails secret`)
# Test commit for auto-versioning
