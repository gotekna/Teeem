class ApplicationJob < ActiveJob::Base
  # Automatically retry jobs that encountered a deadlock with exponential backoff
  retry_on ActiveRecord::Deadlocked, wait: :exponentially_longer, attempts: 5

  # Retry on transient network errors
  retry_on Net::ReadTimeout, wait: 5.seconds, attempts: 3
  retry_on Net::OpenTimeout, wait: 5.seconds, attempts: 3
  retry_on Errno::ECONNREFUSED, wait: 10.seconds, attempts: 3

  # Retry on transient infrastructure errors (worker crashes, DB pool exhaustion)
  # These account for 64% of all failed jobs - they succeed on next attempt
  retry_on ActiveRecord::DatabaseConnectionError, wait: :exponentially_longer, attempts: 5
  retry_on ActiveRecord::ConnectionNotEstablished, wait: 10.seconds, attempts: 3
  retry_on ActiveRecord::ConnectionTimeoutError, wait: :exponentially_longer, attempts: 5
  retry_on SolidQueue::Processes::ProcessPrunedError, wait: 30.seconds, attempts: 3
  retry_on SolidQueue::Processes::ProcessExitError, wait: 30.seconds, attempts: 3

  # Discard jobs that can never succeed without manual intervention
  discard_on ActiveJob::DeserializationError
  discard_on ActiveModel::UnknownAttributeError   # Schema mismatch - won't self-heal
  discard_on ActiveModel::MissingAttributeError    # Schema mismatch - won't self-heal
  discard_on MicrosoftAppGraphClient::DeadTokenError    # Needs manual re-auth in Settings
  discard_on MicrosoftAppGraphClient::NotConnectedError # Needs manual reconnect in Settings

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
