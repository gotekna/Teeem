# frozen_string_literal: true

module Api
  module V1
    class SmAiController < ApplicationController
      before_action :set_job, except: [ :estimate_duration ]

      # GET /api/v1/constructions/:job_id/sm_ai/suggestions
      def suggestions
        result = SmAiService.suggestions(@job)

        render json: {
          success: true,
          construction_id: @job.id,
          suggestions: result,
          generated_at: Time.current
        }
      end

      # GET /api/v1/constructions/:job_id/sm_ai/predictions
      def predictions
        result = SmAiService.predictions(@job)

        render json: {
          success: true,
          construction_id: @job.id,
          predictions: result,
          generated_at: Time.current
        }
      end

      # GET /api/v1/constructions/:job_id/sm_ai/resource_optimization
      def resource_optimization
        result = SmAiService.optimize_resources(@job)

        render json: {
          success: true,
          construction_id: @job.id,
          optimization: result,
          generated_at: Time.current
        }
      end

      # POST /api/v1/sm_ai/estimate_duration
      def estimate_duration
        result = SmAiService.estimate_duration(
          task_name: params[:task_name],
          trade: params[:trade],
          scope: params[:scope]
        )

        render json: {
          success: true,
          estimate: result
        }
      end

      # GET /api/v1/constructions/:job_id/sm_ai/summary
      def summary
        service = SmAiService.new(@job)

        render json: {
          success: true,
          construction_id: @job.id,
          suggestions: service.scheduling_suggestions.first(5),
          predictions: service.delay_predictions.first(5),
          resource_issues: service.resource_optimization.first(5),
          ai_summary: service.generate_summary
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end
    end
  end
end
