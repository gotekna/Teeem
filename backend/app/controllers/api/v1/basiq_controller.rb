module Api
  module V1
    # BasiqController - API endpoints for Basiq Open Banking integration
    #
    # Endpoints:
    #   GET  /api/v1/basiq/status       - Check connection status
    #   POST /api/v1/basiq/connect      - Initiate bank connection
    #   GET  /api/v1/basiq/callback     - OAuth callback from Basiq consent UI
    #   POST /api/v1/basiq/disconnect   - Disconnect bank feed
    #   GET  /api/v1/basiq/accounts     - List connected bank accounts
    #   GET  /api/v1/basiq/transactions - List transactions
    #   POST /api/v1/basiq/sync         - Trigger manual sync
    #
    class BasiqController < ApplicationController
      before_action :require_organization, except: [:callback, :webhook]
      # Note: API-only app doesn't have CSRF protection enabled

      # GET /api/v1/basiq/status
      # Check Basiq connection status for current organization
      def status
        credential = BasiqCredential.for_org(current_organization)

        if credential.nil?
          render json: {
            success: true,
            data: {
              connected: false,
              status: "not_configured",
              message: "Bank feed not configured"
            }
          }
        else
          render json: {
            success: true,
            data: {
              connected: credential.connected?,
              status: credential.status,
              institution_name: credential.connected_institution_name,
              last_sync_at: credential.last_sync_at,
              consent_expires_at: credential.consent_expires_at,
              last_error: credential.last_error
            }
          }
        end
      end

      # POST /api/v1/basiq/connect
      # Initiate a new bank connection - returns consent URL
      def connect
        result = BasiqCredential.create_for_org(current_organization)

        if result[:success]
          render json: {
            success: true,
            data: {
              consent_url: result[:consent_url],
              consent_id: result[:consent_id],
              message: "Redirect user to consent_url to connect their bank"
            }
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/basiq/callback
      # Callback after user completes Basiq consent UI
      # Basiq redirects here with connection status
      def callback
        # Basiq sends job_id in the callback
        job_id = params[:job_id]
        user_id = params[:user_id]

        if job_id.present?
          # Check job status to get connection result
          client = BasiqClient.new
          job_result = client.get_job(job_id)

          if job_result[:success]
            # Find credential by user_id
            credential = BasiqCredential.find_by(basiq_user_id: user_id)

            if credential
              job_data = job_result[:data]
              steps = job_data["steps"] || []

              # Check if connection was successful
              connection_step = steps.find { |s| s["title"] == "retrieve-accounts" }

              if connection_step && connection_step["status"] == "success"
                # Get connection details
                connections = client.list_connections(user_id)
                if connections[:success] && connections[:connections].any?
                  conn = connections[:connections].first
                  credential.mark_connected!(
                    institution_name: conn.dig(:institution, :name),
                    institution_id: conn.dig(:institution, :id)
                  )
                else
                  credential.mark_connected!
                end
              else
                error_step = steps.find { |s| s["status"] == "failed" }
                credential.mark_error!(error_step&.dig("result", "detail") || "Connection failed")
              end
            end
          end
        end

        # Redirect to frontend bank feeds page
        frontend_url = ENV["FRONTEND_URL"] || "https://teeem.vercel.app"
        redirect_to "#{frontend_url}/financial?tab=bank-feeds&connection=complete", allow_other_host: true
      end

      # POST /api/v1/basiq/disconnect
      # Disconnect bank feed
      def disconnect
        credential = BasiqCredential.for_org(current_organization)

        if credential.nil?
          render json: { success: false, error: "No bank feed connected" }, status: :not_found
          return
        end

        result = credential.revoke!

        if result[:success]
          render json: {
            success: true,
            message: "Bank feed disconnected"
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/basiq/accounts
      # List connected bank accounts
      def accounts
        credential = BasiqCredential.for_org(current_organization)

        unless credential&.connected?
          render json: { success: false, error: "Bank feed not connected" }, status: :not_found
          return
        end

        result = credential.fetch_accounts

        if result[:success]
          render json: {
            success: true,
            data: result[:accounts]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/basiq/transactions
      # List transactions from connected bank
      def transactions
        credential = BasiqCredential.for_org(current_organization)

        unless credential&.connected?
          render json: { success: false, error: "Bank feed not connected" }, status: :not_found
          return
        end

        options = {}
        options[:account_id] = params[:account_id] if params[:account_id].present?
        options[:from] = Date.parse(params[:from]) if params[:from].present?
        options[:to] = Date.parse(params[:to]) if params[:to].present?
        options[:limit] = params[:limit].to_i if params[:limit].present?

        result = credential.fetch_transactions(options)

        if result[:success]
          render json: {
            success: true,
            data: result[:transactions],
            meta: {
              count: result[:count],
              has_more: result[:has_more]
            }
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/basiq/sync
      # Trigger manual sync of bank data
      def sync
        credential = BasiqCredential.for_org(current_organization)

        unless credential&.connected?
          render json: { success: false, error: "Bank feed not connected" }, status: :not_found
          return
        end

        result = credential.refresh_connections

        if result[:success]
          render json: {
            success: true,
            message: "Bank data sync triggered",
            refreshed: result[:refreshed]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/basiq/webhook
      # Webhook endpoint for Basiq events
      def webhook
        # Verify webhook signature if configured
        # For now, just log the event
        Rails.logger.info("[Basiq Webhook] Received: #{params.to_json}")

        event_type = params[:type]
        data = params[:data]

        case event_type
        when "connection.created", "connection.updated"
          handle_connection_event(data)
        when "transaction.created"
          handle_transaction_event(data)
        end

        render json: { success: true }
      end

      # GET /api/v1/basiq/institutions
      # List supported financial institutions
      def institutions
        client = BasiqClient.new
        result = client.list_institutions

        if result[:success]
          render json: {
            success: true,
            data: result[:institutions]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/basiq/test
      # Test Basiq API connection
      def test
        client = BasiqClient.new
        result = client.test_connection

        render json: {
          success: result[:success],
          data: result
        }
      end

      private

      def require_organization
        unless current_organization
          render json: { success: false, error: "Organization required" }, status: :unauthorized
        end
      end

      def current_organization
        # For now, use the first organization (single-tenant mode)
        # TODO: When multi-org support is needed, add organization_id param or user association
        @current_organization ||= Organization.first
      end

      def handle_connection_event(data)
        user_id = data&.dig("links", "user")&.split("/")&.last
        return unless user_id

        credential = BasiqCredential.find_by(basiq_user_id: user_id)
        return unless credential

        status = data["status"]
        institution = data.dig("institution", "shortName") || data.dig("institution", "name")

        if status == "active"
          credential.mark_connected!(
            institution_name: institution,
            institution_id: data.dig("institution", "id")
          )
        elsif status == "inactive" || status == "expired"
          credential.disconnect!
        end
      end

      def handle_transaction_event(data)
        # Could trigger transaction import here
        Rails.logger.info("[Basiq] New transaction: #{data['id']}")
      end
    end
  end
end
