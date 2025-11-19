# frozen_string_literal: true

Sentry.init do |config|
  config.dsn = ENV['SENTRY_DSN']
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for tracing.
  # We recommend adjusting this value in production
  config.traces_sample_rate = Rails.env.production? ? 0.1 : 1.0

  # Set profiles_sample_rate to profile 100%
  # of sampled transactions.
  # We recommend adjusting this value in production
  config.profiles_sample_rate = Rails.env.production? ? 0.1 : 1.0

  # Filter out sensitive parameters
  config.send_default_pii = false
  config.sanitize_fields = Rails.application.config.filter_parameters.map(&:to_s)

  # Set the environment
  config.environment = Rails.env
  config.release = ENV['HEROKU_SLUG_COMMIT'] || ENV['GIT_COMMIT'] || 'unknown'

  # Enable performance monitoring
  config.enable_tracing = true

  # Ignore common exceptions that don't need tracking
  config.excluded_exceptions += [
    'ActionController::RoutingError',
    'ActiveRecord::RecordNotFound'
  ]
end
