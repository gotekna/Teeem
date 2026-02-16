# frozen_string_literal: true

# Start the WorkerWatchdog on web dynos in deployed environments.
# Guards:
# - Only on Heroku (HEROKU_APP_NAME + HEROKU_API_KEY present)
# - Only on web dynos (DYNO starts with "web")
# - Not in dev/test

Rails.application.config.after_initialize do
  next unless ENV["HEROKU_APP_NAME"].present? && HerokuPlatformService.api_key?
  next unless ENV["DYNO"].to_s.start_with?("web")
  next if Rails.env.test? || Rails.env.development?

  require_relative "../../lib/worker_watchdog"
  WorkerWatchdog.start!
end
