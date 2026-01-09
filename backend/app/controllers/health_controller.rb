class HealthController < ApplicationController
  skip_before_action :authorize_request, only: [ :index, :version ]

  def index
    render json: {
      status: "ok",
      timestamp: Time.current,
      environment: Rails.env,
      version: Version.current_version_string
    }
  end

  def version
    # Use HEROKU_RELEASE_CREATED_AT for actual deploy time, fallback to current time
    deploy_time = ENV["HEROKU_RELEASE_CREATED_AT"].present? ?
      Time.parse(ENV["HEROKU_RELEASE_CREATED_AT"]) : Time.current

    response = {
      version: Version.current_version_string,
      timestamp: deploy_time
    }
    # Include heroku_release if available (requires dyno metadata feature)
    heroku_release = ENV["HEROKU_RELEASE_VERSION"]
    response[:heroku_release] = heroku_release if heroku_release.present?
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
