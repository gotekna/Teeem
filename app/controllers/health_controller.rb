class HealthController < ApplicationController
  skip_before_action :authorize_request, only: [:index, :version]

  def index
    render json: {
      status: "ok",
      timestamp: Time.current,
      environment: Rails.env,
      version: Version.current_version_string
    }
  end

  def version
    response = {
      version: Version.current_version_string,
      timestamp: Time.current
    }
    # Include heroku_release if available (requires dyno metadata feature)
    # Also include debug info to troubleshoot metadata availability
    heroku_release = ENV['HEROKU_RELEASE_VERSION']
    response[:heroku_release] = heroku_release if heroku_release.present?
    response[:heroku_app_name] = ENV['HEROKU_APP_NAME'] if ENV['HEROKU_APP_NAME'].present?
    render json: response
  end

  def increment_version
    new_version = Version.increment!
    render json: {
      version: "v#{new_version}",
      message: "Version incremented successfully"
    }
  end
end
