module Api
  module V1
    class XeroChartOfAccountsController < ApplicationController
      before_action :set_account, only: [ :show, :update, :destroy ]

      # GET /api/v1/xero_chart_of_accounts
      def index
        @accounts = XeroChartOfAccount.includes(:company_group)

        # Filter by company group
        if params[:company_group_id].present?
          @accounts = @accounts.for_group(params[:company_group_id])
        elsif params[:global] == "true"
          @accounts = @accounts.global
        end

        # Filter by account type
        if params[:account_type].present?
          @accounts = @accounts.where(account_type: params[:account_type])
        end

        # Filter by active status
        @accounts = @accounts.where(active: true) unless params[:include_inactive] == "true"

        @accounts = @accounts.by_code

        render json: {
          success: true,
          data: @accounts.map { |a| serialize_account(a) },
          summary: account_summary
        }
      end

      # GET /api/v1/xero_chart_of_accounts/:id
      def show
        render json: {
          success: true,
          data: serialize_account(@account)
        }
      end

      # POST /api/v1/xero_chart_of_accounts
      def create
        @account = XeroChartOfAccount.new(account_params)

        if @account.save
          render json: {
            success: true,
            data: serialize_account(@account)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @account.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/xero_chart_of_accounts/:id
      def update
        if @account.update(account_params)
          render json: {
            success: true,
            data: serialize_account(@account)
          }
        else
          render json: {
            success: false,
            errors: @account.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/xero_chart_of_accounts/:id
      def destroy
        @account.destroy
        render json: { success: true }
      end

      # GET /api/v1/xero_chart_of_accounts/for_company/:company_id
      def for_company
        company = Corporate.find(params[:company_id])
        @accounts = XeroChartOfAccount.for_company(company).by_code

        render json: {
          success: true,
          data: @accounts.map { |a| serialize_account(a) },
          company: {
            id: company.id,
            name: company.name,
            company_group: company.company_group&.name
          }
        }
      end

      # POST /api/v1/xero_chart_of_accounts/sync_from_xero
      # Import chart of accounts from Xero
      # Also syncs to CorporateXeroAccount if company_id provided
      def sync_from_xero
        company_group_id = params[:company_group_id]
        tenant_id = params[:tenant_id]
        company_id = params[:company_id]

        unless tenant_id.present?
          return render json: {
            success: false,
            errors: [ "Xero tenant ID required" ]
          }, status: :unprocessable_entity
        end

        begin
          client = XeroApiClient.new
          result = client.get("Accounts", tenant_id: tenant_id)

          unless result[:success]
            return render json: {
              success: false,
              errors: [ "Failed to fetch accounts: #{result[:error]}" ]
            }, status: :unprocessable_entity
          end

          accounts = result[:data]["Accounts"] || []
          stats = { created: 0, updated: 0, skipped: 0, company_accounts_synced: 0 }

          # Find company connection if company_id provided
          connection = nil
          if company_id.present?
            company = Corporate.find_by(id: company_id)
            connection = company&.corporate_company_xero_connection
          end

          accounts.each do |xero_account|
            # Skip system accounts
            next if xero_account["SystemAccount"].present?

            # Sync to master chart (XeroChartOfAccount)
            account = XeroChartOfAccount.find_or_initialize_by(
              company_group_id: company_group_id,
              account_code: xero_account["Code"]
            )

            account.assign_attributes(
              account_name: xero_account["Name"],
              account_type: xero_account["Type"],
              tax_type: xero_account["TaxType"],
              description: xero_account["Description"],
              active: xero_account["Status"] == "ACTIVE"
            )

            if account.new_record?
              account.save!
              stats[:created] += 1
            elsif account.changed?
              account.save!
              stats[:updated] += 1
            else
              stats[:skipped] += 1
            end

            # Also sync to per-company accounts (CorporateXeroAccount)
            if connection.present?
              company_account = CorporateXeroAccount.find_or_initialize_by(
                company_xero_connection_id: connection.id,
                xero_account_id: xero_account["AccountID"]
              )

              company_account.assign_attributes(
                account_code: xero_account["Code"],
                account_name: xero_account["Name"],
                account_type: xero_account["Type"],
                account_class: xero_account["Class"],
                tax_type: xero_account["TaxType"],
                description: xero_account["Description"],
                status: xero_account["Status"],
                bank_account_number: xero_account["BankAccountNumber"],
                currency_code: xero_account["CurrencyCode"],
                reporting_code: xero_account["ReportingCode"],
                reporting_code_name: xero_account["ReportingCodeName"],
                enable_payments: xero_account["EnablePaymentsToAccount"] == true,
                show_in_expense_claims: xero_account["ShowInExpenseClaims"] == true,
                synced_at: Time.current
              )

              company_account.save!
              stats[:company_accounts_synced] += 1
            end
          end

          render json: {
            success: true,
            stats: stats,
            total_xero_accounts: accounts.count
          }
        rescue StandardError => e
          render json: {
            success: false,
            errors: [ e.message ]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/xero_chart_of_accounts/copy_to_group
      # Copy chart of accounts from one group to another
      def copy_to_group
        from_group_id = params[:from_group_id]
        to_group_id = params[:to_group_id]

        source_accounts = if from_group_id.present?
          XeroChartOfAccount.for_group(from_group_id).active
        else
          XeroChartOfAccount.global.active
        end

        if source_accounts.empty?
          return render json: {
            success: false,
            errors: [ "No accounts found in source group" ]
          }, status: :unprocessable_entity
        end

        stats = { created: 0, skipped: 0 }

        source_accounts.each do |source|
          existing = XeroChartOfAccount.find_by(
            company_group_id: to_group_id,
            account_code: source.account_code
          )

          if existing
            stats[:skipped] += 1
            next
          end

          XeroChartOfAccount.create!(
            company_group_id: to_group_id,
            account_code: source.account_code,
            account_name: source.account_name,
            account_type: source.account_type,
            tax_type: source.tax_type,
            description: source.description,
            active: true
          )
          stats[:created] += 1
        end

        render json: {
          success: true,
          stats: stats
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: {
          success: false,
          errors: [ e.message ]
        }, status: :unprocessable_entity
      end

      # GET /api/v1/xero_chart_of_accounts/with_company_presence
      # Returns accounts aggregated from ALL companies in the group with presence columns
      # This builds the view from per-company accounts (CorporateXeroAccount)
      # Required: company_id param to determine the company group
      def with_company_presence
        company = Corporate.find(params[:company_id])
        group = company.company_group

        # Get all companies in the group that have Xero connected
        companies_with_xero = if group
          group.corporate_companies
               .includes(:corporate_company_xero_connection)
               .select { |c| c.corporate_company_xero_connection&.connected? }
        else
          [ company ].select { |c| c.corporate_company_xero_connection&.connected? }
        end

        # Build map of account_code -> { account_data, company_ids }
        # Aggregates all unique accounts from all companies in the group
        accounts_map = {}
        companies_with_xero.each do |c|
          conn = c.corporate_company_xero_connection
          next unless conn

          scope = conn.corporate_company_xero_accounts
          scope = scope.where(status: "ACTIVE") unless params[:include_inactive] == "true"

          scope.each do |acct|
            code = acct.account_code
            if accounts_map[code]
              # Account exists in another company - add this company to presence
              accounts_map[code][:company_ids] << c.id
            else
              # First time seeing this account - store it
              accounts_map[code] = {
                account: acct,
                company_ids: [ c.id ]
              }
            end
          end
        end

        # Get Foundation ID for TeeemTableView
        foundation = Foundation.find_by(model_class: "CorporateXeroAccount")

        # Build enriched accounts with company presence columns
        enriched_accounts = accounts_map.values.map do |entry|
          acct = entry[:account]
          base = {
            id: acct.id,
            account_code: acct.account_code,
            account_name: acct.account_name,
            display_name: acct.display_name,
            account_type: acct.account_type,
            account_class: acct.account_class,
            tax_type: acct.tax_type,
            description: acct.description,
            status: acct.status,
            active: acct.status == "ACTIVE",
            consolidated_account_code: acct.consolidated_account_code,
            mapped: acct.mapped?
          }

          # Add company presence fields
          companies_with_xero.each do |c|
            base["company_#{c.id}"] = entry[:company_ids].include?(c.id)
          end

          base
        end

        # Sort by account code
        enriched_accounts.sort_by! { |a| a[:account_code] || "" }

        render json: {
          success: true,
          data: enriched_accounts,
          companies: companies_with_xero.map { |c|
            {
              id: c.id,
              name: c.name,
              short_name: c.name.split(" ").first
            }
          },
          meta: {
            total: enriched_accounts.count,
            foundation_id: foundation&.id,
            company_group: group&.name
          }
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: e.message }, status: :not_found
      rescue StandardError => e
        Rails.logger.error("[XeroChartOfAccountsController] with_company_presence error: #{e.message}")
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/xero_chart_of_accounts/company_accounts
      # Returns per-company Xero accounts with consolidated_account_code mapping
      def company_accounts
        company = Corporate.find(params[:company_id])
        connection = company.corporate_company_xero_connection

        unless connection
          return render json: {
            success: false,
            error: "No Xero connection for this company"
          }, status: :not_found
        end

        @accounts = connection.corporate_company_xero_accounts
        @accounts = @accounts.where(status: "ACTIVE") unless params[:include_inactive] == "true"
        @accounts = @accounts.order(:account_code)

        # Get Foundation for TeeemTableView
        foundation = Foundation.find_by(model_class: "CorporateXeroAccount")

        render json: {
          success: true,
          data: @accounts.map { |a| serialize_company_account(a) },
          meta: {
            total: @accounts.count,
            foundation_id: foundation&.id,
            company_name: company.name,
            xero_tenant_name: connection.xero_tenant_name,
            mapped_count: @accounts.mapped.count,
            unmapped_count: @accounts.unmapped.count
          }
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: e.message }, status: :not_found
      end

      private

      # Fetch account codes from each company's Xero
      def build_company_accounts_map(companies)
        client = XeroApiClient.new
        companies.each_with_object({}) do |company, map|
          connection = company.corporate_company_xero_connection
          next unless connection&.connected?

          begin
            connection.refresh_tokens! if connection.needs_refresh?
            result = client.get("Accounts", tenant_id: connection.xero_tenant_id, access_token: connection.access_token)

            if result[:success]
              codes = (result[:data]["Accounts"] || [])
                      .reject { |a| a["SystemAccount"].present? }
                      .map { |a| a["Code"] }
              map[company.id] = codes
            else
              Rails.logger.warn("[XeroChartOfAccountsController] Failed to fetch accounts for company #{company.id}: #{result[:error]}")
              map[company.id] = []
            end
          rescue StandardError => e
            Rails.logger.error("[XeroChartOfAccountsController] Error fetching accounts for company #{company.id}: #{e.message}")
            map[company.id] = []
          end
        end
      end

      def set_account
        @account = XeroChartOfAccount.find(params[:id])
      end

      def account_params
        params.require(:xero_chart_of_account).permit(
          :company_group_id,
          :account_code,
          :account_name,
          :account_type,
          :tax_type,
          :description,
          :active
        )
      end

      def serialize_account(account)
        {
          id: account.id,
          company_group_id: account.company_group_id,
          company_group_name: account.company_group&.name,
          account_code: account.account_code,
          account_name: account.account_name,
          display_name: account.display_name,
          account_type: account.account_type,
          tax_type: account.tax_type,
          description: account.description,
          active: account.active,
          created_at: account.created_at,
          updated_at: account.updated_at
        }
      end

      def serialize_company_account(account)
        {
          id: account.id,
          xero_account_id: account.xero_account_id,
          account_code: account.account_code,
          account_name: account.account_name,
          display_name: account.display_name,
          account_type: account.account_type,
          account_class: account.account_class,
          tax_type: account.tax_type,
          description: account.description,
          status: account.status,
          active: account.status == "ACTIVE",
          bank_account_number: account.bank_account_number,
          currency_code: account.currency_code,
          reporting_code: account.reporting_code,
          reporting_code_name: account.reporting_code_name,
          consolidated_account_code: account.consolidated_account_code,
          mapped: account.mapped?,
          synced_at: account.synced_at,
          created_at: account.created_at,
          updated_at: account.updated_at
        }
      end

      def account_summary
        {
          total_accounts: @accounts.count,
          by_type: @accounts.group(:account_type).count,
          groups: CompanyGroup.all.map { |g|
            { id: g.id, name: g.name, accounts_count: g.xero_chart_of_accounts.count }
          }
        }
      end
    end
  end
end
