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

      # GET /api/v1/heroku/vercel_billing
      # Returns real Vercel billing data (invoices, build minutes, costs)
      def vercel_billing
        force_refresh = params[:refresh] == "true"
        result = VercelBillingService.billing(force_refresh: force_refresh)

        render json: { success: true, data: result }
      end

      # GET /api/v1/heroku/vercel_usage_breakdown
      # Returns build minutes broken down by week and day with per-project detail
      def vercel_usage_breakdown
        force_refresh = params[:refresh] == "true"
        result = VercelBillingService.usage_breakdown(force_refresh: force_refresh)

        render json: { success: true, data: result }
      end

      private

      def require_admin
        head :forbidden unless current_user&.admin?
      end
    end
  end
end
