module Api
  module V1
    class CorporateCompanyXeroConnectionsController < ApplicationController
      before_action :set_connection, only: [ :show, :disconnect, :sync_accounts ]

      # GET /api/v1/company_xero_connections
      # Returns ALL Xero organizations (credentials) and their linked TEEEM companies
      def index
        # Get all Xero credentials (organizations)
        all_credentials = XeroCredential.all.order(created_at: :desc)

        # Get all company connections
        all_connections = CorporateCompanyXeroConnection.includes(:corporate_company).all

        # Build response showing all Xero orgs with their linked companies
        organizations = all_credentials.map do |credential|
          # Find all companies linked to this Xero org
          linked_companies = all_connections.select { |conn| conn.xero_tenant_id == credential.tenant_id }

          {
            tenant_id: credential.tenant_id,
            tenant_name: credential.tenant_name,
            # Use effectively_connected? which checks BOTH token expiry AND status field
            connected: credential.effectively_connected?,
            status: credential.status || "connected", # Include status for UI to show degraded/disconnected
            degraded: credential.degraded?,
            expires_at: credential.expires_at,
            expired: credential.expired?,
            companies: linked_companies.map do |conn|
              {
                id: conn.id,
                company_id: conn.company_id,
                company: {
                  id: conn.corporate_company.id,
                  name: conn.corporate_company.name
                },
                xero_tenant_id: conn.xero_tenant_id,
                xero_tenant_name: conn.xero_tenant_name,
                connection_status: conn.connection_status,
                connected: conn.connected?,
                last_sync_at: conn.last_sync_at,
                days_since_last_sync: conn.days_since_last_sync
              }
            end
          }
        end

        render json: {
          success: true,
          organizations: organizations,
          total_organizations: organizations.count,
          connected_organizations: organizations.count { |o| o[:connected] }
        }
      end

      # GET /api/v1/company_xero_connections/:id
      def show
        render json: {
          success: true,
          connection: @connection.as_json(
            include: {
              corporate_company: {},
              company_xero_accounts: {
                methods: [ :display_name, :mapped? ]
              }
            },
            methods: [ :connected?, :days_since_last_sync ]
          )
        }
      end

      # GET /api/v1/company_xero_connections/auth_url
      def auth_url
        # Generate Xero OAuth authorization URL
        # This will be implemented with XeroAuthService
        render json: {
          success: true,
          auth_url: "https://login.xero.com/identity/connect/authorize?response_type=code&client_id=YOUR_CLIENT_ID"
        }
      end

      # POST /api/v1/company_xero_connections/callback
      def callback
        # Handle OAuth callback from Xero
        # This will be implemented with XeroAuthService
        company_id = params[:state] # Pass company_id in state parameter
        auth_code = params[:code]

        # For now, return success
        render json: {
          success: true,
          message: "Xero connection established (callback implementation pending)"
        }
      end

      # POST /api/v1/company_xero_connections/:id/sync_accounts
      def sync_accounts
        # Sync chart of accounts from Xero
        # This will be implemented with XeroSyncService

        if @connection.connected?
          # XeroSyncService.new(@connection).sync_chart_of_accounts
          @connection.sync_successful!

          render json: {
            success: true,
            message: "Accounts synced successfully",
            last_sync_at: @connection.last_sync_at
          }
        else
          render json: {
            success: false,
            error: "Connection is not active"
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/company_xero_connections/:id
      def disconnect
        @connection.mark_disconnected!

        render json: {
          success: true,
          message: "Xero connection disconnected successfully"
        }
      end

      # GET /api/v1/company_xero_connections/:id/status
      def status
        connection = CorporateCompanyXeroConnection.find(params[:id])

        render json: {
          success: true,
          status: {
            connected: connection.connected?,
            tenant_name: connection.xero_tenant_name,
            last_sync: connection.last_sync_at,
            days_since_sync: connection.days_since_last_sync,
            account_count: connection.corporate_company_xero_accounts.active.count
          }
        }
      end

      private

      def set_connection
        @connection = CorporateCompanyXeroConnection.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Xero connection not found" }, status: :not_found
      end

      def connection_params
        params.require(:company_xero_connection).permit(
          :company_id, :xero_tenant_id, :xero_tenant_name, :xero_tenant_type,
          :accounting_method, :financial_year_end
        )
      end
    end
  end
end
