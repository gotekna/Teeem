# frozen_string_literal: true

# Lograge - Structured logging for Rails
# Replaces verbose Rails logs with single-line JSON entries

Rails.application.configure do
  # Enable lograge
  config.lograge.enabled = true

  # Use JSON format for easy parsing
  config.lograge.formatter = Lograge::Formatters::Json.new

  # Include additional custom data
  config.lograge.custom_options = lambda do |event|
    {
      time: event.time,
      remote_ip: event.payload[:ip],
      user_id: event.payload[:current_user_id],
      request_id: event.payload[:headers]['X-Request-Id'],
      exception: event.payload[:exception]&.first,
      exception_message: event.payload[:exception]&.last
    }.compact
  end

  # Keep SQL queries out of logs by default (too verbose)
  # Enable only for specific debugging: RAILS_LOG_SQL=true
  config.lograge.keep_original_rails_log = false

  # Log rotation: Keep 3 files of 10MB each (development only)
  # Production logs to STDOUT (Heroku handles rotation)
  if Rails.env.development?
    config.lograge.logger = ActiveSupport::Logger.new(
      Rails.root.join('log', "#{Rails.env}.log"),
      3,                  # Keep 3 old log files
      10 * 1024 * 1024    # 10MB per file
    )
  else
    config.lograge.logger = ActiveSupport::Logger.new(Rails.root.join('log', "#{Rails.env}.log"))
  end

  # Log additional fields
  config.lograge.custom_payload do |controller|
    {
      host: controller.request.host,
      current_user_id: controller.current_user&.id
    }.compact
  end
end
