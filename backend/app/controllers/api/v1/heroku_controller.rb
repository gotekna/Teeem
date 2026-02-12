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

      # POST /api/v1/heroku/share_dev_database
      # Points Jake Dev and Rob Dev DATABASE_URL to Sam Dev's database.
      def share_dev_database
        result = HerokuPlatformService.share_dev_database

        if result[:success]
          render json: { success: true, data: result[:data] }
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/heroku/scale
      # Scales a dyno up (1) or down (0). Dev apps only.
      def scale
        app = params[:app]
        dyno = params[:dyno]
        quantity = params[:quantity].to_i

        result = HerokuPlatformService.scale_dyno(app, dyno, quantity)

        if result[:success]
          render json: { success: true, data: result[:data] }
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
      end

      private

      def require_admin
        head :forbidden unless current_user&.admin?
      end
    end
  end
end
