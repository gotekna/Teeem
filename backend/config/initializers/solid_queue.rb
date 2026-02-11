# frozen_string_literal: true

# SolidQueue error reporting - send thread-level errors to Sentry
#
# FRC (Feb 2026): SolidQueue worker threads can fail silently. This ensures
# all thread-level errors (not just job-level) are reported to Sentry for
# visibility into queue infrastructure issues.
#
Rails.application.config.after_initialize do
  if defined?(SolidQueue) && defined?(Sentry)
    SolidQueue.on_thread_error = ->(error) do
      Rails.logger.error "[SolidQueue] Thread error: #{error.class} - #{error.message}"
      Sentry.capture_exception(error) do |scope|
        scope.set_tags(source: "solid_queue", error_type: "thread_error")
      end
    end
  end
end
