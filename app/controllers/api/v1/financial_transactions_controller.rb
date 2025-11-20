module Api
  module V1
    class FinancialTransactionsController < ApplicationController
      before_action :set_transaction, only: [:show, :update, :destroy, :post]
      before_action :set_company, only: [:index, :create]

      # GET /api/v1/financial_transactions
      def index
        @transactions = FinancialTransaction.all
        @transactions = @transactions.for_company(@company.id) if @company

        # Apply filters
        @transactions = apply_filters(@transactions)

        # Pagination
        page = params[:page]&.to_i || 1
        per_page = params[:per_page]&.to_i || 50
        @transactions = @transactions.recent.offset((page - 1) * per_page).limit(per_page)

        # Include related records for efficiency
        @transactions = @transactions.includes(:user, :construction, :keepr_journal)

        render json: {
          success: true,
          transactions: @transactions.map { |t| transaction_json(t) },
          total: FinancialTransaction.for_company(@company.id).count,
          page: page,
          per_page: per_page
        }
      end

      # GET /api/v1/financial_transactions/:id
      def show
        render json: {
          success: true,
          transaction: transaction_json(@transaction, include_receipt: true)
        }
      end

      # POST /api/v1/financial_transactions
      def create
        service = FinancialTransactionService.new(user: current_user, company: @company)

        transaction = if params[:transaction_type] == 'income'
                       service.create_income(transaction_params)
                     else
                       service.create_expense(transaction_params)
                     end

        render json: {
          success: true,
          transaction: transaction_json(transaction),
          message: "Transaction created successfully"
        }, status: :created
      rescue FinancialTransactionService::TransactionError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # PUT /api/v1/financial_transactions/:id
      def update
        service = FinancialTransactionService.new(user: current_user, company: @transaction.company)

        service.update_transaction(@transaction, transaction_params)

        render json: {
          success: true,
          transaction: transaction_json(@transaction.reload),
          message: "Transaction updated successfully"
        }
      rescue FinancialTransactionService::TransactionError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # DELETE /api/v1/financial_transactions/:id
      def destroy
        service = FinancialTransactionService.new(user: current_user, company: @transaction.company)

        service.delete_transaction(@transaction)

        render json: {
          success: true,
          message: "Transaction deleted successfully"
        }
      rescue FinancialTransactionService::TransactionError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # POST /api/v1/financial_transactions/:id/post
      def post
        service = FinancialTransactionService.new(user: current_user, company: @transaction.company)

        service.post_transaction(@transaction)

        render json: {
          success: true,
          transaction: transaction_json(@transaction.reload),
          message: "Transaction posted successfully"
        }
      rescue FinancialTransactionService::TransactionError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # GET /api/v1/financial_transactions/summary
      def summary
        company = Company.find(params[:company_id]) if params[:company_id]
        scope = FinancialTransaction.posted
        scope = scope.for_company(company.id) if company

        # Current month
        current_month = scope.by_month(Date.current)

        render json: {
          success: true,
          summary: {
            current_month: {
              income: current_month.income_total,
              expenses: current_month.expense_total,
              net_profit: current_month.net_profit
            },
            year_to_date: {
              income: scope.by_year.income_total,
              expenses: scope.by_year.expense_total,
              net_profit: scope.by_year.net_profit
            },
            all_time: {
              income: scope.income_total,
              expenses: scope.expense_total,
              net_profit: scope.net_profit
            }
          }
        }
      end

      # GET /api/v1/financial_transactions/categories
      def categories
        transaction_type = params[:transaction_type] || 'expense'

        render json: {
          success: true,
          categories: FinancialTransaction.categories_for_type(transaction_type)
        }
      end

      private

      def set_transaction
        @transaction = FinancialTransaction.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Transaction not found"
        }, status: :not_found
      end

      def set_company
        @company = if params[:company_id]
                    Company.find(params[:company_id])
                  else
                    current_user.company
                  end
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Company not found"
        }, status: :not_found
      end

      def transaction_params
        params.require(:transaction).permit(
          :transaction_type,
          :amount,
          :transaction_date,
          :description,
          :category,
          :construction_id,
          :auto_post,
          :receipt
        )
      end

      def apply_filters(scope)
        # Filter by transaction type
        scope = scope.where(transaction_type: params[:transaction_type]) if params[:transaction_type].present?

        # Filter by status
        scope = scope.where(status: params[:status]) if params[:status].present?

        # Filter by category
        scope = scope.where(category: params[:category]) if params[:category].present?

        # Filter by job
        scope = scope.for_job(params[:construction_id]) if params[:construction_id].present?

        # Filter by date range
        if params[:from_date].present?
          scope = scope.where('transaction_date >= ?', Date.parse(params[:from_date]))
        end

        if params[:to_date].present?
          scope = scope.where('transaction_date <= ?', Date.parse(params[:to_date]))
        end

        # Search by description
        if params[:search].present?
          scope = scope.where('description ILIKE ?', "%#{params[:search]}%")
        end

        scope
      end

      def transaction_json(transaction, include_receipt: false)
        data = {
          id: transaction.id,
          transaction_type: transaction.transaction_type,
          amount: transaction.amount.to_f,
          transaction_date: transaction.transaction_date.iso8601,
          description: transaction.description,
          category: transaction.category,
          status: transaction.status,
          construction_id: transaction.construction_id,
          construction_name: transaction.construction&.name,
          user_id: transaction.user_id,
          user_email: transaction.user.email,
          company_id: transaction.company_id,
          keepr_journal_id: transaction.keepr_journal_id,
          external_system_id: transaction.external_system_id,
          external_system_type: transaction.external_system_type,
          synced_at: transaction.synced_at&.iso8601,
          created_at: transaction.created_at.iso8601,
          updated_at: transaction.updated_at.iso8601,
          can_edit: transaction.can_edit?,
          can_delete: transaction.can_delete?
        }

        if include_receipt && transaction.receipt.attached?
          data[:receipt] = {
            url: rails_blob_url(transaction.receipt),
            filename: transaction.receipt.filename.to_s,
            content_type: transaction.receipt.content_type,
            byte_size: transaction.receipt.byte_size
          }
        end

        data
      end
    end
  end
end
