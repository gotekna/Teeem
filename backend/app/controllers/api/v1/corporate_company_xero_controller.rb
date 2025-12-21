module Api
  module V1
    class CorporateCompanyXeroController < ApplicationController
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
        connection = @company.corporate_company_xero_connection
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

      # GET /api/v1/companies/:company_id/xero/setup_status
      # Returns the setup wizard status for this company's Xero integration
      # Used by XeroSetupWizard component to track progress
      def setup_status
        connection = @company.corporate_company_xero_connection
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
        connection = @company.corporate_company_xero_connection

        if connection.present?
          render json: { success: false, error: "This company is already linked to #{connection.xero_tenant_name}" }, status: :unprocessable_entity
          return
        end

        # Create the connection
        connection = @company.build_corporate_company_xero_connection
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
      def authorize
        Rails.logger.info("[Xero Authorize] Company #{@company.id} (#{@company.name}) requesting authorization URL")

        # Note: company_id is passed via state parameter in OAuth flow, not session
        client = XeroApiClient.new
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
        connection = @company.corporate_company_xero_connection

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
        connection = @company.corporate_company_xero_connection

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
        connection = @company.corporate_company_xero_connection

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
        connection = @company.corporate_company_xero_connection

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
        connection = @company.corporate_company_xero_connection

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
        connection = @company.corporate_company_xero_connection

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
        connection = @company.corporate_company_xero_connection

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
        connection = @company.corporate_company_xero_connection

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

      # GET /api/v1/companies/:company_id/xero/accounts/compare
      # Compare Chart of Accounts across companies in the same consolidated group
      def compare_accounts
        # Get all companies in the same consolidated group
        consolidated_company_ids = @company.consolidated_child_ids || []
        consolidated_company_ids << @company.id
        consolidated_company_ids.uniq!

        companies_with_xero = CorporateCompany.where(id: consolidated_company_ids)
          .includes(:company_xero_connection)
          .select { |c| c.corporate_company_xero_connection&.connected? }

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
          connection = company.corporate_company_xero_connection

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
        connection = @company.corporate_company_xero_connection

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
            access_token: connection.access_token,
            params: { fromDate: from_date, toDate: to_date }
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

      # GET /api/v1/companies/:company_id/xero/balance_sheet
      # Returns Balance Sheet report from Xero
      def balance_sheet
        connection = @company.corporate_company_xero_connection

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
            access_token: connection.access_token,
            params: { date: as_of_date }
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
        connection = @company.corporate_company_xero_connection

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

          # Fetch bank transactions from Xero
          result = client.get(
            "BankTransactions",
            tenant_id: connection.xero_tenant_id,
            access_token: connection.access_token,
            params: {
              where: "BankAccount.AccountID=Guid(\"#{bank_account_id}\") AND Date>=DateTime(#{from_date.gsub("-", ",")}) AND Date<=DateTime(#{to_date.gsub("-", ",")})",
              order: "Date DESC"
            }
          )

          unless result[:success]
            return render json: {
              success: false,
              error: result[:error] || "Failed to fetch bank transactions from Xero"
            }, status: :unprocessable_entity
          end

          transactions = result[:data]["BankTransactions"] || []

          # Format transactions for display
          formatted_transactions = transactions.map do |tx|
            # Calculate total amount from line items
            total = (tx["LineItems"] || []).sum { |li| li["LineAmount"].to_f }
            is_spend = tx["Type"] == "SPEND"

            {
              transaction_id: tx["BankTransactionID"],
              date: tx["Date"],
              type: tx["Type"],
              reference: tx["Reference"],
              description: tx["LineItems"]&.first&.dig("Description") || tx["Reference"] || "No description",
              amount: is_spend ? -total.abs : total.abs,
              contact_name: tx["Contact"]&.dig("Name"),
              status: tx["Status"],
              line_items: (tx["LineItems"] || []).map do |li|
                {
                  description: li["Description"],
                  amount: li["LineAmount"].to_f,
                  account_code: li["AccountCode"]
                }
              end
            }
          end

          render json: {
            success: true,
            transactions: formatted_transactions,
            meta: {
              from_date: from_date,
              to_date: to_date,
              count: formatted_transactions.count
            }
          }
        rescue StandardError => e
          Rails.logger.error("Failed to fetch Xero bank transactions for company #{@company.id}: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/companies/:company_id/xero/group/companies
      # Returns all companies in the consolidated group with their Xero connection status
      def group_companies
        companies = get_group_companies

        render json: {
          success: true,
          companies: companies.map do |company|
            connection = company.corporate_company_xero_connection
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
        companies = get_group_companies.select { |c| c.corporate_company_xero_connection&.connected? }

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
          connection = company.corporate_company_xero_connection
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
        companies = get_group_companies.select { |c| c.corporate_company_xero_connection&.connected? }

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
          connection = company.corporate_company_xero_connection
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

      private

      # Get all companies in the consolidated group (parent + children)
      def get_group_companies
        # If this company has a parent, start from parent
        parent = @company.consolidation_parent_id ? CorporateCompany.find_by(id: @company.consolidation_parent_id) : @company

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

      def set_company
        @company = CorporateCompany.find_by_slug_or_id(params[:company_id])
        unless @company
          render json: { success: false, error: "Company not found" }, status: :not_found
        end
      end
    end
  end
end
