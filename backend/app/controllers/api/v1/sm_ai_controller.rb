# frozen_string_literal: true

module Api
  module V1
    class SmAiController < ApplicationController
      before_action :set_construction, except: [:estimate_duration]

      # GET /api/v1/constructions/:construction_id/sm_ai/suggestions
      def suggestions
        result = SmAiService.suggestions(@construction)

        render json: {
          success: true,
          construction_id: @construction.id,
          suggestions: result,
          generated_at: Time.current
        }
      end

      # GET /api/v1/constructions/:construction_id/sm_ai/predictions
      def predictions
        result = SmAiService.predictions(@construction)

        render json: {
          success: true,
          construction_id: @construction.id,
          predictions: result,
          generated_at: Time.current
        }
      end

      # GET /api/v1/constructions/:construction_id/sm_ai/resource_optimization
      def resource_optimization
        result = SmAiService.optimize_resources(@construction)

        render json: {
          success: true,
          construction_id: @construction.id,
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

      # GET /api/v1/constructions/:construction_id/sm_ai/summary
      def summary
        service = SmAiService.new(@construction)

        render json: {
          success: true,
          construction_id: @construction.id,
          suggestions: service.scheduling_suggestions.first(5),
          predictions: service.delay_predictions.first(5),
          resource_issues: service.resource_optimization.first(5),
          ai_summary: service.generate_summary
        }
      end

      private

      def set_construction
        @construction = Construction.find(params[:construction_id])
      end
    end
  end
end
