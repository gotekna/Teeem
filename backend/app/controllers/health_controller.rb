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
    render json: {
      version: Version.current_version_string,
      timestamp: Time.current,
      heroku_release: ENV['HEROKU_RELEASE_VERSION']
    }
  end

  def increment_version
    new_version = Version.increment!
    render json: {
      version: "v#{new_version}",
      message: "Version incremented successfully"
    }
  end
end
