module Api
  module V1
    class XeroHealthController < ApplicationController
      # GET /api/v1/xero/health
      # Returns current health status of all Xero connections
      def index
        credentials_health = XeroConnectionHealth.all_credentials_health

        render json: {
          success: true,
          overall_status: overall_status(credentials_health),
          total_credentials: credentials_health.count,
          connected_count: credentials_health.count { |c| c[:health].connected },
          needs_attention_count: credentials_health.count { |c| c[:health].needs_attention },
          credentials: credentials_health.map do |c|
            {
              id: c[:credential_id],
              **c[:health].to_json_hash
            }
          end
        }
      end

      # GET /api/v1/xero/health/events
      # Returns recent health events for debugging
      def events
        events = XeroHealthEvent.recent.limit(100).includes(:xero_credential)

        render json: {
          success: true,
          events: events.map do |event|
            {
              id: event.id,
              event_type: event.event_type,
              from_status: event.from_status,
              to_status: event.to_status,
              trigger: event.trigger,
              message: event.message,
              tenant_name: event.xero_credential&.tenant_name,
              created_at: event.created_at.iso8601,
              metadata: event.metadata
            }
          end
        }
      end

      # GET /api/v1/xero/health/analytics
      # Returns health analytics
      def analytics
        render json: {
          success: true,
          analytics: {
            failure_rate_24h: XeroHealthEvent.failure_rate_last_24h,
            mean_time_to_recovery: XeroHealthEvent.mean_time_to_recovery,
            events_last_24h: XeroHealthEvent.in_last(24.hours).count,
            status_changes_last_24h: XeroHealthEvent.status_changes.in_last(24.hours).count,
            failures_last_24h: XeroHealthEvent.failures.in_last(24.hours).count,
            recoveries_last_24h: XeroHealthEvent.recoveries.in_last(24.hours).count
          }
        }
      end

      # POST /api/v1/xero/health/check
      # Triggers a health check and returns results
      def check
        results = XeroConnectionHealth.run_health_check

        render json: {
          success: true,
          message: "Health check completed",
          results: results
        }
      end

      # ============================================
      # PHASE 5: PREDICTIVE HEALTH ENDPOINTS
      # ============================================

      # GET /api/v1/xero/health/predictions
      # Returns predictive health analysis
      def predictions
        credentials_with_risk = XeroCredential.all.map do |credential|
          {
            id: credential.id,
            tenant_name: credential.tenant_name,
            risk_score: XeroHealthEvent.risk_score_for(credential),
            health_score: 100 - XeroHealthEvent.risk_score_for(credential)
          }
        end.sort_by { |c| -c[:risk_score] }

        render json: {
          success: true,
          predictions: {
            credentials: credentials_with_risk,
            high_risk_count: credentials_with_risk.count { |c| c[:risk_score] >= 70 },
            elevated_risk_count: credentials_with_risk.count { |c| c[:risk_score] >= 40 && c[:risk_score] < 70 },
            healthy_count: credentials_with_risk.count { |c| c[:risk_score] < 40 }
          }
        }
      end

      # GET /api/v1/xero/health/warnings
      # Returns early warnings for potential issues
      def warnings
        warnings = XeroHealthEvent.early_warnings

        render json: {
          success: true,
          warnings: warnings,
          critical_count: warnings.count { |w| w[:severity] == "critical" },
          warning_count: warnings.count { |w| w[:severity] == "warning" }
        }
      end

      # GET /api/v1/xero/health/patterns
      # Returns failure patterns analysis
      def patterns
        credential = params[:credential_id].present? ? XeroCredential.find_by(id: params[:credential_id]) : nil

        render json: {
          success: true,
          patterns: XeroHealthEvent.failure_patterns(credential),
          scope: credential ? credential.tenant_name : "all_credentials"
        }
      end

      # GET /api/v1/xero/health/trends
      # Returns trend analysis
      def trends
        render json: {
          success: true,
          trends: XeroHealthEvent.trend_analysis
        }
      end

      private

      def overall_status(credentials_health)
        return "disconnected" if credentials_health.empty?
        return "disconnected" if credentials_health.none? { |c| c[:health].connected }
        return "warning" if credentials_health.any? { |c| c[:health].needs_attention }
        "connected"
      end
    end
  end
end
