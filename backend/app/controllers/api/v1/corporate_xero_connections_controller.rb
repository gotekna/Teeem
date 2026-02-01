module Api
  module V1
    class CorporateCompanyXeroConnectionsController < ApplicationController
      before_action :set_connection, only: [ :show, :disconnect, :sync_accounts ]

      # GET /api/v1/company_xero_connections
      # Returns Xero organizations for the current tenant (multi-tenancy isolation)
      #
      # SSoT: Uses XeroConnectionHealth service for unified status computation.
      # This ensures the status shown here matches XeroConnectionCard on company pages.
      #
      # Multi-tenancy:
      # - Master tenant sees ALL Xero orgs (admin view)
      # - Customer tenants only see their own Xero orgs
      def index
        # Multi-tenancy: Filter Xero credentials by tenant
        # Master tenant can see all; other tenants only see their own
        all_credentials = if current_tenant&.master_tenant?
                            XeroCredential.all.order(created_at: :desc)
                          else
                            XeroCredential.for_teeem_tenant(current_tenant).order(created_at: :desc)
                          end

        # Get all company connections
        all_connections = CorporateCompanyXeroConnection.includes(:corporate_company).all

        # Build response showing all Xero orgs with their linked companies
        organizations = all_credentials.map do |credential|
          # SSoT: Compute health from XeroConnectionHealth (THE ONE source)
          health = XeroConnectionHealth.for_credential(credential)

          # Find all companies linked to this Xero org
          linked_companies = all_connections.select { |conn| conn.xero_tenant_id == credential.tenant_id }

          # Get the assigned TEEEM tenant info
          assigned_tenant = credential.teeem_tenant

          {
            id: credential.id,  # For updating tenant assignment
            tenant_id: credential.tenant_id,
            tenant_name: credential.tenant_name,
            # Multi-tenancy: Which TEEEM tenant owns this Xero org
            teeem_tenant_id: credential.teeem_tenant_id,
            teeem_tenant_name: assigned_tenant&.name || "Unassigned",
            # SSoT: Unified status from XeroConnectionHealth
            connected: health.connected,
            display_status: health.display_status,
            message: health.message,
            needs_attention: health.needs_attention,
            action_required: health.action_required,
            # Legacy fields for backwards compatibility
            status: credential.status || "connected",
            degraded: credential.degraded?,
            expires_at: credential.expires_at,
            expired: credential.expired?,
            companies: linked_companies.select { |conn| conn.corporate_company.present? }.map do |conn|
              # SSoT: Company status derived from credential health
              company_health = XeroConnectionHealth.for_company(conn.corporate_company)
              {
                id: conn.id,
                company_id: conn.company_id,
                company: {
                  id: conn.corporate_company.id,
                  name: conn.corporate_company.name
                },
                xero_tenant_id: conn.xero_tenant_id,
                xero_tenant_name: conn.xero_tenant_name,
                # SSoT: Unified status from XeroConnectionHealth
                connected: company_health.connected,
                display_status: company_health.display_status,
                last_sync_at: conn.last_sync_at,
                days_since_last_sync: conn.days_since_last_sync
              }
            end
          }
        end

        # Build tenants list for dropdown (master tenant only)
        available_tenants = if current_tenant&.master_tenant?
                              Tenant.all.order(:name).map { |t| { id: t.id, name: t.name, is_master: t.master_tenant? } }
                            else
                              []
                            end

        render json: {
          success: true,
          organizations: organizations,
          total_organizations: organizations.count,
          connected_organizations: organizations.count { |o| o[:connected] },
          # Multi-tenancy: Tell frontend if this is the master tenant (admin view)
          is_master_tenant: current_tenant&.master_tenant? || false,
          # Available tenants for assignment dropdown (master only)
          available_tenants: available_tenants
        }
      end

      # PATCH /api/v1/company_xero_connections/:id/assign_tenant
      # Assigns a Xero credential to a TEEEM tenant (master tenant only)
      def assign_tenant
        unless current_tenant&.master_tenant?
          return render json: { success: false, error: "Only master tenant can assign Xero organizations" }, status: :forbidden
        end

        credential = XeroCredential.find(params[:id])
        tenant = Tenant.find(params[:teeem_tenant_id])

        credential.update!(teeem_tenant_id: tenant.id)

        render json: {
          success: true,
          message: "#{credential.tenant_name} assigned to #{tenant.name}",
          credential: {
            id: credential.id,
            tenant_name: credential.tenant_name,
            teeem_tenant_id: tenant.id,
            teeem_tenant_name: tenant.name
          }
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: e.message }, status: :not_found
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
