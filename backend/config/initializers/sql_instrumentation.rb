# frozen_string_literal: true

# Performance Observatory - SQL Query Instrumentation
# Captures slow SQL queries (>100ms) for analysis
#
# Uses ActiveSupport::Notifications to subscribe to sql.active_record events
# All captures are async via Performance::Buffer (zero production impact)
#
# Configuration via environment variables:
#   PERFORMANCE_SLOW_QUERY_THRESHOLD_MS - Threshold in ms (default: 100)
#   PERFORMANCE_SQL_INSTRUMENTATION_ENABLED - Enable/disable (default: true in production)
#

Rails.application.config.after_initialize do
  # Only enable in production by default (can override with env var)
  enabled = if ENV.key?("PERFORMANCE_SQL_INSTRUMENTATION_ENABLED")
              ENV["PERFORMANCE_SQL_INSTRUMENTATION_ENABLED"] == "true"
            else
              Rails.env.production?
            end

  next unless enabled

  threshold_ms = (ENV["PERFORMANCE_SLOW_QUERY_THRESHOLD_MS"] || 100).to_i

  Rails.logger.info "[Performance::SQLInstrumentation] Enabled with #{threshold_ms}ms threshold"

  # Subscribe to SQL events
  ActiveSupport::Notifications.subscribe("sql.active_record") do |*args|
    event = ActiveSupport::Notifications::Event.new(*args)

    # Skip if below threshold
    duration_ms = event.duration
    next if duration_ms < threshold_ms

    # Skip schema queries and internal Rails queries
    sql = event.payload[:sql]
    next if sql.blank?
    next if sql.start_with?("SCHEMA", "SHOW", "SET ", "BEGIN", "COMMIT", "ROLLBACK")
    next if sql.include?("pg_") || sql.include?("information_schema")
    next if sql.include?("solid_queue") # Skip queue internals

    # Extract query info
    fingerprint = PerformanceSlowQuery.fingerprint(sql)
    table_name = PerformanceSlowQuery.extract_table(sql)
    operation = PerformanceSlowQuery.extract_operation(sql)

    # Get caller location (skip ActiveRecord internals)
    caller_location = caller.find do |line|
      line.include?("/app/") && !line.include?("/active_record/")
    end

    # Get current request context if available
    endpoint = Thread.current[:performance_current_endpoint]
    user_id = Thread.current[:performance_current_user_id]

    # Push to async buffer
    Performance::Buffer.push_slow_query(
      query_fingerprint: fingerprint,
      duration_ms: duration_ms.round(1),
      table_name: table_name,
      operation: operation,
      caller_location: caller_location&.gsub(Rails.root.to_s, ""),
      user_id: user_id,
      endpoint: endpoint,
      metadata: {
        name: event.payload[:name],
        cached: event.payload[:cached],
        async: event.payload[:async]
      }
    )
  end
end
