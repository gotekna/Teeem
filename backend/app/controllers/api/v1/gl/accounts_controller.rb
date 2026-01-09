# frozen_string_literal: true

module Api
  module V1
    module Gl
      class AccountsController < ApplicationController
        before_action :set_corporate_company, except: [:chart, :index]
        before_action :set_account, only: [:show, :update, :ledger]

        # GET /api/v1/gl/accounts
        def index
          # Query directly by provider/tenant - no corporate company required
          scope = ::Gl::Account.all
          if params[:provider].present?
            scope = scope.where(external_provider: params[:provider], external_tenant_id: params[:tenant_id])
          end
          accounts = scope.includes(:parent_account).order(:code)

          # Filters
          accounts = accounts.where(account_type: params[:account_type]) if params[:account_type].present?
          accounts = accounts.where(account_class: params[:account_class]) if params[:account_class].present?
          accounts = accounts.where(is_bank_account: true) if params[:bank_accounts_only] == 'true'
          accounts = accounts.where(active: true) if params[:active_only] == 'true'

          render json: {
            success: true,
            data: accounts.map { |a| chart_account_json(a) },
            meta: {
              total: accounts.count,
              provider: params[:provider],
              tenant_id: params[:tenant_id]
            }
          }
        rescue ActiveRecord::StatementInvalid
          # Table columns may not exist yet
          render json: { success: true, data: [], meta: { total: 0, provider: params[:provider], tenant_id: params[:tenant_id] } }
        end

        # GET /api/v1/gl/accounts/:id
        def show
          render json: {
            success: true,
            data: account_json(@account, include_balance: true)
          }
        end

        # POST /api/v1/gl/accounts
        def create
          account = ::Gl::Account.new(account_params)
          account.corporate_company = @corporate_company
          account.external_provider = params[:provider]
          account.external_tenant_id = params[:tenant_id]

          if account.save
            render json: {
              success: true,
              message: 'Account created successfully',
              data: account_json(account)
            }, status: :created
          else
            render json: {
              success: false,
              error: account.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # PATCH/PUT /api/v1/gl/accounts/:id
        def update
          if @account.update(account_params)
            render json: {
              success: true,
              message: 'Account updated successfully',
              data: account_json(@account)
            }
          else
            render json: {
              success: false,
              error: @account.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/accounts/:id/ledger
        # Returns transaction history with running balance
        def ledger
          from_date = params[:from_date]&.to_date || 30.days.ago.to_date
          to_date = params[:to_date]&.to_date || Date.current

          calculator = ::Gl::BalanceCalculator.new(
            @corporate_company,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          transactions = calculator.running_balance(@account, from_date, to_date)

          render json: {
            success: true,
            data: {
              account: account_json(@account),
              from_date: from_date,
              to_date: to_date,
              opening_balance: transactions.first&.dig(:balance),
              closing_balance: transactions.last&.dig(:balance),
              transactions: transactions
            }
          }
        end

        # GET /api/v1/gl/accounts/chart
        # Returns hierarchical chart of accounts
        def chart
          # Query directly by provider/tenant - no corporate company required
          scope = ::Gl::Account.all
          if params[:provider].present?
            scope = scope.where(external_provider: params[:provider], external_tenant_id: params[:tenant_id])
          end
          accounts = scope.where(active: true).order(:code)

          grouped = accounts.group_by(&:account_type)

          render json: {
            success: true,
            data: {
              assets: grouped['asset']&.map { |a| chart_account_json(a) } || [],
              liabilities: grouped['liability']&.map { |a| chart_account_json(a) } || [],
              equity: grouped['equity']&.map { |a| chart_account_json(a) } || [],
              revenue: grouped['revenue']&.map { |a| chart_account_json(a) } || [],
              expenses: grouped['expense']&.map { |a| chart_account_json(a) } || []
            }
          }
        rescue ActiveRecord::StatementInvalid
          # Table columns may not exist yet
          render json: {
            success: true,
            data: { assets: [], liabilities: [], equity: [], revenue: [], expenses: [] }
          }
        end

        # GET /api/v1/gl/accounts/bank_accounts
        # Returns only bank accounts with balances
        def bank_accounts
          accounts = scoped_accounts.where(is_bank_account: true).active.order(:code)

          calculator = ::Gl::BalanceCalculator.new(
            @corporate_company,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          data = accounts.map do |account|
            json = account_json(account)
            json[:current_balance] = calculator.current_balance(account)
            json
          end

          render json: {
            success: true,
            data: data,
            meta: {
              total_balance: data.sum { |a| a[:current_balance] }
            }
          }
        end

        private

        def set_corporate_company
          @corporate_company = CorporateCompany.find(params[:corporate_company_id] || current_user&.corporate_company_id)
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: 'Company not found' }, status: :not_found
        end

        def set_account
          @account = scoped_accounts.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: 'Account not found' }, status: :not_found
        end

        def scoped_accounts
          scope = ::Gl::Account.where(corporate_company: @corporate_company)

          if params[:provider].present?
            scope = scope.where(external_provider: params[:provider], external_tenant_id: params[:tenant_id])
          else
            scope = scope.where(external_provider: nil)
          end

          scope
        end

        def account_params
          params.require(:account).permit(
            :code, :name, :description, :account_type, :account_class,
            :system_account, :tax_type, :is_bank_account, :active,
            :currency_code, :parent_account_id, :display_order
          )
        end

        def account_json(account, include_balance: false)
          json = chart_account_json(account)

          if include_balance
            calculator = ::Gl::BalanceCalculator.new(
              @corporate_company,
              provider: account.external_provider,
              tenant_id: account.external_tenant_id
            )
            json[:current_balance] = calculator.current_balance(account)
          end

          json
        end

        # Simplified account JSON that doesn't require @corporate_company
        def chart_account_json(account)
          {
            id: account.id,
            code: account.code,
            name: account.name,
            description: account.description,
            account_type: account.account_type,
            account_class: account.account_class,
            system_account: account.system_account,
            tax_type: account.tax_type,
            is_bank_account: account.is_bank_account,
            is_system_account: account.is_system_account,
            active: account.active,
            currency_code: account.currency_code,
            external_provider: account.external_provider,
            external_account_id: account.external_account_id,
            parent_account_id: account.parent_account_id
          }
        end
      end
    end
  end
end
