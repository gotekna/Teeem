module Api
  module V1
    # Renamed from XeroBankTransactionsController (Jan 2026)
    class XeroBankTransactionsController < ApplicationController
      # GET /api/v1/xero_bank_transactions
      # List bank transactions with filtering
      def index
        transactions = XeroBankTransaction.active

        # Filter by bank account (single or multiple)
        if params[:bank_account_id].present?
          transactions = transactions.for_bank_account(params[:bank_account_id])
        elsif params[:bank_account_ids].present?
          # Support filtering by multiple bank account IDs (comma-separated)
          account_ids = params[:bank_account_ids].split(",").map(&:strip)
          transactions = transactions.where(bank_account_id: account_ids)
        end

        if params[:bank_account_name].present?
          transactions = transactions.for_bank_account_name(params[:bank_account_name])
        end

        # Filter by date range
        if params[:start_date].present? && params[:end_date].present?
          transactions = transactions.in_date_range(
            Date.parse(params[:start_date]),
            Date.parse(params[:end_date])
          )
        end

        # Filter by financial year
        if params[:financial_year].present?
          transactions = transactions.for_financial_year(params[:financial_year])
        end

        # Filter by month
        if params[:year].present? && params[:month].present?
          transactions = transactions.for_month(params[:year].to_i, params[:month].to_i)
        end

        # Filter by type (RECEIVE/SPEND)
        transactions = transactions.where(transaction_type: params[:type]) if params[:type].present?

        # Filter by reconciled status
        if params[:reconciled].present?
          transactions = params[:reconciled] == "true" ? transactions.reconciled : transactions.unreconciled
        end

        # Search
        transactions = transactions.search(params[:q]) if params[:q].present?

        # Filter by contact
        transactions = transactions.where(contact_id: params[:contact_id]) if params[:contact_id].present?

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i.clamp(1, 500)

        total_count = transactions.count
        transactions = transactions.order(transaction_date: :desc, id: :desc)
                                   .offset((page - 1) * per_page)
                                   .limit(per_page)

        render json: {
          success: true,
          data: transactions.map { |txn| serialize_transaction(txn) },
          meta: {
            total_count: total_count,
            page: page,
            per_page: per_page,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/xero_bank_transactions/:id
      def show
        transaction = XeroBankTransaction.find(params[:id])

        render json: {
          success: true,
          data: serialize_transaction(transaction, include_details: true)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Transaction not found" }, status: :not_found
      end

      # GET /api/v1/xero_bank_transactions/bank_accounts
      # List distinct bank accounts
      def bank_accounts
        accounts = XeroBankTransaction.bank_accounts

        render json: {
          success: true,
          data: accounts
        }
      end

      # GET /api/v1/xero_bank_transactions/financial_years
      # List available financial years
      def financial_years
        years = XeroBankTransaction.available_financial_years

        render json: {
          success: true,
          data: years
        }
      end

      # GET /api/v1/xero_bank_transactions/monthly_summary
      # Get monthly totals
      def monthly_summary
        # Filter by bank account if provided
        scope = XeroBankTransaction.active
        scope = scope.for_bank_account(params[:bank_account_id]) if params[:bank_account_id].present?
        scope = scope.for_financial_year(params[:financial_year]) if params[:financial_year].present?

        summary = scope.group(:transaction_year, :transaction_month, :transaction_type)
                       .select(
                         :transaction_year,
                         :transaction_month,
                         :transaction_type,
                         "SUM(total) as total_amount",
                         "COUNT(*) as transaction_count"
                       )
                       .map do |row|
          {
            year: row.transaction_year,
            month: row.transaction_month,
            type: row.transaction_type,
            total_amount: row.total_amount.to_f,
            count: row.transaction_count
          }
        end

        render json: {
          success: true,
          data: summary
        }
      end

      # GET /api/v1/xero_bank_transactions/sync_status
      def sync_status
        sync_record = XeroSyncStatus.find_by(sync_type: "bank_transactions")

        render json: {
          success: true,
          data: {
            total_transactions: XeroBankTransaction.count,
            receives_count: XeroBankTransaction.receives.count,
            spends_count: XeroBankTransaction.spends.count,
            reconciled_count: XeroBankTransaction.reconciled.count,
            by_bank_account: XeroBankTransaction.group(:bank_account_name).count,
            by_financial_year: XeroBankTransaction.group(:financial_year).count,
            last_synced_at: sync_record&.last_synced_at&.iso8601,
            next_sync_at: sync_record&.next_sync_at&.iso8601,
            sync_status: sync_record&.status
          }
        }
      end

      # POST /api/v1/xero_bank_transactions/trigger_sync
      def trigger_sync
        result = XeroBankTransactionSyncJob.perform_now

        render json: {
          success: result[:errors].empty?,
          data: result
        }
      rescue StandardError => e
        Rails.logger.error("Bank transaction sync trigger failed: #{e.message}")
        render json: {
          success: false,
          error: "Sync failed: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/xero_bank_transactions/download_report
      # Generate and download a PDF transaction report
      def download_report
        service = BankTransactionReportService.new(
          bank_account_id: params[:bank_account_id],
          financial_year: params[:financial_year],
          month: params[:month].present? ? params[:month].to_i : nil,
          start_date: params[:start_date].present? ? Date.parse(params[:start_date]) : nil,
          end_date: params[:end_date].present? ? Date.parse(params[:end_date]) : nil
        )

        result = service.generate

        if result[:success]
          send_data result[:pdf],
                    filename: result[:filename],
                    type: "application/pdf",
                    disposition: "attachment"
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      rescue StandardError => e
        Rails.logger.error("PDF report generation failed: #{e.message}")
        Rails.logger.error(e.backtrace.first(10).join("\n"))
        render json: {
          success: false,
          error: "Failed to generate report: #{e.message}"
        }, status: :internal_server_error
      end

      private

      def serialize_transaction(txn, include_details: false)
        data = {
          id: txn.id,
          xero_id: txn.xero_id,
          bank_account_id: txn.bank_account_id,
          bank_account_code: txn.bank_account_code,
          bank_account_name: txn.bank_account_name,
          transaction_type: txn.transaction_type,
          type_display: txn.type_display,
          transaction_date: txn.transaction_date,
          reference: txn.reference,
          status: txn.status,
          is_reconciled: txn.is_reconciled,
          contact_id: txn.contact_id,
          contact_name: txn.contact_name,
          description: txn.description,
          sub_total: txn.sub_total&.to_f,
          total_tax: txn.total_tax&.to_f,
          total: txn.total&.to_f,
          signed_total: txn.signed_total&.to_f,
          currency_code: txn.currency_code,
          financial_year: txn.financial_year,
          transaction_month: txn.transaction_month,
          transaction_year: txn.transaction_year,
          has_attachments: txn.has_attachments,
          last_synced_at: txn.last_synced_at&.iso8601
        }

        if include_details
          data[:line_items] = txn.line_items
          data[:xero_updated_at] = txn.xero_updated_at&.iso8601
          data[:created_at] = txn.created_at.iso8601
          data[:updated_at] = txn.updated_at.iso8601
        end

        data
      end
    end
  end
end
