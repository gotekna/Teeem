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
