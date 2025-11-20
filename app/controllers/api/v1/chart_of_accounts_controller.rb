module Api
  module V1
    class ChartOfAccountsController < ApplicationController
      before_action :set_account, only: [:show, :update, :destroy]
      before_action :require_admin, except: [:index, :show]

      # GET /api/v1/chart_of_accounts
      def index
        @accounts = Keepr::Account.order(:number)

        # Apply filters
        @accounts = @accounts.where(kind: params[:kind]) if params[:kind].present?

        # Search by name or number
        if params[:search].present?
          @accounts = @accounts.where(
            'name ILIKE ? OR CAST(number AS TEXT) LIKE ?',
            "%#{params[:search]}%",
            "%#{params[:search]}%"
          )
        end

        render json: {
          success: true,
          accounts: @accounts.map { |account| account_json(account) }
        }
      end

      # GET /api/v1/chart_of_accounts/:id
      def show
        render json: {
          success: true,
          account: account_json(@account, include_balance: true)
        }
      end

      # POST /api/v1/chart_of_accounts
      def create
        @account = Keepr::Account.new(account_params)

        if @account.save
          render json: {
            success: true,
            account: account_json(@account),
            message: "Account created successfully"
          }, status: :created
        else
          render json: {
            success: false,
            errors: @account.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/chart_of_accounts/:id
      def update
        if @account.update(account_params)
          render json: {
            success: true,
            account: account_json(@account),
            message: "Account updated successfully"
          }
        else
          render json: {
            success: false,
            errors: @account.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/chart_of_accounts/:id
      def destroy
        # Check if account has transactions
        if @account.keepr_postings.exists?
          render json: {
            success: false,
            error: "Cannot delete account with existing transactions. Deactivate it instead."
          }, status: :unprocessable_entity
          return
        end

        @account.destroy

        render json: {
          success: true,
          message: "Account deleted successfully"
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to delete account: #{e.message}"
        }, status: :unprocessable_entity
      end

      # GET /api/v1/chart_of_accounts/kinds
      def kinds
        render json: {
          success: true,
          kinds: ['asset', 'liability', 'revenue', 'expense', 'forward', 'debtor', 'creditor']
        }
      end

      # GET /api/v1/chart_of_accounts/:id/balance
      def balance
        set_account

        from_date = params[:from_date] ? Date.parse(params[:from_date]) : Date.new(1970, 1, 1)
        to_date = params[:to_date] ? Date.parse(params[:to_date]) : Date.current
        date_range = (from_date..to_date)

        balance = @account.balance(date_range)

        render json: {
          success: true,
          account_id: @account.id,
          account_number: @account.number,
          account_name: @account.name,
          balance: balance.to_f,
          from_date: from_date.iso8601,
          to_date: to_date.iso8601
        }
      rescue Date::Error => e
        render json: {
          success: false,
          error: "Invalid date format: #{e.message}"
        }, status: :unprocessable_entity
      end

      private

      def set_account
        @account = Keepr::Account.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Account not found"
        }, status: :not_found
      end

      def account_params
        params.require(:account).permit(
          :number,
          :name,
          :kind,
          :keepr_group_id
        )
      end

      def require_admin
        unless current_user.admin?
          render json: {
            success: false,
            error: "Admin access required"
          }, status: :forbidden
        end
      end

      def account_json(account, include_balance: false)
        data = {
          id: account.id,
          number: account.number,
          name: account.name,
          kind: account.kind,
          keepr_group_id: account.keepr_group_id,
          group_name: account.keepr_group&.name,
          created_at: account.created_at&.iso8601,
          updated_at: account.updated_at&.iso8601
        }

        if include_balance
          balance = account.balance.to_f
          data[:balance] = balance
          data[:has_transactions] = account.keepr_postings.exists?
        end

        data
      end
    end
  end
end
