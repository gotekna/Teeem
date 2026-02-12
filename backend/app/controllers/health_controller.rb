class HealthController < ApplicationController
  skip_before_action :authorize_request, only: [ :index, :version, :worker_status ]

  def index
    render json: {
      status: "ok",
      timestamp: Time.current,
      environment: Rails.env,
      version: AppVersion.current_version_string
    }
  end

  def version
    # Use HEROKU_RELEASE_CREATED_AT for actual deploy time (requires dyno metadata addon).
    # FRC (Feb 2026): Do NOT fallback to Time.current — that makes every refresh
    # show the current time instead of the actual deploy time. Return nil so
    # the frontend falls back to its own NEXT_PUBLIC_BUILD_TIME (baked at Vercel build).
    deploy_time = ENV["HEROKU_RELEASE_CREATED_AT"].present? ?
      Time.parse(ENV["HEROKU_RELEASE_CREATED_AT"]) : nil

    response = {
      version: AppVersion.current_version_string,
      timestamp: deploy_time
    }
    # Include heroku_release if available (requires dyno metadata feature)
    heroku_release = ENV["HEROKU_RELEASE_VERSION"]
    response[:heroku_release] = heroku_release if heroku_release.present?
    render json: response
  end

  def worker_status
    require_relative "../../lib/worker_watchdog" unless defined?(WorkerWatchdog)
    status = WorkerWatchdog.assess_worker_health
    http_status = status[:status] == "healthy" ? :ok : :service_unavailable
    render json: status, status: http_status
  end

  def increment_version
    new_version = AppVersion.increment!
    render json: {
      version: "v#{new_version}",
      message: "AppVersion incremented successfully"
    }
  end
end
