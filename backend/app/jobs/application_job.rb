class ApplicationJob < ActiveJob::Base
  # Automatically retry jobs that encountered a deadlock with exponential backoff
  retry_on ActiveRecord::Deadlocked, wait: :exponentially_longer, attempts: 5

  # Retry on transient network errors
  retry_on Net::ReadTimeout, wait: 5.seconds, attempts: 3
  retry_on Net::OpenTimeout, wait: 5.seconds, attempts: 3
  retry_on Errno::ECONNREFUSED, wait: 10.seconds, attempts: 3

  # Most jobs are safe to ignore if the underlying records are no longer available
  discard_on ActiveJob::DeserializationError

  # Log all job failures and report to Sentry
  rescue_from StandardError do |exception|
    Rails.logger.error("Job #{self.class.name} failed: #{exception.class} - #{exception.message}")
    Rails.logger.error(exception.backtrace.first(10).join("\n"))

    # Report to Sentry with job context
    if defined?(Sentry)
      Sentry.capture_exception(exception) do |scope|
        scope.set_tags(
          job_class: self.class.name,
          job_id: job_id,
          queue_name: queue_name
        )
        scope.set_context("job", {
          class: self.class.name,
          job_id: job_id,
          queue: queue_name,
          arguments: arguments.map { |arg| arg.try(:to_global_id)&.to_s || arg.inspect }.first(5),
          executions: executions,
          scheduled_at: scheduled_at
        })
      end
    end

    # Re-raise so Active Job can handle retry logic
    raise exception
  end
end
