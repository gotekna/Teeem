module Api
  module V1
    class RainLogsController < ApplicationController
      before_action :set_job
      before_action :set_rain_log, only: [:show, :update, :destroy]

      # GET /api/v1/constructions/:job_id/rain_logs
      def index
        @rain_logs = @job.rain_logs.recent.includes(:created_by_user)

        # Optional date range filter
        if params[:start_date].present? && params[:end_date].present?
          @rain_logs = @rain_logs.by_date_range(params[:start_date], params[:end_date])
        end

        # Optional source filter
        if params[:source].present?
          @rain_logs = @rain_logs.where(source: params[:source])
        end

        render json: {
          rain_logs: @rain_logs.as_json(
            include: {
              created_by_user: { only: [:id, :name, :email] }
            }
          )
        }
      end

      # GET /api/v1/constructions/:job_id/rain_logs/:id
      def show
        render json: {
          rain_log: @rain_log.as_json(
            include: {
              created_by_user: { only: [:id, :name, :email] }
            }
          )
        }
      end

      # POST /api/v1/constructions/:job_id/rain_logs
      def create
        @rain_log = @job.rain_logs.build(rain_log_params)
        @rain_log.created_by_user = current_user
        @rain_log.source = 'manual'

        # Auto-calculate severity if rainfall_mm is provided
        if @rain_log.rainfall_mm.present?
          @rain_log.severity = RainLog.calculate_severity(@rain_log.rainfall_mm)
        end

        if @rain_log.save
          render json: {
            rain_log: @rain_log.as_json(
              include: {
                created_by_user: { only: [:id, :name, :email] }
              }
            )
          }, status: :created
        else
          render json: { errors: @rain_log.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/constructions/:job_id/rain_logs/:id
      def update
        if @rain_log.update(rain_log_params)
          # Auto-calculate severity if rainfall_mm changed
          if @rain_log.saved_change_to_rainfall_mm?
            @rain_log.auto_calculate_severity!
          end

          render json: {
            rain_log: @rain_log.reload.as_json(
              include: {
                created_by_user: { only: [:id, :name, :email] }
              }
            )
          }
        else
          render json: { errors: @rain_log.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/constructions/:job_id/rain_logs/:id
      def destroy
        @rain_log.destroy
        head :no_content
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_rain_log
        @rain_log = @job.rain_logs.find(params[:id])
      end

      def rain_log_params
        params.require(:rain_log).permit(
          :date,
          :rainfall_mm,
          :hours_affected,
          :severity,
          :notes
        )
      end
    end
  end
end
