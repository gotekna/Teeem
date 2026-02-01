module Api
  module V1
    class CorporateXeroController < ApplicationController
      before_action :set_company

      # GET /api/v1/companies/:company_id/xero/status
      # Returns the Xero connection status for this company
      #
      # SSoT: Uses XeroConnectionHealth service for unified status computation.
      # This ensures the status shown here matches XeroConnectionsPopup.
      def status
        # SSoT: Compute health from XeroConnectionHealth (THE ONE source)
        health = XeroConnectionHealth.for_company(@company)

        # Attempt token refresh if needed (self-healing)
        connection = @company.corporate_xero_connection
        if connection&.xero_credential&.needs_refresh?
          begin
            connection.refresh_tokens!
            # Re-compute health after refresh
            health = XeroConnectionHealth.for_company(@company)
          rescue StandardError => e
            Rails.logger.error("Failed to refresh Xero tokens for company #{@company.id}: #{e.message}")
          end
        end

        render json: {
          success: true,
          # SSoT: Unified health status from XeroConnectionHealth
          **health.to_json_hash
        }
      end

      # GET /api/v1/companies/:company_id/xero/connection
      # Returns the Xero connection details (tenant_id) for this company
      # Used by XeroAccountsCard, XeroInvoicesCard, XeroBillsCard for syncing
      def connection
        conn = @company.corporate_xero_connection

        if conn
          render json: {
            success: true,
            connection: {
              xero_tenant_id: conn.xero_tenant_id,
              xero_tenant_name: conn.xero_tenant_name,
              connected: true
            }
          }
        else
          render json: {
            success: false,
            error: "No Xero connection for this company"
          }, status: :not_found
        end
      end

      # GET /api/v1/companies/:company_id/xero/setup_status
      # Returns the setup wizard status for this company's Xero integration
      # Used by XeroSetupWizard component to track progress
      def setup_status
        connection = @company.corporate_xero_connection
        connected = connection&.connected? || false

        # Count accounts (from Xero API if connected)
        accounts_count = 0
        accounts_imported = false
        if connected
          begin
            client = XeroApiClient.new
            result = client.get("Accounts", tenant_id: connection.xero_tenant_id, access_token: connection.access_token)
            if result[:success]
              accounts = (result[:data]["Accounts"] || []).reject { |a| a["SystemAccount"].present? }
              accounts_count = accounts.count
              accounts_imported = accounts_count > 0
            end
          rescue StandardError => e
            Rails.logger.warn("Failed to check accounts for setup_status: #{e.message}")
          end
        end

        # Count bank accounts (from local DB)
        bank_accounts = @company.bank_accounts.where.not(xero_account_id: nil)
        bank_accounts_count = bank_accounts.count
        bank_accounts_linked = bank_accounts_count > 0

        # Count Xero-linked contacts (from contact_external_links)
        contacts_count = ContactExternalLink.joins(:contact)
          .where(source: "xero", sync_enabled: true)
          .where(tenant_id: connection&.xero_tenant_id)
          .count
        contacts_synced = contacts_count > 0

        # Determine if setup is complete (all major items configured)
        setup_complete = connected && accounts_imported && bank_accounts_linked

        render json: {
          success: true,
          data: {
            connected: connected,
            accounts_imported: accounts_imported,
            accounts_count: accounts_count,
            bank_accounts_linked: bank_accounts_linked,
            bank_accounts_count: bank_accounts_count,
            contacts_synced: contacts_synced,
            contacts_count: contacts_count,
            setup_complete: setup_complete
          }
        }
      end

      # POST /api/v1/companies/:company_id/xero/link
      # Links this company to an existing Xero credential by tenant_id
      def link
        tenant_id = params[:tenant_id]

        if tenant_id.blank?
          render json: { success: false, error: "tenant_id is required" }, status: :bad_request
          return
        end

        # Find the credential for this tenant
        credential = XeroCredential.find_by(tenant_id: tenant_id)

        if credential.nil?
          render json: { success: false, error: "Xero organization not found. Please authorize with Xero first." }, status: :not_found
          return
        end

        # Check if this company already has a Xero connection
        connection = @company.corporate_xero_connection

        if connection.present?
          render json: { success: false, error: "This company is already linked to #{connection.xero_tenant_name}" }, status: :unprocessable_entity
          return
        end

        # Create the connection
        connection = @company.build_corporate_xero_connection
        connection.assign_attributes(
          xero_credential_id: credential.id,
          xero_tenant_id: credential.tenant_id,
          xero_tenant_name: credential.tenant_name
        )

        if connection.save
          Rails.logger.info("Linked company #{@company.id} (#{@company.name}) to Xero org #{credential.tenant_name}")
          render json: {
            success: true,
            message: "Successfully linked company to #{credential.tenant_name}",
            connection: connection.as_json(
              methods: [ :connected? ]
            )
          }
        else
          render json: { success: false, error: connection.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/companies/:company_id/xero/authorize
      # Returns the OAuth authorization URL for connecting to Xero
      # Uses Origin header to determine redirect_uri for multi-environment support
      def authorize
        Rails.logger.info("[Xero Authorize] Company #{@company.id} (#{@company.name}) requesting authorization URL")

        # Build redirect_uri from Origin header if whitelisted
        origin = request.headers["Origin"]
        redirect_uri = XeroApiClient.redirect_uri_for_origin(origin)

        Rails.logger.info("[Xero Authorize] Origin: #{origin}, redirect_uri: #{redirect_uri || 'using default'}")

        # Note: company_id is passed via state parameter in OAuth flow, not session
        client = XeroApiClient.new(redirect_uri: redirect_uri)
        auth_url = client.authorization_url_for_company(@company.id)

        Rails.logger.info("[Xero Authorize] Generated auth URL for company #{@company.id}: #{auth_url[0..100]}...")

        render json: {
          success: true,
          authorization_url: auth_url
        }
      rescue XeroApiClient::AuthenticationError => e
        Rails.logger.error("[Xero Authorize] Authentication error for company #{@company.id}: #{e.message}")
        render json: {
          success: false,
          error: e.message
        }, status: :service_unavailable
      rescue StandardError => e
        Rails.logger.error("[Xero Authorize] Unexpected error for company #{@company.id}: #{e.message}")
        Rails.logger.error(e.backtrace.first(5).join("\n"))
        render json: {
          success: false,
          error: "Failed to generate authorization URL: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/companies/:company_id/xero/callback
      # Handles the OAuth callback from Xero
      def callback
        code = params[:code]
        state = params[:state]

        Rails.logger.info("[Xero Callback] Company #{@company.id} - Received callback with code=#{code.present? ? 'present' : 'missing'}, state=#{state}")

        if code.blank?
          Rails.logger.warn("[Xero Callback] Company #{@company.id} - Missing authorization code")
          return render json: {
            success: false,
            error: "Authorization code not provided"
          }, status: :bad_request
        end

        # Verify state matches company_id
        expected_state = "company_#{@company.id}"
        if state != expected_state
          Rails.logger.warn("[Xero Callback] Company #{@company.id} - State mismatch. Expected: #{expected_state}, Got: #{state}")
          return render json: {
            success: false,
            error: "Invalid state parameter"
          }, status: :bad_request
        end

        begin
          Rails.logger.info("[Xero Callback] Company #{@company.id} - Exchanging code for tokens...")
          client = XeroApiClient.new
          result = client.exchange_code_for_company_token(code, @company)

          if result[:success]
            Rails.logger.info("[Xero Callback] Company #{@company.id} - Successfully connected to #{result[:tenant_name]}")
            render json: {
              success: true,
              message: "Successfully connected to #{result[:tenant_name]}",
              tenant_name: result[:tenant_name],
              tenant_id: result[:tenant_id]
            }
          else
            Rails.logger.error("[Xero Callback] Company #{@company.id} - Token exchange failed: #{result[:error]}")
            render json: {
              success: false,
              error: result[:error] || "Failed to connect to Xero"
            }, status: :unprocessable_entity
          end
        rescue XeroApiClient::AuthenticationError => e
          Rails.logger.error("[Xero Callback] Company #{@company.id} - Authentication error: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error("[Xero Callback] Company #{@company.id} - Unexpected error: #{e.message}")
          Rails.logger.error(e.backtrace.first(10).join("\n"))
          render json: {
            success: false,
            error: "Failed to complete Xero authorization: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/companies/:company_id/xero/disconnect
      # Disconnects the company from Xero
      def disconnect
        connection = @company.corporate_xero_connection

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
        connection = @company.corporate_xero_connection

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

        begin
          # Sync bank accounts first (auto-creates if needed)
          sync_service = XeroBankSyncService.new(@company)
          bank_result = sync_service.sync_bank_accounts(auto_create: true)

          # Then sync transactions for last 3 months
          tx_result = sync_service.sync_transactions(
            from_date: 3.months.ago.to_date,
            to_date: Date.today
          )

          if bank_result[:success] && tx_result[:success]
            connection.sync_successful!
            render json: {
              success: true,
              message: "Sync completed successfully",
              last_sync_at: connection.last_sync_at,
              bank_accounts_synced: bank_result[:auto_created_count] || 0,
              transactions_synced: tx_result[:total_transactions_synced] || 0
            }
          else
            error_messages = []
            error_messages << bank_result[:error] if bank_result[:error].present?
            error_messages << tx_result[:errors]&.join(", ") if tx_result[:errors].present?
            error_msg = error_messages.compact.join("; ")

            connection.mark_error!(error_msg) if error_msg.present?
            render json: {
              success: false,
              error: error_msg.presence || "Sync completed with issues"
            }, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("Xero sync error for company #{@company.id}: #{e.message}")
          connection.mark_error!(e.message)
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/companies/:company_id/xero/tenants
      # Returns available Xero tenants for selection (if user has multiple orgs)
      def tenants
        connection = @company.corporate_xero_connection

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
        connection = @company.corporate_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        begin
          sync_service = XeroBankSyncService.new(@company)
          # SSoT: Auto-create bank accounts from Xero
          result = sync_service.sync_bank_accounts(auto_create: true)

          if result[:success]
            # Reload bank accounts to get any newly created ones
            @company.bank_accounts.reload

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
              end,
              # SSoT: Include auto-create stats
              auto_created_count: result[:auto_created_count],
              auto_linked_count: result[:auto_linked_count]
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
        connection = @company.corporate_xero_connection

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
        connection = @company.corporate_xero_connection

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
        connection = @company.corporate_xero_connection

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

      # GET /api/v1/companies/:company_id/xero/accounts
      # Returns Chart of Accounts from Xero for this company
      def accounts
        connection = @company.corporate_xero_connection

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

        begin
          client = XeroApiClient.new
          result = client.get("Accounts", tenant_id: connection.xero_tenant_id, access_token: connection.access_token)

          unless result[:success]
            return render json: {
              success: false,
              error: result[:error] || "Failed to fetch accounts from Xero"
            }, status: :unprocessable_entity
          end

          xero_accounts = result[:data]["Accounts"] || []

          # Group by type and format for display
          formatted_accounts = xero_accounts.map do |acc|
            {
              account_id: acc["AccountID"],
              code: acc["Code"],
              name: acc["Name"],
              type: acc["Type"],
              class: acc["Class"],
              status: acc["Status"],
              tax_type: acc["TaxType"],
              description: acc["Description"],
              bank_account_number: acc["BankAccountNumber"],
              currency_code: acc["CurrencyCode"],
              reporting_code: acc["ReportingCode"],
              reporting_code_name: acc["ReportingCodeName"],
              system_account: acc["SystemAccount"],
              enable_payments: acc["EnablePaymentsToAccount"],
              show_in_expense_claims: acc["ShowInExpenseClaims"]
            }
          end.reject { |a| a[:system_account].present? } # Exclude system accounts

          # Summary by type
          type_summary = formatted_accounts.group_by { |a| a[:type] }.transform_values(&:count)

          render json: {
            success: true,
            company: {
              id: @company.id,
              name: @company.name,
              xero_tenant_name: connection.xero_tenant_name
            },
            accounts: formatted_accounts.sort_by { |a| a[:code].to_s },
            summary: {
              total: formatted_accounts.count,
              by_type: type_summary,
              active: formatted_accounts.count { |a| a[:status] == "ACTIVE" },
              archived: formatted_accounts.count { |a| a[:status] == "ARCHIVED" }
            }
          }
        rescue StandardError => e
          Rails.logger.error("Failed to fetch Xero accounts for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/companies/:company_id/xero/accounts/:account_id/rename
      # Renames a single Xero account
      def rename_account
        connection = @company.corporate_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        account_id = params[:account_id]
        new_name = params[:name]

        if account_id.blank? || new_name.blank?
          return render json: {
            success: false,
            error: "account_id and name are required"
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

        begin
          client = XeroApiClient.new
          result = client.update_account_name(
            account_id,
            new_name,
            tenant_id: connection.xero_tenant_id,
            access_token: connection.access_token
          )

          if result[:success]
            render json: {
              success: true,
              message: "Account renamed successfully",
              account: result[:account]
            }
          else
            render json: {
              success: false,
              error: result[:error] || "Failed to rename account"
            }, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("Failed to rename Xero account for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/companies/:company_id/xero/accounts/standardize_names
      # Renames all bank-type Xero accounts to use standardized format: "{BANK_CODE} {BSB} {ACCOUNT_NUMBER}"
      # SSoT: Uses Xero's BankAccountNumber field directly (no local records needed)
      def standardize_account_names
        connection = @company.corporate_xero_connection

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

        begin
          client = XeroApiClient.new

          # Get Xero accounts
          result = client.get("Accounts", tenant_id: connection.xero_tenant_id, access_token: connection.access_token)

          unless result[:success]
            return render json: {
              success: false,
              error: result[:error] || "Failed to fetch accounts from Xero"
            }, status: :unprocessable_entity
          end

          xero_accounts = result[:data]["Accounts"] || []

          # Filter to BANK type accounts only
          bank_accounts_xero = xero_accounts.select { |a| a["Type"] == "BANK" && a["Status"] == "ACTIVE" }

          renamed = []
          skipped = []
          errors = []

          bank_accounts_xero.each do |xero_acc|
            xero_account_id = xero_acc["AccountID"]
            current_name = xero_acc["Name"]
            bank_account_number = xero_acc["BankAccountNumber"]

            # SSoT: Parse BSB and account number directly from Xero's BankAccountNumber
            # Format is typically: BSBACCOUNTNUMBER (e.g., "084435259449309")
            unless bank_account_number.present? && bank_account_number.length >= 9
              skipped << { xero_account_id: xero_account_id, name: current_name, reason: "No bank account number in Xero" }
              next
            end

            # Extract BSB (first 6 digits) and account number (rest)
            bsb = bank_account_number[0..5]
            account_number = bank_account_number[6..]

            # Skip if BSB doesn't look valid (should be 6 digits)
            unless bsb.match?(/^\d{6}$/)
              skipped << { xero_account_id: xero_account_id, name: current_name, reason: "Invalid BSB format" }
              next
            end

            # Format BSB as XXX-XXX
            formatted_bsb = "#{bsb[0..2]}-#{bsb[3..5]}"

            # Detect bank code from BSB or current name
            bank_code = detect_bank_code_from_bsb_or_name(bsb, current_name)

            # Generate standardized name: "{BANK_CODE} {BSB} {ACCOUNT_NUMBER}"
            new_name = "#{bank_code} #{formatted_bsb} #{account_number}"

            # Skip if already has the correct name
            if current_name == new_name
              skipped << { xero_account_id: xero_account_id, name: current_name, reason: "Already standardized" }
              next
            end

            # Rename in Xero
            rename_result = client.update_account_name(
              xero_account_id,
              new_name,
              tenant_id: connection.xero_tenant_id,
              access_token: connection.access_token
            )

            if rename_result[:success]
              renamed << {
                xero_account_id: xero_account_id,
                old_name: current_name,
                new_name: new_name
              }
            else
              errors << {
                xero_account_id: xero_account_id,
                name: current_name,
                error: rename_result[:error]
              }
            end
          end

          render json: {
            success: true,
            renamed_count: renamed.count,
            skipped_count: skipped.count,
            error_count: errors.count,
            renamed: renamed,
            skipped: skipped,
            errors: errors
          }
        rescue StandardError => e
          Rails.logger.error("Failed to standardize Xero account names for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # Detect bank code from BSB prefix or account name
      def detect_bank_code_from_bsb_or_name(bsb, name)
        # BSB prefix mappings (first 2-3 digits indicate bank)
        bsb_prefix = bsb[0..2]
        case bsb_prefix
        when "082", "083", "084", "085", "086", "087"
          "NAB"
        when "062", "063", "064", "065", "066", "067"
          "CBA"
        when "012", "013", "014", "015", "016", "017"
          "ANZ"
        when "032", "033", "034", "035", "036", "037"
          "WBC"
        when "124"
          "BOQ"
        when "484"
          "SUNCORP"
        else
          # Fallback: detect from account name
          name_lower = name.to_s.downcase
          if name_lower.include?("nab") || name_lower.include?("national australia")
            "NAB"
          elsif name_lower.include?("cba") || name_lower.include?("commonwealth") || name_lower.include?("commbank")
            "CBA"
          elsif name_lower.include?("anz")
            "ANZ"
          elsif name_lower.include?("westpac") || name_lower.include?("wbc")
            "WBC"
          elsif name_lower.include?("boq") || name_lower.include?("bank of queensland")
            "BOQ"
          elsif name_lower.include?("suncorp")
            "SUNCORP"
          elsif name_lower.include?("lawyer") || name_lower.include?("trust")
            "TRUST"
          else
            "BANK"
          end
        end
      end

      # GET /api/v1/companies/:company_id/xero/accounts/compare
      # Compare Chart of Accounts across companies in the same consolidated group
      def compare_accounts
        # Get all companies in the same consolidated group
        consolidated_company_ids = @company.consolidated_child_ids || []
        consolidated_company_ids << @company.id
        consolidated_company_ids.uniq!

        companies_with_xero = CorporateCompany.where(id: consolidated_company_ids)
          .includes(:corporate_xero_connection)
          .select { |c| c.corporate_xero_connection&.connected? }

        if companies_with_xero.empty?
          return render json: {
            success: false,
            error: "No companies in this group are connected to Xero"
          }, status: :bad_request
        end

        client = XeroApiClient.new
        all_accounts = {}
        company_accounts = {}

        companies_with_xero.each do |company|
          connection = company.corporate_xero_connection

          # Refresh if needed
          connection.refresh_tokens! if connection.needs_refresh?

          begin
            result = client.get("Accounts", tenant_id: connection.xero_tenant_id, access_token: connection.access_token)
            next unless result[:success]

            accounts = (result[:data]["Accounts"] || []).reject { |a| a["SystemAccount"].present? }

            company_accounts[company.id] = {
              company_id: company.id,
              company_name: company.name,
              xero_tenant: connection.xero_tenant_name,
              accounts: accounts.map { |a| { code: a["Code"], name: a["Name"], type: a["Type"], status: a["Status"] } }
            }

            # Build master list of all account codes
            accounts.each do |acc|
              code = acc["Code"]
              all_accounts[code] ||= { code: code, name: acc["Name"], type: acc["Type"], companies: [] }
              all_accounts[code][:companies] << {
                company_id: company.id,
                company_name: company.name,
                name: acc["Name"],
                status: acc["Status"]
              }
            end
          rescue StandardError => e
            Rails.logger.warn("Failed to fetch accounts for company #{company.id}: #{e.message}")
          end
        end

        # Find differences
        comparison = all_accounts.values.map do |acc|
          company_count = acc[:companies].count
          {
            code: acc[:code],
            name: acc[:name],
            type: acc[:type],
            company_count: company_count,
            all_companies: company_count == companies_with_xero.count,
            companies: acc[:companies],
            names_match: acc[:companies].map { |c| c[:name] }.uniq.count == 1
          }
        end.sort_by { |a| a[:code].to_s }

        render json: {
          success: true,
          companies: company_accounts.values,
          comparison: comparison,
          summary: {
            total_unique_accounts: all_accounts.count,
            accounts_in_all: comparison.count { |a| a[:all_companies] },
            accounts_with_differences: comparison.count { |a| !a[:names_match] },
            missing_in_some: comparison.count { |a| !a[:all_companies] }
          }
        }
      end

      # GET /api/v1/companies/:company_id/xero/profit_loss
      # Returns Profit & Loss report from Xero
      def profit_loss
        connection = @company.corporate_xero_connection

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

        begin
          from_date = params[:from_date] || Date.today.beginning_of_year.to_s
          to_date = params[:to_date] || Date.today.to_s

          client = XeroApiClient.new
          result = client.get(
            "Reports/ProfitAndLoss",
            tenant_id: connection.xero_tenant_id,
            fromDate: from_date,
            toDate: to_date
          )

          unless result[:success]
            return render json: {
              success: false,
              error: result[:error] || "Failed to fetch Profit & Loss from Xero"
            }, status: :unprocessable_entity
          end

          reports = result[:data]["Reports"] || []
          report = reports.first

          if report.nil?
            return render json: {
              success: false,
              error: "No Profit & Loss report returned from Xero"
            }, status: :unprocessable_entity
          end

          # Parse the report rows
          rows = parse_xero_report_rows(report["Rows"] || [])

          render json: {
            success: true,
            report: {
              title: report["ReportTitles"]&.join(" - "),
              from_date: from_date,
              to_date: to_date,
              rows: rows
            }
          }
        rescue StandardError => e
          Rails.logger.error("Failed to fetch Xero P&L for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/companies/:company_id/xero/profit_loss_monthly
      # Returns monthly P&L summaries from local database (SSoT)
      # Data is synced from Xero via CorporateXeroSyncService
      #
      # Params:
      #   - refresh: "true" to force sync from Xero
      #   - years: number of years to fetch (default 3)
      def profit_loss_monthly
        connection = @company.corporate_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        begin
          # Check if we need to sync (no data or force refresh requested)
          needs_sync = params[:refresh] == "true" ||
                       @company.corporate_monthly_pls.empty? ||
                       connection.monthly_pl_synced_at.nil? ||
                       connection.monthly_pl_synced_at < 1.day.ago

          if needs_sync
            # Sync from Xero in background-friendly way
            years_back = (params[:years] || 3).to_i
            sync_service = CorporateXeroSyncService.new(@company)
            sync_result = sync_service.sync_monthly_pl(force: params[:refresh] == "true", years: years_back)

            unless sync_result[:success]
              # If sync fails but we have cached data, use it
              if @company.corporate_monthly_pls.any?
                Rails.logger.warn("Xero sync failed, using cached data: #{sync_result[:error]}")
              else
                return render json: {
                  success: false,
                  error: sync_result[:error] || "Failed to sync monthly P&L from Xero"
                }, status: :unprocessable_entity
              end
            end
          end

          # Read from database (SSoT)
          monthly_records = @company.corporate_monthly_pls.ordered

          # Format for frontend
          data = monthly_records.each_with_index.map do |record, idx|
            {
              id: idx + 1,
              month: record.month_label,
              revenue: record.revenue.to_f,
              expenses: record.expenses.to_f,
              net_profit: record.net_profit.to_f
            }
          end

          # Get date range from actual data
          earliest = monthly_records.last&.month_label
          latest = monthly_records.first&.month_label

          render json: {
            success: true,
            data: data,
            from_date: earliest,
            to_date: latest,
            months_count: data.count,
            last_synced_at: connection.monthly_pl_synced_at&.iso8601,
            cached: !needs_sync
          }
        rescue StandardError => e
          Rails.logger.error("Failed to fetch monthly P&L for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/companies/:company_id/xero/balance_sheet
      # Returns Balance Sheet report from Xero
      def balance_sheet
        connection = @company.corporate_xero_connection

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

        begin
          as_of_date = params[:date] || Date.today.to_s

          client = XeroApiClient.new
          result = client.get(
            "Reports/BalanceSheet",
            tenant_id: connection.xero_tenant_id,
            date: as_of_date
          )

          unless result[:success]
            return render json: {
              success: false,
              error: result[:error] || "Failed to fetch Balance Sheet from Xero"
            }, status: :unprocessable_entity
          end

          reports = result[:data]["Reports"] || []
          report = reports.first

          if report.nil?
            return render json: {
              success: false,
              error: "No Balance Sheet report returned from Xero"
            }, status: :unprocessable_entity
          end

          # Parse the report rows
          rows = parse_xero_report_rows(report["Rows"] || [])

          render json: {
            success: true,
            report: {
              title: report["ReportTitles"]&.join(" - "),
              date: as_of_date,
              rows: rows
            }
          }
        rescue StandardError => e
          Rails.logger.error("Failed to fetch Xero Balance Sheet for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/companies/:company_id/xero/bank_transactions
      # Returns bank transactions for a specific bank account from Xero
      def bank_transactions
        connection = @company.corporate_xero_connection

        if connection.nil? || !connection.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        bank_account_id = params[:bank_account_id]
        if bank_account_id.blank?
          return render json: {
            success: false,
            error: "bank_account_id is required"
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

        begin
          from_date = params[:from_date] || 3.months.ago.to_date.to_s
          to_date = params[:to_date] || Date.today.to_s

          client = XeroApiClient.new

          # Build date filter - Xero uses DateTime(year,month,day) format
          from_parts = from_date.split("-")
          to_parts = to_date.split("-")
          date_filter = "BankAccount.AccountID=Guid(\"#{bank_account_id}\") AND Date>=DateTime(#{from_parts[0]},#{from_parts[1].to_i},#{from_parts[2].to_i}) AND Date<=DateTime(#{to_parts[0]},#{to_parts[1].to_i},#{to_parts[2].to_i})"

          Rails.logger.info("[XeroBankTransactions] Fetching for company #{@company.id}, account #{bank_account_id}")
          Rails.logger.info("[XeroBankTransactions] Date range: #{from_date} to #{to_date}")
          Rails.logger.info("[XeroBankTransactions] Filter: #{date_filter}")

          # Fetch bank transactions from Xero
          result = client.get(
            "BankTransactions",
            tenant_id: connection.xero_tenant_id,
            access_token: connection.access_token,
            params: {
              where: date_filter,
              order: "Date DESC"
            }
          )

          unless result[:success]
            Rails.logger.error("[XeroBankTransactions] Xero API error: #{result[:error]}")
            return render json: {
              success: false,
              error: result[:error] || "Failed to fetch bank transactions from Xero"
            }, status: :unprocessable_entity
          end

          transactions = result[:data]["BankTransactions"] || []
          Rails.logger.info("[XeroBankTransactions] Received #{transactions.count} raw transactions from Xero")

          # Log first transaction for debugging
          if transactions.any?
            first_tx = transactions.first
            Rails.logger.info("[XeroBankTransactions] First transaction date: #{first_tx['Date']}, type: #{first_tx['Type']}, status: #{first_tx['Status']}")
          end

          # Xero's BankTransactions API doesn't properly filter by date in the where clause
          # We need to filter client-side using the parsed date
          from_date_obj = Date.parse(from_date)
          to_date_obj = Date.parse(to_date)

          transactions = transactions.select do |tx|
            tx_date = parse_xero_date_to_date(tx["Date"])
            next false unless tx_date
            tx_date >= from_date_obj && tx_date <= to_date_obj
          end

          Rails.logger.info("[XeroBankTransactions] After date filtering: #{transactions.count} transactions (#{from_date} to #{to_date})")

          # Also fetch Payments that used this bank account
          # Xero's "Account transactions" view combines BankTransactions + Payments + BankTransfers
          payments = []
          begin
            payments_result = client.get(
              "Payments",
              tenant_id: connection.xero_tenant_id,
              access_token: connection.access_token,
              params: {
                where: "Account.AccountID=Guid(\"#{bank_account_id}\")",
                order: "Date DESC"
              }
            )

            if payments_result[:success]
              all_payments = payments_result[:data]["Payments"] || []
              Rails.logger.info("[XeroBankTransactions] Received #{all_payments.count} payments from Xero for this bank account")

              # Filter payments by date
              payments = all_payments.select do |pmt|
                pmt_date = parse_xero_date_to_date(pmt["Date"])
                next false unless pmt_date
                pmt_date >= from_date_obj && pmt_date <= to_date_obj
              end
              Rails.logger.info("[XeroBankTransactions] After date filtering: #{payments.count} payments")
            else
              Rails.logger.warn("[XeroBankTransactions] Failed to fetch payments: #{payments_result[:error]}")
            end
          rescue StandardError => e
            Rails.logger.warn("[XeroBankTransactions] Error fetching payments: #{e.message}")
          end

          # Format transactions for display
          formatted_transactions = transactions.map do |tx|
            # Calculate total amount from line items or use SubTotal
            total = tx["SubTotal"].to_f
            if total.zero?
              total = (tx["LineItems"] || []).sum { |li| li["LineAmount"].to_f }
            end
            is_spend = tx["Type"] == "SPEND"

            {
              transaction_id: tx["BankTransactionID"],
              date: parse_xero_date(tx["Date"]),
              type: tx["Type"],
              reference: tx["Reference"],
              description: tx["LineItems"]&.first&.dig("Description") || tx["Reference"] || "No description",
              amount: is_spend ? -total.abs : total.abs,
              contact_name: tx["Contact"]&.dig("Name"),
              status: tx["Status"],
              is_reconciled: tx["IsReconciled"],
              line_items: (tx["LineItems"] || []).map do |li|
                {
                  description: li["Description"],
                  amount: li["LineAmount"].to_f,
                  account_code: li["AccountCode"]
                }
              end
            }
          end

          # Format payments for display
          formatted_payments = payments.map do |pmt|
            # Payments can be for Invoices (money in) or Bills (money out)
            is_payment_out = pmt["PaymentType"] == "ACCPAY" # Account Payable = bill payment = money out
            amount = pmt["Amount"].to_f
            invoice_number = pmt["Invoice"]&.dig("InvoiceNumber")
            invoice_type = pmt["Invoice"]&.dig("Type") # ACCPAY or ACCREC

            # Determine description
            contact_name = pmt["Invoice"]&.dig("Contact", "Name")
            description = if invoice_number
                            "Payment: #{contact_name || 'Unknown'}"
                          else
                            "Payment"
                          end

            {
              transaction_id: pmt["PaymentID"],
              date: parse_xero_date(pmt["Date"]),
              type: is_payment_out ? "PAYMENT_OUT" : "PAYMENT_IN",
              reference: invoice_number,
              description: description,
              amount: is_payment_out ? -amount.abs : amount.abs,
              contact_name: contact_name,
              status: pmt["Status"] == "AUTHORISED" ? "AUTHORISED" : pmt["Status"],
              is_reconciled: pmt["IsReconciled"],
              source: "PAYMENT",
              line_items: []
            }
          end

          # Combine and sort by date (newest first)
          all_transactions = formatted_transactions + formatted_payments
          all_transactions.sort_by! { |tx| tx[:date] || "" }.reverse!

          Rails.logger.info("[XeroBankTransactions] Total combined: #{all_transactions.count} (#{formatted_transactions.count} transactions + #{formatted_payments.count} payments)")

          # Try to get account balance
          balance_info = fetch_bank_account_balance(client, connection, bank_account_id)

          render json: {
            success: true,
            transactions: all_transactions,
            balance: balance_info,
            meta: {
              from_date: from_date,
              to_date: to_date,
              count: all_transactions.count,
              bank_transactions_count: formatted_transactions.count,
              payments_count: formatted_payments.count
            }
          }
        rescue StandardError => e
          Rails.logger.error("[XeroBankTransactions] Error for company #{@company.id}: #{e.message}")
          Rails.logger.error(e.backtrace.first(5).join("\n"))
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # Parse Xero .NET date format to Ruby Date object
      # Returns nil if parsing fails
      def parse_xero_date_to_date(xero_date)
        return nil if xero_date.blank?

        if xero_date.is_a?(String) && xero_date.match?(%r{/Date\((\d+)([+-]\d{4})?\)/})
          match = xero_date.match(%r{/Date\((\d+)([+-]\d{4})?\)/})
          ms = match[1].to_i
          Time.at(ms / 1000).utc.to_date
        else
          Date.parse(xero_date.to_s)
        end
      rescue StandardError => e
        Rails.logger.warn("[XeroBankTransactions] Failed to parse date '#{xero_date}': #{e.message}")
        nil
      end

      # Helper to fetch bank account balance from Xero using Bank Summary Report
      def fetch_bank_account_balance(client, connection, bank_account_id)
        begin
          # First get the account name to match in the report
          account_result = client.get(
            "Accounts/#{bank_account_id}",
            tenant_id: connection.xero_tenant_id,
            access_token: connection.access_token
          )

          account_name = nil
          if account_result[:success] && account_result[:data]["Accounts"]&.any?
            account_name = account_result[:data]["Accounts"].first["Name"]
          end

          return {} unless account_name

          # Fetch Bank Summary Report which contains balances
          result = client.get(
            "Reports/BankSummary",
            tenant_id: connection.xero_tenant_id,
            access_token: connection.access_token
          )

          if result[:success] && result[:data]["Reports"]&.any?
            report = result[:data]["Reports"].first
            rows = report["Rows"] || []

            # Find the account row in the report
            rows.each do |row|
              next unless row["RowType"] == "Section"

              (row["Rows"] || []).each do |r|
                cells = r["Cells"] || []
                next if cells.empty?

                row_account_name = cells[0]["Value"]
                if row_account_name == account_name
                  # Columns: Account Name | Opening | Cash Received | Cash Spent | Closing
                  opening_balance = cells[1]["Value"].to_f rescue 0.0
                  closing_balance = cells[4]["Value"].to_f rescue 0.0

                  return {
                    statement_balance: opening_balance,
                    xero_balance: closing_balance
                  }
                end
              end
            end
          end

          {}
        rescue StandardError => e
          Rails.logger.warn("[XeroBankTransactions] Could not fetch balance: #{e.message}")
          {}
        end
      end

      # GET /api/v1/companies/:company_id/xero/group/companies
      # Returns all companies in the consolidated group with their Xero connection status
      def group_companies
        companies = get_group_companies

        render json: {
          success: true,
          companies: companies.map do |company|
            connection = company.corporate_xero_connection
            {
              id: company.id,
              name: company.name,
              slug: company.slug,
              xero_connected: connection&.connected? || false,
              xero_tenant_name: connection&.xero_tenant_name,
              is_parent: company.has_consolidated_children?
            }
          end
        }
      end

      # GET /api/v1/companies/:company_id/xero/group/profit_loss
      # Returns P&L report merged across all group companies
      def group_profit_loss
        companies = get_group_companies.select { |c| c.corporate_xero_connection&.connected? }

        if companies.empty?
          return render json: {
            success: false,
            error: "No companies in this group are connected to Xero"
          }, status: :bad_request
        end

        from_date = params[:from_date] || Date.today.beginning_of_year.to_s
        to_date = params[:to_date] || Date.today.to_s
        client = XeroApiClient.new

        company_reports = []
        all_rows = {}

        companies.each do |company|
          connection = company.corporate_xero_connection
          connection.refresh_tokens! if connection.needs_refresh?

          begin
            result = client.get(
              "Reports/ProfitAndLoss",
              tenant_id: connection.xero_tenant_id,
              access_token: connection.access_token,
              params: { fromDate: from_date, toDate: to_date }
            )

            next unless result[:success]

            report = result[:data]["Reports"]&.first
            next unless report

            rows = parse_xero_report_rows(report["Rows"] || [])

            company_reports << {
              company_id: company.id,
              company_name: company.name,
              rows: rows
            }

            # Merge rows by title/label for side-by-side comparison
            rows.each_with_index do |row, idx|
              key = row[:row_type] == "Row" ? (row[:cells]&.first&.dig(:value) || idx.to_s) : "#{row[:row_type]}_#{row[:title] || idx}"
              all_rows[key] ||= {
                row_type: row[:row_type],
                title: row[:title],
                label: row[:cells]&.first&.dig(:value),
                values: {}
              }
              # Get the amount value (usually second cell)
              amount = row[:cells]&.[](1)&.dig(:value)
              all_rows[key][:values][company.id] = amount
            end
          rescue StandardError => e
            Rails.logger.warn("Failed to fetch P&L for company #{company.id}: #{e.message}")
          end
        end

        # Build merged rows with totals
        merged_rows = all_rows.values.map do |row|
          total = row[:values].values.sum { |v| v.to_s.gsub(/[^\d.-]/, "").to_f }
          {
            row_type: row[:row_type],
            title: row[:title],
            label: row[:label],
            company_values: row[:values],
            total: total
          }
        end

        render json: {
          success: true,
          companies: company_reports.map { |r| { id: r[:company_id], name: r[:company_name] } },
          rows: merged_rows,
          from_date: from_date,
          to_date: to_date
        }
      end

      # GET /api/v1/companies/:company_id/xero/group/balance_sheet
      # Returns Balance Sheet merged across all group companies
      def group_balance_sheet
        companies = get_group_companies.select { |c| c.corporate_xero_connection&.connected? }

        if companies.empty?
          return render json: {
            success: false,
            error: "No companies in this group are connected to Xero"
          }, status: :bad_request
        end

        as_of_date = params[:date] || Date.today.to_s
        client = XeroApiClient.new

        company_reports = []
        all_rows = {}

        companies.each do |company|
          connection = company.corporate_xero_connection
          connection.refresh_tokens! if connection.needs_refresh?

          begin
            result = client.get(
              "Reports/BalanceSheet",
              tenant_id: connection.xero_tenant_id,
              access_token: connection.access_token,
              params: { date: as_of_date }
            )

            next unless result[:success]

            report = result[:data]["Reports"]&.first
            next unless report

            rows = parse_xero_report_rows(report["Rows"] || [])

            company_reports << {
              company_id: company.id,
              company_name: company.name,
              rows: rows
            }

            # Merge rows by title/label
            rows.each_with_index do |row, idx|
              key = row[:row_type] == "Row" ? (row[:cells]&.first&.dig(:value) || idx.to_s) : "#{row[:row_type]}_#{row[:title] || idx}"
              all_rows[key] ||= {
                row_type: row[:row_type],
                title: row[:title],
                label: row[:cells]&.first&.dig(:value),
                values: {}
              }
              amount = row[:cells]&.[](1)&.dig(:value)
              all_rows[key][:values][company.id] = amount
            end
          rescue StandardError => e
            Rails.logger.warn("Failed to fetch Balance Sheet for company #{company.id}: #{e.message}")
          end
        end

        # Build merged rows with totals
        merged_rows = all_rows.values.map do |row|
          total = row[:values].values.sum { |v| v.to_s.gsub(/[^\d.-]/, "").to_f }
          {
            row_type: row[:row_type],
            title: row[:title],
            label: row[:label],
            company_values: row[:values],
            total: total
          }
        end

        render json: {
          success: true,
          companies: company_reports.map { |r| { id: r[:company_id], name: r[:company_name] } },
          rows: merged_rows,
          as_of_date: as_of_date
        }
      end

      # GET /api/v1/companies/:company_id/xero/health
      # Returns comprehensive Xero health dashboard data
      # Includes locked date, sync status, and detailed stats for each area
      def health
        connection = @company.corporate_xero_connection

        unless connection&.connected?
          return render json: {
            success: false,
            error: "Company is not connected to Xero"
          }, status: :bad_request
        end

        xero_tenant_id = connection.xero_tenant_id

        # Fetch organisation info from Xero (includes locked date)
        organisation_info = fetch_xero_organisation(connection)

        # Invoice stats
        invoices = ExternalInvoice.xero.sales_invoices.for_tenant(xero_tenant_id)
        invoices_with_pdfs = WarehouseDocument.where(documentable_type: "ExternalInvoice", documentable_id: invoices.select(:id), source_type: "xero").select(:documentable_id).distinct.count
        invoices_by_status = invoices.group(:status).count

        # Bill stats
        bills = ExternalInvoice.xero.bills.for_tenant(xero_tenant_id)
        bills_with_pdfs = WarehouseDocument.where(documentable_type: "ExternalInvoice", documentable_id: bills.select(:id), source_type: "xero").select(:documentable_id).distinct.count
        bills_by_status = bills.group(:status).count

        # Credit notes
        credit_notes = ExternalInvoice.xero.credit_notes.for_tenant(xero_tenant_id)

        # Contact stats
        linked_contacts = ContactExternalLink.where(
          source: "xero",
          tenant_id: xero_tenant_id,
          sync_enabled: true
        )
        contacts_with_errors = linked_contacts.where.not(sync_error: nil).count

        # Bank stats
        bank_accounts = @company.bank_accounts.where.not(xero_account_id: nil)
        bank_statements_completed = BankStatementReport.where(company_id: @company.id, status: "completed")
        bank_statements_pending = BankStatementReport.where(company_id: @company.id, status: "pending")
        bank_statements_failed = BankStatementReport.where(company_id: @company.id, status: "failed")
        bank_documents = WarehouseDocument.where(
          source_type: "xero",
          documentable_type: "BankStatementReport",
          documentable_id: BankStatementReport.where(company_id: @company.id).select(:id)
        )

        # P&L stats
        monthly_pls = @company.corporate_monthly_pls.ordered
        pl_last_synced = connection.monthly_pl_synced_at

        # Balance Sheet stats
        balance_sheets = @company.balance_sheet_reports.where(status: "completed")
        bs_last_synced = balance_sheets.maximum(:created_at)

        # Sync status from XeroSyncStatus
        sync_statuses = XeroSyncStatus.where(tenant_id: xero_tenant_id)
        last_invoice_sync = sync_statuses.find_by(sync_type: "invoices")&.last_synced_at
        last_contact_sync = sync_statuses.find_by(sync_type: "contacts")&.last_synced_at

        # Calculate what's needed for end of month
        current_month = Date.current.beginning_of_month
        last_month = current_month - 1.month

        render json: {
          success: true,
          health: {
            # Organisation info from Xero
            organisation: {
              name: organisation_info[:name],
              locked_date: organisation_info[:locked_date],
              financial_year_end_day: organisation_info[:financial_year_end_day],
              financial_year_end_month: organisation_info[:financial_year_end_month],
              base_currency: organisation_info[:base_currency]
            },

            # Connection status
            connection: {
              status: connection.connected? ? "connected" : "disconnected",
              tenant_name: connection.xero_tenant_name,
              last_sync_at: connection.last_sync_at,
              api_calls_today: organisation_info[:api_calls_remaining]
            },

            # Invoice health
            invoices: {
              total: invoices.count,
              with_pdfs: invoices_with_pdfs,
              missing_pdfs: invoices.count - invoices_with_pdfs,
              by_status: invoices_by_status,
              last_synced: last_invoice_sync
            },

            # Bills health
            bills: {
              total: bills.count,
              with_pdfs: bills_with_pdfs,
              missing_pdfs: bills.count - bills_with_pdfs,
              by_status: bills_by_status,
              last_synced: last_invoice_sync
            },

            # Credit notes
            credit_notes: {
              total: credit_notes.count
            },

            # Contact health
            contacts: {
              linked: linked_contacts.count,
              with_errors: contacts_with_errors,
              last_synced: last_contact_sync
            },

            # Bank health
            bank: {
              accounts: bank_accounts.count,
              statements_completed: bank_statements_completed.count,
              statements_pending: bank_statements_pending.count,
              statements_failed: bank_statements_failed.count,
              documents_generated: bank_documents.count
            },

            # P&L health
            profit_loss: {
              months_available: monthly_pls.count,
              date_range: monthly_pls.any? ? {
                from: monthly_pls.last&.month_label,
                to: monthly_pls.first&.month_label
              } : nil,
              last_synced: pl_last_synced
            },

            # Balance Sheet health
            balance_sheet: {
              reports_count: balance_sheets.count,
              last_synced: bs_last_synced
            },

            # End of month status
            end_of_month: {
              current_month: current_month.strftime("%B %Y"),
              last_month: last_month.strftime("%B %Y"),
              last_month_closed: begin
                organisation_info[:locked_date].present? &&
                  Date.parse(organisation_info[:locked_date]) >= last_month.end_of_month
              rescue
                false
              end
            }
          }
        }
      end

      # GET /api/v1/companies/:company_id/xero/tab_stats
      # Returns counts for each Xero sub-tab to display as badges
      # Used by XeroTabRenderer to show document/record counts on tabs
      #
      # SSoT: Includes GL account count from Gl::Account table to show unified sync status
      # This ensures Financial Dashboard and GL page show consistent data.
      def tab_stats
        connection = @company.corporate_xero_connection
        xero_tenant_id = connection&.xero_tenant_id

        # GL accounts synced (SSoT: from Gl::Account table, same source as GL page)
        gl_accounts_count = 0
        if xero_tenant_id.present?
          gl_accounts_count = begin
            ::Gl::Account.where(
              external_provider: 'xero',
              external_tenant_id: xero_tenant_id
            ).count
          rescue ActiveRecord::StatementInvalid
            0
          end
        end

        # Bank tab stats - count bank accounts and statements
        bank_accounts = @company.bank_accounts.where.not(xero_account_id: nil)
        bank_statements = BankStatementReport.where(company_id: @company.id, status: "completed")
        bank_documents = WarehouseDocument.where(
          source_type: "xero",
          documentable_type: "BankStatementReport",
          documentable_id: BankStatementReport.where(company_id: @company.id).select(:id)
        )

        # P&L tab stats - count monthly P&L reports
        profit_loss_reports = @company.corporate_monthly_pls.count

        # Balance Sheet tab stats
        balance_sheet_reports = @company.balance_sheet_reports.where(status: "completed").count

        # Accounts tab stats - from local cache or Xero
        accounts_count = 0
        if connection&.connected?
          begin
            # Use cached count if available from setup_status
            accounts_count = @company.bank_accounts.count + 50 # Approximate until we cache this
          rescue StandardError
            accounts_count = 0
          end
        end

        # Contacts tab stats - Xero-linked contacts
        contacts_count = 0
        if xero_tenant_id.present?
          contacts_count = ContactExternalLink.where(
            source: "xero",
            tenant_id: xero_tenant_id,
            sync_enabled: true
          ).count
        end

        # Invoices tab stats - uses ExternalInvoice model with sales_invoices scope
        invoices_count = 0
        if xero_tenant_id.present?
          invoices_count = ExternalInvoice.xero
            .sales_invoices
            .for_tenant(xero_tenant_id)
            .count
        end

        # Bills & POs tab stats - uses ExternalInvoice model with bills scope
        bills_count = 0
        if xero_tenant_id.present?
          bills_count = ExternalInvoice.xero
            .bills
            .for_tenant(xero_tenant_id)
            .count
        end

        render json: {
          success: true,
          # Top-level counts for Financial Dashboard XeroSyncStatusCard
          # SSoT: These are the same data sources used by their respective detail pages
          contacts: contacts_count,
          invoices: invoices_count,
          bills: bills_count,
          bank_accounts: bank_accounts.count,
          gl_accounts: gl_accounts_count,
          stats: {
            # Connection tab - no count needed
            connection: nil,
            # P&L tab
            profit_loss: profit_loss_reports > 0 ? profit_loss_reports : nil,
            # Balance Sheet tab
            balance_sheet: balance_sheet_reports > 0 ? balance_sheet_reports : nil,
            # Bank tab - show bank account count and statement count
            bank: {
              accounts: bank_accounts.count,
              statements: bank_statements.count,
              documents: bank_documents.count,
              display: bank_accounts.count > 0 ? bank_accounts.count : nil
            },
            # Accounts tab
            accounts: accounts_count > 0 ? accounts_count : nil,
            # Contacts tab
            contacts: contacts_count > 0 ? contacts_count : nil,
            # Invoices tab
            invoices: invoices_count > 0 ? invoices_count : nil,
            # Bills & POs tab
            bills: bills_count > 0 ? bills_count : nil,
            # GL accounts synced (SSoT: from Gl::Account, matches GL page)
            gl_accounts: gl_accounts_count > 0 ? gl_accounts_count : nil
          }
        }
      end

      private

      # Fetch organisation info from Xero API (includes locked date)
      # Parse Xero .NET date format "/Date(1751155200000+0000)/" to ISO string
      def parse_xero_date(xero_date)
        return nil if xero_date.blank?

        # Extract milliseconds from .NET format: /Date(1751155200000+0000)/
        if xero_date.is_a?(String) && xero_date.match?(%r{/Date\((\d+)([+-]\d{4})?\)/})
          match = xero_date.match(%r{/Date\((\d+)([+-]\d{4})?\)/})
          ms = match[1].to_i
          Time.at(ms / 1000).utc.strftime("%Y-%m-%d")
        else
          # Already in a usable format or unrecognized
          xero_date.to_s
        end
      rescue StandardError => e
        Rails.logger.warn("Failed to parse Xero date '#{xero_date}': #{e.message}")
        nil
      end

      def fetch_xero_organisation(connection)
        return {} unless connection&.connected?

        # Refresh tokens if needed
        connection.refresh_tokens! if connection.needs_refresh?

        begin
          client = XeroApiClient.new
          result = client.get(
            "Organisation",
            tenant_id: connection.xero_tenant_id,
            access_token: connection.access_token
          )

          if result[:success] && result[:data]["Organisations"].present?
            org = result[:data]["Organisations"].first
            {
              name: org["Name"],
              # EndOfYearLockDate is the date up to which books are locked
              # Xero returns .NET format like "/Date(1751155200000+0000)/" - convert to ISO
              locked_date: parse_xero_date(org["EndOfYearLockDate"]),
              # PeriodLockDate is the date up to which the current period is locked
              period_lock_date: parse_xero_date(org["PeriodLockDate"]),
              financial_year_end_day: org["FinancialYearEndDay"],
              financial_year_end_month: org["FinancialYearEndMonth"],
              base_currency: org["BaseCurrency"],
              organisation_type: org["OrganisationType"],
              tax_number: org["TaxNumber"],
              api_calls_remaining: result[:headers]&.dig("x-daylimit-remaining")
            }
          else
            Rails.logger.warn("Failed to fetch Xero organisation: #{result[:error]}")
            {}
          end
        rescue StandardError => e
          Rails.logger.error("Error fetching Xero organisation: #{e.message}")
          {}
        end
      end

      # Get all companies in the consolidated group (parent + children)
      def get_group_companies
        # If this company has a parent, start from parent
        parent = @company.consolidation_parent_id ? Corporate.find_by(id: @company.consolidation_parent_id) : @company

        # Get parent and all its consolidated children
        companies = [ parent ]
        companies.concat(parent.consolidated_children.to_a) if parent.has_consolidated_children?
        companies.compact.uniq
      end

      # Helper to parse Xero report rows into a flat structure
      def parse_xero_report_rows(rows, depth = 0)
        result = []
        rows.each do |row|
          row_type = row["RowType"]

          case row_type
          when "Header"
            cells = row["Cells"]&.map { |c| { value: c["Value"] || "" } } || []
            result << { row_type: "Header", cells: cells }
          when "Section"
            title = row["Title"]
            result << { row_type: "Section", title: title } if title.present?
            if row["Rows"].present?
              result.concat(parse_xero_report_rows(row["Rows"], depth + 1))
            end
          when "Row"
            cells = row["Cells"]&.map { |c| { value: c["Value"] || "" } } || []
            result << { row_type: "Row", cells: cells, depth: depth }
          when "SummaryRow"
            cells = row["Cells"]&.map { |c| { value: c["Value"] || "" } } || []
            result << { row_type: "SummaryRow", cells: cells }
          end
        end
        result
      end

      # Parse multi-period P&L report into monthly table format
      # Returns array of { month: "Jan 2024", revenue: 10000.00, expenses: 8000.00, net_profit: 2000.00 }
      def parse_monthly_profit_loss(report)
        rows = report["Rows"] || []
        months = []
        revenue_values = []
        expenses_values = []
        net_profit_values = []

        # First, extract month headers from Header row
        rows.each do |row|
          if row["RowType"] == "Header"
            cells = row["Cells"] || []
            # First cell is label, rest are month columns
            cells[1..].each do |cell|
              month_str = cell["Value"]
              months << month_str if month_str.present?
            end
          end
        end

        # Now extract values from sections
        rows.each do |row|
          case row["RowType"]
          when "Section"
            title = row["Title"]
            section_rows = row["Rows"] || []

            # Find the summary row for this section
            section_rows.each do |section_row|
              if section_row["RowType"] == "SummaryRow"
                cells = section_row["Cells"] || []
                label = cells.first&.dig("Value") || ""

                # Extract values for each month (skip first cell which is label)
                values = cells[1..].map { |c| parse_currency_value(c["Value"]) }

                case title
                when "Income"
                  if label.include?("Total Income") || label.include?("Total Revenue")
                    revenue_values = values
                  end
                when "Less Operating Expenses", "Expenses", "Operating Expenses"
                  if label.include?("Total") && (label.include?("Expenses") || label.include?("Operating"))
                    expenses_values = values
                  end
                end
              end
            end
          when "SummaryRow"
            # Top-level summary rows (e.g., "Net Profit")
            cells = row["Cells"] || []
            label = cells.first&.dig("Value") || ""

            if label.include?("Net Profit") || label.include?("Net Income")
              net_profit_values = cells[1..].map { |c| parse_currency_value(c["Value"]) }
            end
          end
        end

        # Build the monthly data array
        monthly_data = []
        months.each_with_index do |month, idx|
          monthly_data << {
            id: idx + 1,
            month: month,
            revenue: revenue_values[idx] || 0.0,
            expenses: expenses_values[idx] || 0.0,
            net_profit: net_profit_values[idx] || 0.0
          }
        end

        # Return in reverse chronological order (most recent first)
        monthly_data.reverse
      end

      # Parse currency string to float (handles "$1,234.56" format)
      def parse_currency_value(value)
        return 0.0 if value.blank?
        # Remove currency symbols, commas, spaces and parse
        cleaned = value.to_s.gsub(/[^0-9.\-]/, "")
        cleaned.to_f
      end

      def set_company
        @company = Corporate.find_by_slug_or_id(params[:company_id])
        unless @company
          render json: { success: false, error: "Company not found" }, status: :not_found
        end
      end
    end
  end
end
