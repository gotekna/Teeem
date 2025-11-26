source "https://rubygems.org"

# Bundle edge Rails instead: gem "rails", github: "rails/rails", branch: "main"
gem "rails", "~> 8.0.4"
# Use postgresql as the database for Active Record
gem "pg", "~> 1.1"
# Use the Puma web server [https://github.com/puma/puma]
gem "puma", ">= 5.0"
# Build JSON APIs with ease [https://github.com/rails/jbuilder]
# gem "jbuilder"

# Use Active Model has_secure_password [https://guides.rubyonrails.org/active_model_basics.html#securepassword]
gem "bcrypt", "~> 3.1.7"

# JWT for token-based authentication
gem "jwt", "~> 3.1"

# OAuth authentication
gem "omniauth", "~> 2.1"
gem "omniauth-microsoft-office365", "~> 0.0.8"
gem "omniauth-rails_csrf_protection", "~> 1.0"  # Security fix for Rails

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Use the database-backed adapters for Rails.cache, Active Job, and Action Cable
gem "solid_cache"
gem "solid_queue", "~> 1.1.0"  # Pin to version without key_hash requirement
gem "solid_cable"

# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

# Deploy this application anywhere as a Docker container [https://kamal-deploy.org]
gem "kamal", require: false

# Add HTTP asset caching/compression and X-Sendfile acceleration to Puma [https://github.com/basecamp/thruster/]
gem "thruster", require: false

# Use Active Storage variants [https://guides.rubyonrails.org/active_storage_overview.html#transforming-images]
# gem "image_processing", "~> 1.2"

# Use Rack CORS for handling Cross-Origin Resource Sharing (CORS), making cross-origin Ajax possible
gem "rack-cors"

# Rate limiting and throttling
gem "rack-attack", "~> 6.7"

# File processing for spreadsheet import/export
gem "roo", "~> 2.10.0"  # Excel/CSV parsing
gem "caxlsx", "~> 4.1.0"  # Excel generation
gem "caxlsx_rails", "~> 0.6.3"  # Rails integration for Excel export

# Image management and scraping
gem "cloudinary", "~> 2.1"  # Cloud image storage and CDN
gem "httparty", "~> 0.22"  # HTTP requests for image scraping
gem "http", "~> 5.1"  # HTTP client for OAuth token refresh
gem "mini_magick", "~> 4.12"  # Image processing

# OAuth2 for Xero integration
gem "oauth2", "~> 2.0"  # OAuth2 authentication for Xero API
gem "fuzzy_match", "~> 2.1"  # Fuzzy string matching for contact sync
gem "rexml"  # XML parsing for ABN lookup service

# SMS integration
gem "twilio-ruby", "~> 7.3"  # Twilio SDK for SMS messaging

# AI integration for plan analysis
gem "anthropic", "~> 0.1.0"  # Claude API for AI-powered plan review

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"

  # Load environment variables from .env file
  gem "dotenv-rails"

  # Static analysis for security vulnerabilities [https://brakemanscanner.org/]
  gem "brakeman", require: false

  # Omakase Ruby styling [https://github.com/rails/rubocop-rails-omakase/]
  gem "rubocop-rails-omakase", require: false

  # Ruby LSP for modern IDE support
  gem "ruby-lsp", require: false

  # Testing framework
  gem "rspec-rails", "~> 7.1"
  gem "factory_bot_rails", "~> 6.4"
  gem "faker", "~> 3.5"
  gem "shoulda-matchers", "~> 6.4"
  gem "webmock", "~> 3.24"
  gem "vcr", "~> 6.3"
  gem "simplecov", "~> 0.22", require: false
end
gem "dentaku"
