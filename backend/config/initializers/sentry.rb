# frozen_string_literal: true

return unless defined?(Sentry)

Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]
  config.breadcrumbs_logger = [ :active_support_logger, :http_logger ]

  # Performance monitoring - traces_sample_rate replaces enable_tracing
  # Set to 1.0 to capture 100% of transactions for tracing in dev
  # Reduced in production for performance
  config.traces_sample_rate = Rails.env.production? ? 0.1 : 1.0

  # Profiling requires stackprof gem - only enable if installed
  config.profiles_sample_rate = defined?(StackProf) ? 0.1 : 0.0

  # Filter out sensitive parameters
  config.send_default_pii = false
  # Sentry automatically filters Rails.application.config.filter_parameters

  # Set the environment
  config.environment = Rails.env
  config.release = ENV["HEROKU_SLUG_COMMIT"] || ENV["GIT_COMMIT"] || "unknown"

  # Ignore common exceptions that don't need tracking
  config.excluded_exceptions += [
    "ActionController::RoutingError",
    "ActiveRecord::RecordNotFound"
  ]
end
