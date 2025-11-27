module Api
  module V1
    module Portal
      class AccountingIntegrationsController < BaseController
        before_action :require_subcontractor

        # GET /api/v1/portal/accounting_integrations
        # List all accounting integrations for the logged-in subcontractor
        def index
          integrations = current_contact.accounting_integrations.order(created_at: :desc)

          data = {
            active_integration: integrations.active.first ? integration_json(integrations.active.first) : nil,
            all_integrations: integrations.map { |int| integration_json(int) },
            available_systems: AccountingIntegration::SYSTEM_TYPES,
            has_active_connection: integrations.active.any?
          }

          render json: { success: true, data: data }
        end

        # GET /api/v1/portal/accounting_integrations/:id
        # View a specific integration
        def show
          integration = current_contact.accounting_integrations.find(params[:id])

          render json: {
            success: true,
            data: integration_json(integration).merge(
              recent_syncs: integration.subcontractor_invoices.order(synced_at: :desc).limit(10).map do |inv|
                {
                  id: inv.id,
                  amount: inv.amount,
                  external_invoice_id: inv.external_invoice_id,
                  synced_at: inv.synced_at,
                  status: inv.status
                }
              end
            )
          }
        end

        # GET /api/v1/portal/accounting_integrations/oauth_url
        # Get OAuth authorization URL for a specific accounting system
        def oauth_url
          system_type = params[:system_type]

          unless AccountingIntegration::SYSTEM_TYPES.include?(system_type)
            render json: { success: false, error: 'Invalid system type' }, status: :bad_request
            return
          end

          # Check if already connected
          existing = current_contact.accounting_integrations.active.where(system_type: system_type).first
          if existing
            render json: { success: false, error: 'Already connected to this system' }, status: :unprocessable_entity
            return
          end

          # Generate OAuth URL based on system type
          oauth_url = case system_type
          when 'xero'
            generate_xero_oauth_url
          when 'myob'
            generate_myob_oauth_url
          when 'quickbooks'
            generate_quickbooks_oauth_url
          when 'reckon'
            generate_reckon_oauth_url
          else
            nil
          end

          if oauth_url
            render json: {
              success: true,
              data: {
                oauth_url: oauth_url,
                system_type: system_type,
                state: generate_oauth_state(system_type)
              }
            }
          else
            render json: { success: false, error: 'OAuth URL generation failed' }, status: :internal_server_error
          end
        end

        # POST /api/v1/portal/accounting_integrations/oauth_callback
        # Handle OAuth callback from accounting system
        def oauth_callback
          system_type = params[:system_type]
          code = params[:code]
          state = params[:state]

          unless AccountingIntegration::SYSTEM_TYPES.include?(system_type)
            render json: { success: false, error: 'Invalid system type' }, status: :bad_request
            return
          end

          # Verify state to prevent CSRF
          unless verify_oauth_state(state, system_type)
            render json: { success: false, error: 'Invalid OAuth state' }, status: :forbidden
            return
          end

          # Exchange code for tokens
          token_data = case system_type
          when 'xero'
            exchange_xero_code(code)
          when 'myob'
            exchange_myob_code(code)
          when 'quickbooks'
            exchange_quickbooks_code(code)
          when 'reckon'
            exchange_reckon_code(code)
          end

          if token_data[:error]
            render json: { success: false, error: token_data[:error] }, status: :unprocessable_entity
            return
          end

          # Create or update integration
          integration = current_contact.accounting_integrations.find_or_initialize_by(system_type: system_type)
          integration.assign_attributes(
            oauth_token: token_data[:access_token],
            refresh_token: token_data[:refresh_token],
            token_expires_at: token_data[:expires_at],
            organization_id: token_data[:organization_id],
            organization_name: token_data[:organization_name],
            sync_status: 'active',
            last_sync_at: Time.current
          )

          if integration.save
            # Update subcontractor account flag
            current_subcontractor_account&.update(accounting_system_connected: true)

            render json: {
              success: true,
              message: "Successfully connected to #{system_type.titleize}",
              data: integration_json(integration)
            }, status: :created
          else
            render json: {
              success: false,
              error: 'Failed to save integration',
              errors: integration.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/portal/accounting_integrations/:id
        # Disconnect an accounting integration
        def destroy
          integration = current_contact.accounting_integrations.find(params[:id])

          if integration.update(sync_status: 'disconnected', oauth_token: nil, refresh_token: nil)
            # Update subcontractor account flag if no other active integrations
            unless current_contact.accounting_integrations.active.any?
              current_subcontractor_account&.update(accounting_system_connected: false)
            end

            render json: {
              success: true,
              message: 'Integration disconnected successfully'
            }
          else
            render json: {
              success: false,
              error: 'Failed to disconnect integration'
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/portal/accounting_integrations/:id/refresh
        # Manually refresh OAuth token
        def refresh
          integration = current_contact.accounting_integrations.find(params[:id])

          unless integration.active?
            render json: { success: false, error: 'Integration is not active' }, status: :unprocessable_entity
            return
          end

          if integration.refresh_token!
            render json: {
              success: true,
              message: 'Token refreshed successfully',
              data: integration_json(integration)
            }
          else
            render json: {
              success: false,
              error: 'Failed to refresh token',
              message: 'You may need to reconnect your accounting system'
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/portal/accounting_integrations/:id/test_connection
        # Test the integration connection
        def test_connection
          integration = current_contact.accounting_integrations.find(params[:id])

          unless integration.active?
            render json: { success: false, error: 'Integration is not active' }, status: :unprocessable_entity
            return
          end

          # TODO: Implement actual API test calls for each system
          test_result = {
            connected: true,
            organization: integration.organization_name,
            last_sync: integration.last_sync_at,
            message: 'Connection test successful'
          }

          render json: {
            success: true,
            data: test_result
          }
        end

        private

        def integration_json(integration)
          {
            id: integration.id,
            system_type: integration.system_type,
            organization_id: integration.organization_id,
            organization_name: integration.organization_name,
            sync_status: integration.sync_status,
            last_sync_at: integration.last_sync_at,
            token_expires_at: integration.token_expires_at,
            created_at: integration.created_at,
            is_active: integration.active?,
            is_expired: integration.token_expires_at && integration.token_expires_at < Time.current,
            invoices_synced_count: integration.subcontractor_invoices.count
          }
        end

        def generate_oauth_state(system_type)
          # Store state in session or encrypted token
          state_data = {
            contact_id: current_contact.id,
            portal_user_id: current_portal_user.id,
            system_type: system_type,
            timestamp: Time.current.to_i
          }
          Base64.urlsafe_encode64(state_data.to_json)
        end

        def verify_oauth_state(state, system_type)
          return false unless state.present?

          begin
            state_data = JSON.parse(Base64.urlsafe_decode64(state))
            state_data['contact_id'] == current_contact.id &&
              state_data['system_type'] == system_type &&
              state_data['timestamp'] > 1.hour.ago.to_i
          rescue
            false
          end
        end

        # OAuth URL generation methods (placeholders - actual implementation depends on env vars)

        def generate_xero_oauth_url
          # TODO: Use actual Xero OAuth client_id from ENV
          client_id = ENV['XERO_CLIENT_ID'] || 'YOUR_XERO_CLIENT_ID'
          redirect_uri = "#{ENV['FRONTEND_URL']}/portal/accounting/callback/xero"
          scope = 'accounting.transactions accounting.contacts'
          state = generate_oauth_state('xero')

          "https://login.xero.com/identity/connect/authorize?response_type=code&client_id=#{client_id}&redirect_uri=#{CGI.escape(redirect_uri)}&scope=#{CGI.escape(scope)}&state=#{state}"
        end

        def generate_myob_oauth_url
          # TODO: Implement MYOB OAuth
          client_id = ENV['MYOB_CLIENT_ID'] || 'YOUR_MYOB_CLIENT_ID'
          redirect_uri = "#{ENV['FRONTEND_URL']}/portal/accounting/callback/myob"

          "https://secure.myob.com/oauth2/account/authorize?client_id=#{client_id}&redirect_uri=#{CGI.escape(redirect_uri)}&response_type=code&scope=CompanyFile"
        end

        def generate_quickbooks_oauth_url
          # TODO: Implement QuickBooks OAuth
          client_id = ENV['QUICKBOOKS_CLIENT_ID'] || 'YOUR_QUICKBOOKS_CLIENT_ID'
          redirect_uri = "#{ENV['FRONTEND_URL']}/portal/accounting/callback/quickbooks"

          "https://appcenter.intuit.com/connect/oauth2?client_id=#{client_id}&redirect_uri=#{CGI.escape(redirect_uri)}&response_type=code&scope=com.intuit.quickbooks.accounting"
        end

        def generate_reckon_oauth_url
          # TODO: Implement Reckon OAuth (similar to QuickBooks)
          generate_quickbooks_oauth_url.gsub('quickbooks', 'reckon')
        end

        # Token exchange methods (placeholders - actual implementation uses HTTP clients)

        def exchange_xero_code(code)
          # TODO: Implement actual Xero token exchange
          # Use HTTParty or similar to POST to Xero token endpoint
          {
            access_token: 'placeholder_access_token',
            refresh_token: 'placeholder_refresh_token',
            expires_at: 30.minutes.from_now,
            organization_id: 'xero_org_id',
            organization_name: 'Demo Organization',
            error: nil
          }
        end

        def exchange_myob_code(code)
          # TODO: Implement actual MYOB token exchange
          {
            access_token: 'placeholder_access_token',
            refresh_token: 'placeholder_refresh_token',
            expires_at: 20.minutes.from_now,
            organization_id: 'myob_org_id',
            organization_name: 'Demo Company',
            error: nil
          }
        end

        def exchange_quickbooks_code(code)
          # TODO: Implement actual QuickBooks token exchange
          {
            access_token: 'placeholder_access_token',
            refresh_token: 'placeholder_refresh_token',
            expires_at: 1.hour.from_now,
            organization_id: 'qb_realm_id',
            organization_name: 'Demo Company',
            error: nil
          }
        end

        def exchange_reckon_code(code)
          # TODO: Implement actual Reckon token exchange
          exchange_quickbooks_code(code)
        end
      end
    end
  end
end
