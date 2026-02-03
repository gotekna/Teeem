# frozen_string_literal: true

module Api
  module V1
    module Gl
      class ReportsController < ApplicationController
        before_action :set_corporate

        # GET /api/v1/gl/reports/profit_loss
        def profit_loss
          from_date = params[:from_date]&.to_date || fy_start_date
          to_date = params[:to_date]&.to_date || Date.current
          compare = params[:compare] == 'true'

          report = ::Gl::Reports::ProfitLoss.new(
            @corporate,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          result = report.generate(
            from_date: from_date,
            to_date: to_date,
            compare_prior_period: compare
          )

          render json: { success: true, data: result }
        end

        # GET /api/v1/gl/reports/profit_loss_ytd
        def profit_loss_ytd
          report = ::Gl::Reports::ProfitLoss.new(
            @corporate,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          result = report.generate_ytd(as_of_date: Date.current)

          render json: { success: true, data: result }
        end

        # GET /api/v1/gl/reports/profit_loss_monthly
        def profit_loss_monthly
          financial_year = params[:financial_year] || ::Gl::Period.financial_year_for(Date.current)

          report = ::Gl::Reports::ProfitLoss.new(
            @corporate,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          result = report.generate_monthly(financial_year)

          render json: { success: true, data: result }
        end

        # GET /api/v1/gl/reports/balance_sheet
        def balance_sheet
          as_of_date = params[:as_of_date]&.to_date || Date.current
          compare_date = params[:compare_date]&.to_date

          report = ::Gl::Reports::BalanceSheet.new(
            @corporate,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          result = report.generate(
            as_of_date: as_of_date,
            compare_prior_date: compare_date
          )

          render json: { success: true, data: result }
        end

        # GET /api/v1/gl/reports/trial_balance
        def trial_balance
          as_of_date = params[:as_of_date]&.to_date || Date.current
          show_zero = params[:show_zero_balances] == 'true'

          report = ::Gl::Reports::TrialBalance.new(
            @corporate,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          result = report.generate(
            as_of_date: as_of_date,
            show_zero_balances: show_zero
          )

          render json: { success: true, data: result }
        end

        # GET /api/v1/gl/reports/trial_balance_comparative
        def trial_balance_comparative
          as_of_date = params[:as_of_date]&.to_date || Date.current
          compare_date = params[:compare_date]&.to_date || (as_of_date - 1.year)

          report = ::Gl::Reports::TrialBalance.new(
            @corporate,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          result = report.generate_comparative(
            as_of_date: as_of_date,
            compare_date: compare_date
          )

          render json: { success: true, data: result }
        end

        # GET /api/v1/gl/reports/bank_statement
        def bank_statement
          account = find_bank_account
          return unless account

          from_date = params[:from_date]&.to_date || 30.days.ago.to_date
          to_date = params[:to_date]&.to_date || Date.current

          report = ::Gl::Reports::BankStatement.new(
            @corporate,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          result = report.generate(
            account: account,
            from_date: from_date,
            to_date: to_date
          )

          render json: { success: true, data: result }
        end

        # GET /api/v1/gl/reports/bank_summary
        def bank_summary
          from_date = params[:from_date]&.to_date || 30.days.ago.to_date
          to_date = params[:to_date]&.to_date || Date.current

          report = ::Gl::Reports::BankStatement.new(
            @corporate,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          result = report.generate_all(
            from_date: from_date,
            to_date: to_date
          )

          render json: { success: true, data: result }
        end

        # GET /api/v1/gl/reports/account_ledger
        def account_ledger
          account = find_account
          return unless account

          from_date = params[:from_date]&.to_date || 30.days.ago.to_date
          to_date = params[:to_date]&.to_date || Date.current

          calculator = ::Gl::BalanceCalculator.new(
            @corporate,
            provider: params[:provider],
            tenant_id: params[:tenant_id]
          )

          transactions = calculator.running_balance(account, from_date, to_date)

          render json: {
            success: true,
            data: {
              account: {
                id: account.id,
                code: account.code,
                name: account.name,
                account_type: account.account_type
              },
              from_date: from_date,
              to_date: to_date,
              opening_balance: transactions.first&.dig(:balance),
              closing_balance: transactions.last&.dig(:balance),
              transaction_count: transactions.count - 1,
              transactions: transactions
            }
          }
        end

        private

        def set_corporate
          @corporate = Corporate.find(params[:corporate_id] || current_user&.corporate_id)
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: 'Company not found' }, status: :not_found
        end

        def find_account
          account = scoped_accounts.find_by(id: params[:account_id])

          unless account
            render json: { success: false, error: 'Account not found' }, status: :not_found
            return nil
          end

          account
        end

        def find_bank_account
          account = scoped_accounts.find_by(id: params[:account_id], is_bank_account: true)

          unless account
            render json: { success: false, error: 'Bank account not found' }, status: :not_found
            return nil
          end

          account
        end

        def scoped_accounts
          scope = ::Gl::Account.where(corporate: @corporate)

          if params[:provider].present?
            scope = scope.where(external_provider: params[:provider], external_tenant_id: params[:tenant_id])
          else
            scope = scope.where(external_provider: nil)
          end

          scope
        end

        def fy_start_date
          fy = ::Gl::Period.financial_year_for(Date.current)
          year = fy.gsub('FY', '').to_i - 1
          Date.new(year, 7, 1)
        end
      end
    end
  end
end
