module Api
  module V1
    class HerokuController < ApplicationController
      before_action :require_admin

      # GET /api/v1/heroku/infrastructure
      # Returns live dyno/addon data from Heroku Platform API + external service constants.
      # Supports ?refresh=true to bust the 10-minute cache.
      def infrastructure
        force_refresh = params[:refresh] == "true"
        data = HerokuPlatformService.infrastructure(force_refresh: force_refresh)

        render json: { success: true, data: data }
      end

      private

      def require_admin
        head :forbidden unless current_user&.admin?
      end
    end
  end
end
