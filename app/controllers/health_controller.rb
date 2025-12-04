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
    # Only include heroku_release if available (requires dyno metadata feature)
    if ENV['HEROKU_RELEASE_VERSION'].present?
      response[:heroku_release] = ENV['HEROKU_RELEASE_VERSION']
    end
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
