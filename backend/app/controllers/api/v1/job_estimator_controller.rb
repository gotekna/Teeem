module Api
  module V1
    class JobEstimatorController < ApplicationController
      before_action :set_job

      # POST /api/v1/jobs/:job_id/analyze
      # Generate AI analysis of the job
      def analyze
        service = JobEstimatorService.new(@job)
        result = service.analyze

        if result[:success]
          render json: {
            success: true,
            analysis: result[:analysis],
            processing_time_ms: result[:processing_time_ms],
            ai_model_used: result[:ai_model_used]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :internal_server_error
        end
      rescue StandardError => e
        Rails.logger.error "Job analysis error: #{e.message}"
        render json: {
          success: false,
          error: "Failed to analyze job: #{e.message}"
        }, status: :internal_server_error
      end

      private

      def set_job
        # SSoT: Use Job.with_contacts scope for standard includes
        @job = Job.with_contacts.find(params[:job_id])
      end
    end
  end
end
