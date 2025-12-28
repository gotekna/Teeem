require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_mailbox/engine"
require "action_text/engine"
require "action_view/railtie"
require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Backend
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.0

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks scripts])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # Set default timezone to Australia/Brisbane (matches company_settings default)
    # This can be overridden per-company via CompanySetting.instance.timezone
    config.time_zone = "Australia/Brisbane"
    # config.eager_load_paths << Rails.root.join("extras")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true

    # Response compression (performance: reduces large JSON responses by 70-90%)
    # Compresses responses larger than 1KB using gzip/deflate
    config.middleware.use Rack::Deflater

    # Enable Rack::Attack for rate limiting
    config.middleware.use Rack::Attack

    # Request body size limit middleware (security: prevents DoS via large uploads)
    # 100MB limit for file uploads, applied before request body is read
    require_relative "../app/middleware/request_size_limit_middleware"
    config.middleware.insert_before Rack::Attack, RequestSizeLimitMiddleware, max_bytes: 100.megabytes

    # Performance Observatory - Request Timing Middleware
    # Captures request duration with zero production impact (~0.1ms overhead)
    # All writes are async via Performance::Buffer
    require_relative "../app/middleware/request_timing_middleware"
    config.middleware.use RequestTimingMiddleware

    # Configure ActiveRecord encryption to use environment variables
    config.active_record.encryption.primary_key = ENV["ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY"]
    config.active_record.encryption.deterministic_key = ENV["ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY"]
    config.active_record.encryption.key_derivation_salt = ENV["ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT"]
  end
end
