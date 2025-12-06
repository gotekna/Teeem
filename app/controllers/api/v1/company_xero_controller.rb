module Api
  module V1
    class CompanyXeroController < ApplicationController
      before_action :set_company

      # GET /api/v1/companies/:company_id/xero/status
      # Returns the Xero connection status for this company
      def status
        connection = @company.company_xero_connection

        if connection.nil?
          render json: {
            success: true,
            connected: false,
            message: "Not connected to Xero"
          }
        else
          # Check if tokens need refresh
          if connection.needs_refresh?
            begin
              connection.refresh_tokens!
            rescue StandardError => e
              Rails.logger.error("Failed to refresh Xero tokens for company #{@company.id}: #{e.message}")
            end
          end

          render json: {
            success: true,
            connected: connection.connected?,
            connection_status: connection.connection_status,
            xero_tenant_name: connection.xero_tenant_name,
            xero_tenant_id: connection.xero_tenant_id,
            last_sync_at: connection.last_sync_at,
            last_sync_error: connection.last_sync_error,
            token_expires_at: connection.token_expires_at,
            days_since_sync: connection.days_since_last_sync
          }
        end
      end

      # GET /api/v1/companies/:company_id/xero/authorize
      # Returns the OAuth authorization URL for connecting to Xero
      def authorize
        # Store company_id in session for callback
        session[:xero_company_id] = @company.id

        client = XeroApiClient.new
        auth_url = client.authorization_url_for_company(@company.id)

        render json: {
          success: true,
          authorization_url: auth_url
        }
      rescue XeroApiClient::AuthenticationError => e
        render json: {
          success: false,
          error: e.message
        }, status: :service_unavailable
      end

      # GET /api/v1/companies/:company_id/xero/callback
      # Handles the OAuth callback from Xero
      def callback
        code = params[:code]
        state = params[:state]

        if code.blank?
          return render json: {
            success: false,
            error: "Authorization code not provided"
          }, status: :bad_request
        end

        # Verify state matches company_id
        expected_state = "company_#{@company.id}"
        if state != expected_state
          return render json: {
            success: false,
            error: "Invalid state parameter"
          }, status: :bad_request
        end

        begin
          client = XeroApiClient.new
          result = client.exchange_code_for_company_token(code, @company)

          if result[:success]
            render json: {
              success: true,
              message: "Successfully connected to #{result[:tenant_name]}",
              tenant_name: result[:tenant_name],
              tenant_id: result[:tenant_id]
            }
          else
            render json: {
              success: false,
              error: result[:error] || "Failed to connect to Xero"
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          render json: {
            success: false,
            error: e.message
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("Xero OAuth callback error for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: "Failed to complete Xero authorization"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/companies/:company_id/xero/disconnect
      # Disconnects the company from Xero
      def disconnect
        connection = @company.company_xero_connection

        if connection.nil?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :not_found
        end

        begin
          # Revoke tokens with Xero
          client = XeroApiClient.new
          client.revoke_token(connection.refresh_token) if connection.refresh_token.present?
        rescue StandardError => e
          Rails.logger.warn("Failed to revoke Xero tokens for company #{@company.id}: #{e.message}")
        end

        # Delete the connection
        connection.destroy

        render json: {
          success: true,
          message: "Successfully disconnected from Xero"
        }
      end

      # POST /api/v1/companies/:company_id/xero/sync
      # Triggers a sync with Xero for this company
      def sync
        connection = @company.company_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        # Refresh tokens if needed
        if connection.needs_refresh?
          unless connection.refresh_tokens!
            return render json: {
              success: false,
              error: "Failed to refresh Xero tokens. Please reconnect."
            }, status: :unauthorized
          end
        end

        # TODO: Implement actual sync logic (bank accounts, transactions, etc.)
        # For now, just update last_sync_at
        connection.sync_successful!

        render json: {
          success: true,
          message: "Sync completed successfully",
          last_sync_at: connection.last_sync_at
        }
      end

      # GET /api/v1/companies/:company_id/xero/tenants
      # Returns available Xero tenants for selection (if user has multiple orgs)
      def tenants
        connection = @company.company_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        begin
          client = XeroApiClient.new
          tenants = client.get_tenants_for_connection(connection)

          render json: {
            success: true,
            tenants: tenants,
            current_tenant_id: connection.xero_tenant_id
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/companies/:company_id/xero/bank_accounts
      # Returns Xero bank accounts and their mapping status to local accounts
      def bank_accounts
        connection = @company.company_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        begin
          sync_service = XeroBankSyncService.new(@company)
          result = sync_service.sync_bank_accounts

          if result[:success]
            render json: {
              success: true,
              xero_accounts: result[:xero_accounts],
              local_bank_accounts: @company.bank_accounts.map do |ba|
                {
                  id: ba.id,
                  institution_name: ba.institution_name,
                  account_name: ba.account_name,
                  account_number: ba.masked_account_number,
                  xero_account_id: ba.xero_account_id,
                  linked_to_xero: ba.linked_to_xero?
                }
              end
            }
          else
            render json: result, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("Failed to get bank accounts for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/companies/:company_id/xero/link_bank_account
      # Links a local bank account to a Xero bank account
      def link_bank_account
        connection = @company.company_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        bank_account_id = params[:bank_account_id]
        xero_account_id = params[:xero_account_id]

        if bank_account_id.blank? || xero_account_id.blank?
          return render json: {
            success: false,
            error: "bank_account_id and xero_account_id are required"
          }, status: :bad_request
        end

        begin
          sync_service = XeroBankSyncService.new(@company)
          result = sync_service.link_bank_account(
            bank_account_id: bank_account_id,
            xero_account_id: xero_account_id
          )

          if result[:success]
            render json: {
              success: true,
              message: "Bank account linked successfully",
              bank_account: {
                id: result[:bank_account].id,
                xero_account_id: result[:bank_account].xero_account_id
              }
            }
          else
            render json: result, status: :unprocessable_entity
          end
        rescue StandardError => e
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/companies/:company_id/xero/sync_transactions
      # Syncs bank transactions from Xero
      def sync_transactions
        connection = @company.company_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        begin
          sync_service = XeroBankSyncService.new(@company)

          # Parse optional parameters
          from_date = params[:from_date].present? ? Date.parse(params[:from_date]) : 3.months.ago.to_date
          to_date = params[:to_date].present? ? Date.parse(params[:to_date]) : Date.today
          bank_account_id = params[:bank_account_id]

          result = sync_service.sync_transactions(
            bank_account_id: bank_account_id,
            from_date: from_date,
            to_date: to_date
          )

          render json: {
            success: result[:success],
            accounts_synced: result[:accounts_synced],
            total_transactions_synced: result[:total_transactions_synced],
            created_count: result[:created_count],
            updated_count: result[:updated_count],
            errors: result[:errors]
          }
        rescue StandardError => e
          Rails.logger.error("Failed to sync transactions for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/companies/:company_id/xero/transactions
      # Returns synced bank transactions
      def transactions
        connection = @company.company_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        # Parse filters
        from_date = params[:from_date].present? ? Date.parse(params[:from_date]) : 1.month.ago.to_date
        to_date = params[:to_date].present? ? Date.parse(params[:to_date]) : Date.today
        bank_account_id = params[:bank_account_id]

        transactions = @company.bank_transactions
          .by_date_range(from_date, to_date)
          .includes(:bank_account)
          .order(transaction_date: :desc)

        transactions = transactions.where(bank_account_id: bank_account_id) if bank_account_id.present?

        # Get summary
        sync_service = XeroBankSyncService.new(@company)
        summary = sync_service.transaction_summary(
          bank_account_id: bank_account_id,
          from_date: from_date,
          to_date: to_date
        )

        render json: {
          success: true,
          transactions: transactions.map do |tx|
            {
              id: tx.id,
              transaction_date: tx.transaction_date,
              transaction_type: tx.transaction_type,
              amount: tx.amount,
              signed_amount: tx.signed_amount,
              description: tx.description,
              contact_name: tx.contact_name,
              reference: tx.reference,
              status: tx.status,
              is_reconciled: tx.is_reconciled,
              bank_account_name: tx.bank_account&.display_name
            }
          end,
          summary: summary
        }
      end

      private

      def set_company
        @company = Company.find_by_slug_or_id(params[:company_id])
        unless @company
          render json: { success: false, error: "Company not found" }, status: :not_found
        end
      end
    end
  end
end
