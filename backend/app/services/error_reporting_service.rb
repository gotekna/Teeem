# frozen_string_literal: true

# ErrorReportingService - Token-efficient error reporting
#
# Captures minimal context for debugging while avoiding verbose logs.
# Integrates with Sentry for structured error tracking.
#
# Usage:
#   ErrorReportingService.report(exception, context: { user_id: 123, action: 'create' })
#
class ErrorReportingService
  class << self
    # Report an error with minimal context
    #
    # @param exception [Exception] The error to report
    # @param context [Hash] Additional context (user_id, endpoint, action, etc.)
    # @param level [:error, :warning, :info] Severity level
    def report(exception, context: {}, level: :error)
      # Build error report
      error_data = build_error_data(exception, context)

      # Log to Rails logger (structured via lograge)
      log_error(error_data, level)

      # Send to Sentry with full context
      send_to_sentry(exception, error_data) if should_send_to_sentry?(exception)

      error_data
    end

    # Report a message (no exception)
    def report_message(message, context: {}, level: :info)
      log_message(message, context, level)
      Sentry.capture_message(message, level: level, extra: context) if Sentry.initialized?
    end

    private

    def build_error_data(exception, context)
      {
        error_class: exception.class.name,
        message: exception.message,
        # Only first 5 lines from app code (exclude gems/framework)
        backtrace: filter_backtrace(exception.backtrace),
        context: sanitize_context(context),
        timestamp: Time.current.iso8601
      }
    end

    def filter_backtrace(backtrace)
      return [] unless backtrace

      # Take first 10 lines, filter to app code only
      app_lines = backtrace.first(10).select do |line|
        line.include?(Rails.root.to_s) && !line.include?("/vendor/") && !line.include?("/gems/")
      end

      # If no app lines, take first 3 overall lines
      app_lines.any? ? app_lines.first(5) : backtrace.first(3)
    end

    def sanitize_context(context)
      # Remove sensitive data
      context.except(:password, :token, :secret, :api_key, :credentials)
    end

    def log_error(error_data, level)
      case level
      when :error
        Rails.logger.error(error_data.to_json)
      when :warning
        Rails.logger.warn(error_data.to_json)
      else
        Rails.logger.info(error_data.to_json)
      end
    end

    def log_message(message, context, level)
      log_data = {
        message: message,
        context: sanitize_context(context),
        timestamp: Time.current.iso8601
      }

      case level
      when :error
        Rails.logger.error(log_data.to_json)
      when :warning
        Rails.logger.warn(log_data.to_json)
      else
        Rails.logger.info(log_data.to_json)
      end
    end

    def send_to_sentry(exception, error_data)
      return unless Sentry.initialized?

      Sentry.with_scope do |scope|
        # Add context
        scope.set_context("error_data", error_data[:context])
        scope.set_extra("filtered_backtrace", error_data[:backtrace])

        # Capture exception
        Sentry.capture_exception(exception)
      end
    end

    def should_send_to_sentry?(exception)
      # Don't send common/expected errors to Sentry
      excluded_errors = [
        "ActionController::RoutingError",
        "ActiveRecord::RecordNotFound",
        "ActionController::ParameterMissing"
      ]

      !excluded_errors.include?(exception.class.name)
    end
  end
end
