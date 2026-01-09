# frozen_string_literal: true

module Gl
  module Reports
    # Trial Balance Report
    #
    # Generates a Trial Balance showing all accounts with debit/credit balances.
    # The trial balance should always be in balance (total debits = total credits).
    #
    # Usage:
    #   report = Gl::Reports::TrialBalance.new(corporate_company, provider: 'xero', tenant_id: 'abc')
    #   result = report.generate(as_of_date: Date.current)
    #
    class TrialBalance
      attr_reader :corporate_company, :external_provider, :external_tenant_id

      # Account types with debit normal balance
      DEBIT_NORMAL_TYPES = %w[asset expense].freeze

      def initialize(corporate_company, provider: nil, tenant_id: nil)
        @corporate_company = corporate_company
        @external_provider = provider
        @external_tenant_id = tenant_id
      end

      # Generate trial balance as of a date
      def generate(as_of_date:, show_zero_balances: false)
        calculator = Gl::BalanceCalculator.new(
          corporate_company,
          provider: external_provider,
          tenant_id: external_tenant_id
        )

        accounts = scoped_accounts.active.order(:code)

        lines = accounts.map do |account|
          balance = calculator.balance_at(account, as_of_date)
          next if balance.zero? && !show_zero_balances

          debit, credit = balance_to_debit_credit(account, balance)

          {
            account_id: account.id,
            code: account.code,
            name: account.name,
            account_type: account.account_type,
            account_class: account.account_class,
            debit: debit,
            credit: credit,
            balance: balance
          }
        end.compact

        total_debits = lines.sum { |l| l[:debit] || 0 }
        total_credits = lines.sum { |l| l[:credit] || 0 }
        difference = (total_debits - total_credits).abs

        {
          report_type: 'trial_balance',
          as_of_date: as_of_date,
          generated_at: Time.current,
          provider: external_provider,
          tenant_id: external_tenant_id,

          # Grouped by account type
          sections: {
            assets: lines.select { |l| l[:account_type] == 'asset' },
            liabilities: lines.select { |l| l[:account_type] == 'liability' },
            equity: lines.select { |l| l[:account_type] == 'equity' },
            revenue: lines.select { |l| l[:account_type] == 'revenue' },
            expenses: lines.select { |l| l[:account_type] == 'expense' }
          },

          # All accounts
          accounts: lines,

          # Totals
          summary: {
            total_debits: total_debits,
            total_credits: total_credits,
            difference: difference,
            balanced: difference < 0.01,
            account_count: lines.count
          }
        }
      end

      # Generate comparison trial balance
      def generate_comparative(as_of_date:, compare_date:)
        current = generate(as_of_date: as_of_date)
        prior = generate(as_of_date: compare_date)

        # Merge the two trial balances
        all_codes = (current[:accounts].map { |a| a[:code] } +
                     prior[:accounts].map { |a| a[:code] }).uniq.sort

        comparative = all_codes.map do |code|
          current_line = current[:accounts].find { |a| a[:code] == code }
          prior_line = prior[:accounts].find { |a| a[:code] == code }

          current_balance = current_line&.dig(:balance) || 0
          prior_balance = prior_line&.dig(:balance) || 0
          movement = current_balance - prior_balance

          {
            code: code,
            name: current_line&.dig(:name) || prior_line&.dig(:name),
            account_type: current_line&.dig(:account_type) || prior_line&.dig(:account_type),
            current_balance: current_balance,
            prior_balance: prior_balance,
            movement: movement,
            movement_percentage: prior_balance.nonzero? ?
              ((movement / prior_balance) * 100).round(2) : nil
          }
        end

        {
          report_type: 'trial_balance_comparative',
          current_date: as_of_date,
          compare_date: compare_date,
          generated_at: Time.current,
          accounts: comparative,
          summary: {
            current: current[:summary],
            prior: prior[:summary]
          }
        }
      end

      # Validate that the trial balance is balanced
      def validate(as_of_date: Date.current)
        result = generate(as_of_date: as_of_date)

        if result[:summary][:balanced]
          { valid: true, message: 'Trial balance is balanced' }
        else
          {
            valid: false,
            message: "Trial balance is out of balance by $#{result[:summary][:difference]}",
            difference: result[:summary][:difference],
            total_debits: result[:summary][:total_debits],
            total_credits: result[:summary][:total_credits]
          }
        end
      end

      private

      def balance_to_debit_credit(account, balance)
        if debit_normal?(account)
          # Debit normal: positive balance = debit, negative = credit
          if balance >= 0
            [balance, nil]
          else
            [nil, balance.abs]
          end
        else
          # Credit normal: positive balance = credit, negative = debit
          if balance >= 0
            [nil, balance]
          else
            [balance.abs, nil]
          end
        end
      end

      def debit_normal?(account)
        DEBIT_NORMAL_TYPES.include?(account.account_type)
      end

      def scoped_accounts
        scope = Gl::Account.where(corporate_company: corporate_company)
        if external_provider
          scope = scope.where(external_provider: external_provider, external_tenant_id: external_tenant_id)
        else
          scope = scope.where(external_provider: nil)
        end
        scope
      end
    end
  end
end
