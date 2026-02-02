# frozen_string_literal: true

module Api
  module V1
    class XeroAlertsController < ApplicationController
      # Authentication handled by ApplicationController's authorize_request
      before_action :set_alert, only: [ :dismiss ]

      # GET /api/v1/xero/alerts
      # Get all active alerts for the current user's company
      def index
        company = current_user.corporate

        alerts = XeroAlert.active.recent

        # Filter by company if user belongs to one
        alerts = alerts.for_company(company.id) if company

        render json: {
          success: true,
          alerts: alerts.map { |alert| serialize_alert(alert) },
          summary: {
            total: alerts.count,
            critical: alerts.critical.count,
            warnings: alerts.warnings.count
          }
        }
      end

      # POST /api/v1/xero/alerts/:id/dismiss
      # Dismiss a specific alert
      def dismiss
        @alert.dismiss!(current_user)

        render json: {
          success: true,
          message: "Alert dismissed"
        }
      end

      # GET /api/v1/xero/health
      # Get overall Xero integration health status
      def health
        company = current_user.corporate
        credential = find_credential_for_company(company)

        render json: {
          success: true,
          health: {
            overall_status: calculate_overall_status(credential),
            credential: credential ? serialize_credential_health(credential) : nil,
            sync_status: credential ? sync_status_for_credential(credential) : {},
            alerts: alert_summary_for_company(company),
            summary: XeroTokenManager.health_summary
          }
        }
      end

      # GET /api/v1/xero/rate_limits
      # Get current rate limit usage for all tenants (SSoT: includes credential status)
      def rate_limits
        usage = XeroRateLimitTracker.aggregate_usage

        # Build credential lookup by tenant_id for status info
        credentials_by_tenant = XeroCredential.all.index_by(&:tenant_id)

        # SSoT: Calculate reset time (midnight UTC = 10:00 AM Brisbane)
        # Next reset is: today 10 AM if before 10 AM Brisbane, tomorrow 10 AM if after
        # SSoT: Use TenantSetting for timezone
        now_brisbane = TenantSetting.now
        brisbane_10am_today = now_brisbane.change(hour: 10, min: 0, sec: 0)

        resets_at_display = if now_brisbane < brisbane_10am_today
          "Today 10:00 AM"
        else
          "Tomorrow 10:00 AM"
        end
        brisbane_reset = now_brisbane < brisbane_10am_today ? brisbane_10am_today : brisbane_10am_today + 1.day

        render json: {
          success: true,
          rate_limits: {
            limits: {
              minute: XeroRateLimitTracker::MINUTE_LIMIT,
              daily: XeroRateLimitTracker::DAILY_LIMIT,
              concurrent: XeroRateLimitTracker::CONCURRENT_LIMIT
            },
            # SSoT: Daily rate limit reset time
            resets_at: brisbane_reset.iso8601,
            resets_at_display: resets_at_display,
            tenants: usage[:per_tenant].map do |tenant|
              credential = credentials_by_tenant[tenant[:tenant_id]]
              {
                tenant_id: tenant[:tenant_id],
                tenant_name: tenant[:tenant_name],
                minute: tenant[:usage]&.dig(:minute),
                daily: tenant[:usage]&.dig(:daily),
                total_7d: tenant[:usage]&.dig(:total_7d),
                can_make_request: tenant[:usage]&.dig(:can_make_request),
                # SSoT: Include credential status so UI shows actual token health
                status: credential&.status || "disconnected",
                # Only show "Needs Re-auth" when truly disconnected/degraded, not just close to expiry
                # Token refresh is handled automatically by XeroTokenManager
                needs_reauth: credential ? %w[disconnected degraded].include?(credential.status) : true,
                expired: credential&.expired?,
                degraded: credential&.degraded?
              }
            end,
            aggregate: usage[:aggregate]
          }
        }
      end

      # GET /api/v1/xero/alerts/count
      # Quick endpoint to get alert counts for notification badge
      def count
        company = current_user.corporate

        alerts = XeroAlert.active
        alerts = alerts.for_company(company.id) if company

        critical_count = alerts.critical.count
        warning_count = alerts.warnings.count

        render json: {
          success: true,
          counts: {
            critical: critical_count,
            warning: warning_count,
            total: critical_count + warning_count
          },
          has_critical: critical_count > 0,
          has_warnings: warning_count > 0
        }
      end

      private

      def set_alert
        @alert = XeroAlert.find(params[:id])

        # Ensure user can access this alert
        company = current_user.corporate
        if company && @alert.corporate_id && @alert.corporate_id != company.id
          render json: { success: false, error: "Not authorized" }, status: :forbidden
        end
      end

      def find_credential_for_company(company)
        return XeroCredential.current unless company

        # Try to find via connection
        connection = company.corporate_xero_connection
        connection&.xero_credential || XeroCredential.current
      end

      def calculate_overall_status(credential)
        return :disconnected unless credential
        return :disconnected if credential.status == "disconnected"
        return :degraded if credential.status == "degraded"
        return :warning if credential.circuit_open?
        return :warning if credential.needs_refresh?
        :healthy
      end

      def serialize_alert(alert)
        {
          id: alert.id,
          type: alert.alert_type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          icon: alert.icon,
          color: alert.severity_color,
          created_at: alert.created_at.iso8601,
          credential: alert.xero_credential ? {
            id: alert.xero_credential.id,
            tenant_name: alert.xero_credential.tenant_name
          } : nil
        }
      end

      def serialize_credential_health(credential)
        {
          id: credential.id,
          tenant_name: credential.tenant_name,
          status: credential.status,
          health_status: credential.health_status,
          circuit_state: credential.circuit_state,
          expires_at: credential.expires_at&.iso8601,
          needs_refresh: credential.needs_refresh?,
          last_successful_api_call: credential.last_successful_api_call_at&.iso8601,
          days_since_api_call: credential.days_since_last_api_call,
          at_risk_of_expiry: credential.at_risk_of_inactivity_expiry?,
          refresh_failure_count: credential.refresh_failure_count,
          last_refresh_error: credential.last_refresh_error
        }
      end

      def sync_status_for_credential(credential)
        %w[invoices contacts bank_transactions attachments].each_with_object({}) do |sync_type, result|
          health = XeroSyncEvent.health_for_type(
            sync_type: sync_type,
            credential: credential,
            expected_interval: expected_interval_for(sync_type)
          )

          last_event = XeroSyncEvent.last_successful(sync_type: sync_type, credential: credential)

          result[sync_type] = {
            status: health[:status],
            last_sync: health[:last_run]&.iso8601,
            message: health[:message],
            records_synced: last_event&.records_processed
          }
        end
      end

      def expected_interval_for(sync_type)
        case sync_type
        when "invoices", "contacts" then 1.hour
        when "bank_transactions" then 8.hours
        when "attachments" then 4.hours
        else 2.hours
        end
      end

      def alert_summary_for_company(company)
        alerts = XeroAlert.active
        alerts = alerts.for_company(company.id) if company

        {
          total: alerts.count,
          by_severity: alerts.group(:severity).count,
          by_type: alerts.group(:alert_type).count
        }
      end
    end
  end
end
