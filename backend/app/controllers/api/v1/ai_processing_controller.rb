# frozen_string_literal: true

module Api
  module V1
    # API endpoints for AI Processing Pipeline configuration and logs
    # Dashboard: /admin/system/ai-processing
    class AiProcessingController < ApplicationController
      before_action :set_config, only: [:update_config]

      # GET /api/v1/ai_processing/configs
      # Returns all AI service configurations with accuracy stats
      def configs
        configs = AiServiceConfig.active.order(:service_type)

        render json: {
          success: true,
          data: configs.map { |config| serialize_config(config) }
        }
      end

      # PATCH /api/v1/ai_processing/configs/:id
      # Update a specific service configuration
      def update_config
        if @config.update(config_params)
          render json: {
            success: true,
            data: serialize_config(@config)
          }
        else
          render json: {
            success: false,
            error: @config.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/ai_processing/logs
      # Returns paginated processing logs with optional filters
      def logs
        logs = AiProcessingLog.recent

        # Filter by service type
        logs = logs.for_service(params[:service_type]) if params[:service_type].present?

        # Filter by corrected only
        logs = logs.corrected if params[:corrected] == "true"

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i.clamp(1, 100)

        total = logs.count
        logs = logs.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          data: logs.map { |log| serialize_log(log) },
          meta: {
            total: total,
            page: page,
            per_page: per_page,
            total_pages: (total.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/ai_processing/logs/:id
      # Returns detailed log entry
      def show_log
        log = AiProcessingLog.find(params[:id])

        render json: {
          success: true,
          data: serialize_log(log, detailed: true)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Log not found" }, status: :not_found
      end

      # GET /api/v1/ai_processing/stats
      # Returns accuracy statistics for all services
      def stats
        services = AiServiceConfig::SERVICE_TYPES.keys
        days = (params[:days] || 30).to_i.clamp(1, 365)

        stats = services.map do |service_type|
          accuracy = AiProcessingLog.accuracy_for(service_type, days: days)
          config = AiServiceConfig.for(service_type)

          {
            service_type: service_type,
            display_name: config.display_name,
            accuracy: accuracy[:accuracy],
            total: accuracy[:total],
            correct: accuracy[:correct],
            corrected: accuracy[:corrected],
            ocr_enabled: config.ocr_enabled?,
            ai_threshold: config.ai_threshold,
            ai_model: config.ai_model
          }
        end

        render json: {
          success: true,
          data: stats,
          meta: { days: days }
        }
      end

      # POST /api/v1/ai_processing/logs/:id/record_correction
      # Manually record a correction for a log entry
      def record_correction
        log = AiProcessingLog.find(params[:id])

        unless params[:corrected_to].present?
          return render json: {
            success: false,
            error: "corrected_to is required"
          }, status: :unprocessable_entity
        end

        log.record_correction!(params[:corrected_to], user: current_user)

        render json: {
          success: true,
          data: serialize_log(log)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Log not found" }, status: :not_found
      end

      # GET /api/v1/ai_processing/insights/:service_type
      # Returns learning insights for a specific service
      def insights
        service_type = params[:service_type]
        days = (params[:days] || 30).to_i.clamp(1, 365)

        unless AiServiceConfig::SERVICE_TYPES.key?(service_type)
          return render json: {
            success: false,
            error: "Invalid service type"
          }, status: :bad_request
        end

        config = AiServiceConfig.for(service_type)
        accuracy = AiProcessingLog.accuracy_for(service_type, days: days)
        patterns = AiProcessingLog.correction_patterns(service_type, days: days)
        threshold_suggestion = AiProcessingLog.suggest_threshold(service_type, days: days)
        method_effectiveness = AiProcessingLog.method_effectiveness(service_type, days: days)

        render json: {
          success: true,
          data: {
            service_type: service_type,
            display_name: config.display_name,
            current_config: {
              ocr_enabled: config.ocr_enabled?,
              ai_threshold: config.ai_threshold,
              ai_model: config.ai_model,
              ai_always: config.ai_always?
            },
            accuracy: accuracy,
            correction_patterns: patterns,
            threshold_suggestion: threshold_suggestion,
            method_effectiveness: method_effectiveness,
            days: days
          }
        }
      end

      # GET /api/v1/ai_processing/learning_summary
      # Returns overall learning summary across all services
      def learning_summary
        days = (params[:days] || 30).to_i.clamp(1, 365)

        services = AiServiceConfig::SERVICE_TYPES.keys.map do |service_type|
          config = AiServiceConfig.for(service_type)
          accuracy = AiProcessingLog.accuracy_for(service_type, days: days)
          suggestion = AiProcessingLog.suggest_threshold(service_type, days: days)

          {
            service_type: service_type,
            display_name: config.display_name,
            accuracy: accuracy[:accuracy],
            total: accuracy[:total],
            corrected: accuracy[:corrected],
            current_threshold: config.ai_threshold,
            suggested_threshold: suggestion&.dig(:suggested_threshold),
            recommendation: suggestion&.dig(:recommendation),
            needs_attention: suggestion && suggestion[:suggested_threshold] != config.ai_threshold
          }
        end

        # Filter to services with actual data
        active_services = services.select { |s| s[:total] > 0 }

        render json: {
          success: true,
          data: {
            services: services,
            summary: {
              total_services: services.count,
              active_services: active_services.count,
              services_needing_attention: services.count { |s| s[:needs_attention] },
              total_processed: services.sum { |s| s[:total] },
              total_corrected: services.sum { |s| s[:corrected] || 0 },
              overall_accuracy: calculate_overall_accuracy(services)
            },
            days: days
          }
        }
      end

      private

      def calculate_overall_accuracy(services)
        total = services.sum { |s| s[:total] }
        return nil if total.zero?

        corrected = services.sum { |s| s[:corrected] || 0 }
        ((total - corrected).to_f / total * 100).round(1)
      end

      def set_config
        @config = AiServiceConfig.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Config not found" }, status: :not_found
      end

      def config_params
        params.require(:ai_service_config).permit(
          :ocr_enabled,
          :ai_threshold,
          :ai_model,
          :ai_always,
          :active
        )
      end

      def serialize_config(config)
        accuracy = AiProcessingLog.accuracy_for(config.service_type, days: 30)

        {
          id: config.id,
          service_type: config.service_type,
          display_name: config.display_name,
          ocr_enabled: config.ocr_enabled?,
          ai_threshold: config.ai_threshold,
          ai_model: config.ai_model,
          ai_always: config.ai_always?,
          active: config.active?,
          accuracy: accuracy[:accuracy],
          total_processed: accuracy[:total],
          correct_count: accuracy[:correct],
          corrected_count: accuracy[:corrected],
          created_at: config.created_at,
          updated_at: config.updated_at
        }
      end

      def serialize_log(log, detailed: false)
        data = {
          id: log.id,
          service_type: log.service_type,
          input_identifier: log.input_identifier,
          final_type: log.final_type,
          final_confidence: log.final_confidence,
          decision_method: log.decision_method,
          user_corrected: log.user_corrected?,
          corrected_to: log.corrected_to,
          corrected_at: log.corrected_at,
          total_duration_ms: log.total_duration_ms,
          created_at: log.created_at
        }

        if detailed
          data.merge!(
            processable_type: log.processable_type,
            processable_id: log.processable_id,
            ocr_result: log.ocr_result,
            pattern_result: log.pattern_result,
            ai_result: log.ai_result,
            ocr_duration_ms: log.ocr_duration_ms,
            ai_duration_ms: log.ai_duration_ms,
            corrected_by: log.corrected_by ? {
              id: log.corrected_by.id,
              name: log.corrected_by.name
            } : nil
          )
        end

        data
      end
    end
  end
end
