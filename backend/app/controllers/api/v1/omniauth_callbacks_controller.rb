module Api
  module V1
    class OmniauthCallbacksController < ApplicationController
      skip_before_action :authorize_request, only: [ :microsoft_office365, :failure ]

      def microsoft_office365
        @user = User.from_omniauth(request.env["omniauth.auth"])

        if @user.persisted?
          # Update last login timestamp
          @user.update_column(:last_login_at, Time.current)

          token = JsonWebToken.encode(user_id: @user.id)

          # Redirect to frontend with token
          redirect_to "#{ENV['FRONTEND_URL']}/auth/callback?token=#{token}&user=#{CGI.escape(@user.to_json)}"
        else
          redirect_to "#{ENV['FRONTEND_URL']}/login?error=authentication_failed"
        end
      end

      def failure
        redirect_to "#{ENV['FRONTEND_URL']}/login?error=#{params[:message]}"
      end
    end
  end
end
