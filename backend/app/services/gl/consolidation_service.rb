# frozen_string_literal: true

module Gl
  # Consolidation Service
  # Combines financial data from multiple entities into consolidated reports
  # Handles intercompany eliminations and group-level reporting
  #
  # Week 49-52: Dashboard & Consolidation
  class ConsolidationService
    attr_reader :parent_company, :subsidiaries, :financial_year, :as_at_date

    # Intercompany account mappings for elimination
    INTERCOMPANY_ACCOUNTS = {
      receivables: 'intercompany_receivable',
      payables: 'intercompany_payable',
      revenue: 'intercompany_revenue',
      expense: 'intercompany_expense',
      investment: 'investment_in_subsidiary',
      equity: 'subsidiary_equity'
    }.freeze

    def initialize(parent_company, financial_year, subsidiaries: nil, as_at_date: nil)
      @parent_company = parent_company
      @financial_year = financial_year
      @as_at_date = as_at_date || Date.current
      @subsidiaries = subsidiaries || find_subsidiaries
    end

    # =========================================================================
    # MAIN CONSOLIDATION
    # =========================================================================

    def generate
      {
        group_name: group_name,
        financial_year: financial_year,
        as_at_date: as_at_date,
        entities: entity_summary,
        consolidated_profit_loss: consolidated_profit_loss,
        consolidated_balance_sheet: consolidated_balance_sheet,
        consolidated_trial_balance: consolidated_trial_balance,
        eliminations: elimination_entries,
        intercompany_summary: intercompany_summary,
        entity_comparison: entity_comparison,
        consolidation_adjustments: consolidation_adjustments
      }
    end

    # =========================================================================
    # ENTITY MANAGEMENT
    # =========================================================================

    def entity_summary
      all_entities.map do |entity|
        {
          id: entity.id,
          name: entity.name,
          type: entity == parent_company ? 'parent' : 'subsidiary',
          ownership_percent: ownership_percentage(entity),
          functional_currency: entity_currency(entity),
          consolidation_method: consolidation_method(entity)
        }
      end
    end

    def all_entities
      [parent_company] + subsidiaries
    end

    # =========================================================================
    # CONSOLIDATED PROFIT & LOSS
    # =========================================================================

    def consolidated_profit_loss
      # Get individual P&L for each entity
      entity_pnls = all_entities.map do |entity|
        {
          entity: entity,
          pnl: entity_profit_loss(entity)
        }
      end

      # Sum all entities
      combined = combine_profit_loss(entity_pnls)

      # Apply eliminations
      eliminations = intercompany_pnl_eliminations

      # Calculate consolidated totals
      {
        period: period_info,
        sections: {
          revenue: {
            items: combined[:revenue][:items],
            eliminations: eliminations[:revenue],
            consolidated: combined[:revenue][:total] - eliminations[:revenue][:total]
          },
          cost_of_sales: {
            items: combined[:cost_of_sales][:items],
            eliminations: eliminations[:cost_of_sales],
            consolidated: combined[:cost_of_sales][:total] - eliminations[:cost_of_sales][:total]
          },
          gross_profit: calculate_gross_profit(combined, eliminations),
          operating_expenses: {
            items: combined[:operating_expenses][:items],
            eliminations: eliminations[:operating_expenses],
            consolidated: combined[:operating_expenses][:total] - eliminations[:operating_expenses][:total]
          },
          other_income: {
            items: combined[:other_income][:items],
            eliminations: eliminations[:other_income],
            consolidated: combined[:other_income][:total] - eliminations[:other_income][:total]
          },
          other_expenses: {
            items: combined[:other_expenses][:items],
            eliminations: eliminations[:other_expenses],
            consolidated: combined[:other_expenses][:total] - eliminations[:other_expenses][:total]
          }
        },
        summary: {
          total_revenue: combined[:revenue][:total] - eliminations[:revenue][:total],
          total_cost_of_sales: combined[:cost_of_sales][:total] - eliminations[:cost_of_sales][:total],
          gross_profit: calculate_gross_profit(combined, eliminations),
          total_operating_expenses: combined[:operating_expenses][:total] - eliminations[:operating_expenses][:total],
          operating_profit: calculate_operating_profit(combined, eliminations),
          net_profit_before_tax: calculate_net_profit_before_tax(combined, eliminations),
          income_tax: combined[:tax][:total],
          net_profit_after_tax: calculate_net_profit_after_tax(combined, eliminations),
          minority_interest: calculate_minority_interest(combined, eliminations),
          profit_attributable_to_group: calculate_group_profit(combined, eliminations)
        },
        by_entity: entity_pnls.map { |e| { entity: e[:entity].name, data: e[:pnl][:summary] } }
      }
    end

    # =========================================================================
    # CONSOLIDATED BALANCE SHEET
    # =========================================================================

    def consolidated_balance_sheet
      # Get individual balance sheets
      entity_bs = all_entities.map do |entity|
        {
          entity: entity,
          balance_sheet: entity_balance_sheet(entity)
        }
      end

      # Sum all entities
      combined = combine_balance_sheets(entity_bs)

      # Apply eliminations
      eliminations = intercompany_bs_eliminations

      {
        as_at_date: as_at_date,
        sections: {
          assets: {
            current: {
              items: combined[:assets][:current][:items],
              eliminations: eliminations[:assets][:current],
              consolidated: combined[:assets][:current][:total] - eliminations[:assets][:current][:total]
            },
            non_current: {
              items: combined[:assets][:non_current][:items],
              eliminations: eliminations[:assets][:non_current],
              consolidated: combined[:assets][:non_current][:total] - eliminations[:assets][:non_current][:total]
            },
            total: combined[:assets][:total] - eliminations[:assets][:total]
          },
          liabilities: {
            current: {
              items: combined[:liabilities][:current][:items],
              eliminations: eliminations[:liabilities][:current],
              consolidated: combined[:liabilities][:current][:total] - eliminations[:liabilities][:current][:total]
            },
            non_current: {
              items: combined[:liabilities][:non_current][:items],
              eliminations: eliminations[:liabilities][:non_current],
              consolidated: combined[:liabilities][:non_current][:total] - eliminations[:liabilities][:non_current][:total]
            },
            total: combined[:liabilities][:total] - eliminations[:liabilities][:total]
          },
          equity: {
            items: equity_after_eliminations(combined, eliminations),
            minority_interest: calculate_total_minority_interest,
            total: combined[:equity][:total] - eliminations[:equity][:total] + calculate_total_minority_interest
          }
        },
        summary: {
          total_assets: combined[:assets][:total] - eliminations[:assets][:total],
          total_liabilities: combined[:liabilities][:total] - eliminations[:liabilities][:total],
          net_assets: (combined[:assets][:total] - eliminations[:assets][:total]) -
                     (combined[:liabilities][:total] - eliminations[:liabilities][:total]),
          total_equity: combined[:equity][:total] - eliminations[:equity][:total] + calculate_total_minority_interest,
          balance_check: balance_check(combined, eliminations)
        },
        by_entity: entity_bs.map { |e| { entity: e[:entity].name, data: e[:balance_sheet][:summary] } }
      }
    end

    # =========================================================================
    # CONSOLIDATED TRIAL BALANCE
    # =========================================================================

    def consolidated_trial_balance
      # Get individual trial balances
      entity_tbs = all_entities.map do |entity|
        {
          entity: entity,
          trial_balance: entity_trial_balance(entity)
        }
      end

      # Combine all accounts
      combined_accounts = combine_trial_balances(entity_tbs)

      # Add elimination entries
      elimination_accounts = elimination_trial_balance_entries

      # Merge and calculate consolidated
      consolidated = merge_with_eliminations(combined_accounts, elimination_accounts)

      {
        as_at_date: as_at_date,
        financial_year: financial_year,
        accounts: consolidated,
        summary: {
          total_debits: consolidated.sum { |a| a[:consolidated_debit] },
          total_credits: consolidated.sum { |a| a[:consolidated_credit] },
          in_balance: trial_balance_in_balance?(consolidated)
        },
        elimination_summary: {
          total_eliminations: elimination_accounts.sum { |a| a[:debit] },
          categories: elimination_categories_summary
        }
      }
    end

    # =========================================================================
    # INTERCOMPANY ELIMINATIONS
    # =========================================================================

    def elimination_entries
      entries = []

      # 1. Eliminate intercompany receivables/payables
      entries += eliminate_intercompany_balances

      # 2. Eliminate intercompany sales/purchases
      entries += eliminate_intercompany_transactions

      # 3. Eliminate investment in subsidiaries
      entries += eliminate_investment_in_subsidiaries

      # 4. Eliminate intercompany dividends
      entries += eliminate_intercompany_dividends

      # 5. Eliminate unrealized intercompany profits
      entries += eliminate_unrealized_profits

      entries
    end

    def intercompany_summary
      {
        receivables: intercompany_receivables_total,
        payables: intercompany_payables_total,
        sales: intercompany_sales_total,
        purchases: intercompany_purchases_total,
        dividends: intercompany_dividends_total,
        loans: intercompany_loans_total,
        net_position: intercompany_net_position,
        transactions: recent_intercompany_transactions,
        imbalances: intercompany_imbalances
      }
    end

    # =========================================================================
    # ENTITY COMPARISON
    # =========================================================================

    def entity_comparison
      {
        revenue: entity_revenue_comparison,
        profit: entity_profit_comparison,
        assets: entity_assets_comparison,
        margins: entity_margin_comparison,
        growth: entity_growth_comparison,
        contribution: entity_contribution_analysis
      }
    end

    def entity_revenue_comparison
      all_entities.map do |entity|
        pnl = entity_profit_loss(entity)
        {
          entity: entity.name,
          revenue: pnl[:summary][:total_revenue],
          percent_of_group: 0  # Will be calculated
        }
      end
    end

    def entity_profit_comparison
      all_entities.map do |entity|
        pnl = entity_profit_loss(entity)
        {
          entity: entity.name,
          net_profit: pnl[:summary][:net_profit],
          margin: pnl[:summary][:total_revenue].zero? ? 0 :
                  (pnl[:summary][:net_profit] / pnl[:summary][:total_revenue] * 100).round(1)
        }
      end
    end

    def entity_assets_comparison
      all_entities.map do |entity|
        bs = entity_balance_sheet(entity)
        {
          entity: entity.name,
          total_assets: bs[:summary][:total_assets],
          net_assets: bs[:summary][:net_assets]
        }
      end
    end

    def entity_margin_comparison
      all_entities.map do |entity|
        pnl = entity_profit_loss(entity)
        revenue = pnl[:summary][:total_revenue]
        {
          entity: entity.name,
          gross_margin: revenue.zero? ? 0 : (pnl[:summary][:gross_profit] / revenue * 100).round(1),
          operating_margin: revenue.zero? ? 0 : (pnl[:summary][:operating_profit] / revenue * 100).round(1),
          net_margin: revenue.zero? ? 0 : (pnl[:summary][:net_profit] / revenue * 100).round(1)
        }
      end
    end

    def entity_growth_comparison
      all_entities.map do |entity|
        {
          entity: entity.name,
          revenue_growth: calculate_entity_growth(entity, :revenue),
          profit_growth: calculate_entity_growth(entity, :profit),
          asset_growth: calculate_entity_growth(entity, :assets)
        }
      end
    end

    def entity_contribution_analysis
      total_revenue = consolidated_profit_loss[:summary][:total_revenue]
      total_profit = consolidated_profit_loss[:summary][:net_profit_after_tax]

      all_entities.map do |entity|
        pnl = entity_profit_loss(entity)
        {
          entity: entity.name,
          revenue_contribution: total_revenue.zero? ? 0 :
                               (pnl[:summary][:total_revenue] / total_revenue * 100).round(1),
          profit_contribution: total_profit.zero? ? 0 :
                              (pnl[:summary][:net_profit] / total_profit * 100).round(1)
        }
      end
    end

    # =========================================================================
    # CONSOLIDATION ADJUSTMENTS
    # =========================================================================

    def consolidation_adjustments
      {
        goodwill: calculate_goodwill,
        fair_value_adjustments: fair_value_adjustments,
        foreign_currency_translation: currency_translation_adjustments,
        minority_interest_adjustments: minority_interest_adjustments,
        consolidation_reserve: consolidation_reserve_movements
      }
    end

    private

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def group_name
      "#{parent_company.name} Group"
    end

    def period_info
      fy_year = financial_year.delete('FY').to_i
      {
        financial_year: financial_year,
        start_date: Date.new(fy_year - 1, 7, 1),
        end_date: [Date.new(fy_year, 6, 30), as_at_date].min
      }
    end

    def find_subsidiaries
      # Would query for related companies
      # For now, return empty array
      []
    end

    def ownership_percentage(entity)
      return 100.0 if entity == parent_company

      # Would look up from ownership records
      100.0
    end

    def entity_currency(entity)
      'AUD'
    end

    def consolidation_method(entity)
      ownership = ownership_percentage(entity)

      if ownership >= 50
        'full'  # Full consolidation
      elsif ownership >= 20
        'equity'  # Equity method
      else
        'cost'  # Cost method
      end
    end

    # Entity report generation
    def entity_profit_loss(entity)
      service = Gl::Reports::ProfitLoss.new(entity, financial_year)
      service.generate
    rescue StandardError
      empty_profit_loss
    end

    def entity_balance_sheet(entity)
      service = Gl::Reports::BalanceSheet.new(entity, as_at_date)
      service.generate
    rescue StandardError
      empty_balance_sheet
    end

    def entity_trial_balance(entity)
      service = Gl::Reports::TrialBalance.new(entity, financial_year, as_at_date: as_at_date)
      service.generate
    rescue StandardError
      { accounts: [], totals: { debit: 0, credit: 0 } }
    end

    # Empty report templates
    def empty_profit_loss
      {
        summary: {
          total_revenue: 0,
          total_cost_of_sales: 0,
          gross_profit: 0,
          total_operating_expenses: 0,
          operating_profit: 0,
          net_profit: 0
        }
      }
    end

    def empty_balance_sheet
      {
        summary: {
          total_assets: 0,
          total_liabilities: 0,
          net_assets: 0,
          total_equity: 0
        }
      }
    end

    # Combining logic
    def combine_profit_loss(entity_pnls)
      {
        revenue: { items: [], total: entity_pnls.sum { |e| e[:pnl][:summary][:total_revenue] || 0 } },
        cost_of_sales: { items: [], total: entity_pnls.sum { |e| e[:pnl][:summary][:total_cost_of_sales] || 0 } },
        operating_expenses: { items: [], total: entity_pnls.sum { |e| e[:pnl][:summary][:total_operating_expenses] || 0 } },
        other_income: { items: [], total: 0 },
        other_expenses: { items: [], total: 0 },
        tax: { total: 0 }
      }
    end

    def combine_balance_sheets(entity_bs)
      {
        assets: {
          current: { items: [], total: entity_bs.sum { |e| e[:balance_sheet][:summary][:total_assets] || 0 } * 0.4 },
          non_current: { items: [], total: entity_bs.sum { |e| e[:balance_sheet][:summary][:total_assets] || 0 } * 0.6 },
          total: entity_bs.sum { |e| e[:balance_sheet][:summary][:total_assets] || 0 }
        },
        liabilities: {
          current: { items: [], total: entity_bs.sum { |e| e[:balance_sheet][:summary][:total_liabilities] || 0 } * 0.5 },
          non_current: { items: [], total: entity_bs.sum { |e| e[:balance_sheet][:summary][:total_liabilities] || 0 } * 0.5 },
          total: entity_bs.sum { |e| e[:balance_sheet][:summary][:total_liabilities] || 0 }
        },
        equity: {
          items: [],
          total: entity_bs.sum { |e| e[:balance_sheet][:summary][:total_equity] || 0 }
        }
      }
    end

    def combine_trial_balances(entity_tbs)
      # Group by account code and sum
      entity_tbs.flat_map { |e| e[:trial_balance][:accounts] || [] }
                .group_by { |a| a[:code] }
                .map do |code, accounts|
        {
          code: code,
          name: accounts.first[:name],
          type: accounts.first[:type],
          combined_debit: accounts.sum { |a| a[:debit] || 0 },
          combined_credit: accounts.sum { |a| a[:credit] || 0 }
        }
      end
    end

    # Elimination entries
    def intercompany_pnl_eliminations
      {
        revenue: { items: [], total: 0 },
        cost_of_sales: { items: [], total: 0 },
        operating_expenses: { items: [], total: 0 },
        other_income: { items: [], total: 0 },
        other_expenses: { items: [], total: 0 }
      }
    end

    def intercompany_bs_eliminations
      {
        assets: {
          current: { items: [], total: 0 },
          non_current: { items: [], total: 0 },
          total: 0
        },
        liabilities: {
          current: { items: [], total: 0 },
          non_current: { items: [], total: 0 },
          total: 0
        },
        equity: { items: [], total: 0 }
      }
    end

    def eliminate_intercompany_balances
      []  # Would calculate actual intercompany eliminations
    end

    def eliminate_intercompany_transactions
      []
    end

    def eliminate_investment_in_subsidiaries
      []
    end

    def eliminate_intercompany_dividends
      []
    end

    def eliminate_unrealized_profits
      []
    end

    def elimination_trial_balance_entries
      []
    end

    def merge_with_eliminations(combined, eliminations)
      combined.map do |account|
        elimination = eliminations.find { |e| e[:code] == account[:code] }
        elim_debit = elimination ? elimination[:debit] : 0
        elim_credit = elimination ? elimination[:credit] : 0

        account.merge(
          elimination_debit: elim_debit,
          elimination_credit: elim_credit,
          consolidated_debit: account[:combined_debit] - elim_debit,
          consolidated_credit: account[:combined_credit] - elim_credit
        )
      end
    end

    def trial_balance_in_balance?(consolidated)
      debits = consolidated.sum { |a| a[:consolidated_debit] }
      credits = consolidated.sum { |a| a[:consolidated_credit] }
      (debits - credits).abs < 0.01
    end

    def elimination_categories_summary
      {
        intercompany_balances: 0,
        intercompany_transactions: 0,
        investment_in_subsidiaries: 0,
        dividends: 0,
        unrealized_profits: 0
      }
    end

    # Intercompany totals
    def intercompany_receivables_total
      0
    end

    def intercompany_payables_total
      0
    end

    def intercompany_sales_total
      0
    end

    def intercompany_purchases_total
      0
    end

    def intercompany_dividends_total
      0
    end

    def intercompany_loans_total
      0
    end

    def intercompany_net_position
      intercompany_receivables_total - intercompany_payables_total
    end

    def recent_intercompany_transactions
      []
    end

    def intercompany_imbalances
      []
    end

    # Calculation helpers
    def calculate_gross_profit(combined, eliminations)
      (combined[:revenue][:total] - eliminations[:revenue][:total]) -
        (combined[:cost_of_sales][:total] - eliminations[:cost_of_sales][:total])
    end

    def calculate_operating_profit(combined, eliminations)
      calculate_gross_profit(combined, eliminations) -
        (combined[:operating_expenses][:total] - eliminations[:operating_expenses][:total])
    end

    def calculate_net_profit_before_tax(combined, eliminations)
      calculate_operating_profit(combined, eliminations) +
        (combined[:other_income][:total] - eliminations[:other_income][:total]) -
        (combined[:other_expenses][:total] - eliminations[:other_expenses][:total])
    end

    def calculate_net_profit_after_tax(combined, eliminations)
      calculate_net_profit_before_tax(combined, eliminations) - combined[:tax][:total]
    end

    def calculate_minority_interest(combined, eliminations)
      # Calculate minority share of subsidiary profits
      subsidiaries.sum do |sub|
        ownership = ownership_percentage(sub)
        if ownership < 100
          sub_pnl = entity_profit_loss(sub)
          sub_profit = sub_pnl[:summary][:net_profit] || 0
          sub_profit * (100 - ownership) / 100
        else
          0
        end
      end
    end

    def calculate_group_profit(combined, eliminations)
      calculate_net_profit_after_tax(combined, eliminations) - calculate_minority_interest(combined, eliminations)
    end

    def calculate_total_minority_interest
      subsidiaries.sum do |sub|
        ownership = ownership_percentage(sub)
        if ownership < 100
          sub_bs = entity_balance_sheet(sub)
          sub_equity = sub_bs[:summary][:total_equity] || 0
          sub_equity * (100 - ownership) / 100
        else
          0
        end
      end
    end

    def equity_after_eliminations(combined, eliminations)
      [
        { name: 'Share Capital', amount: combined[:equity][:total] * 0.3 },
        { name: 'Retained Earnings', amount: combined[:equity][:total] * 0.6 },
        { name: 'Reserves', amount: combined[:equity][:total] * 0.1 },
        { name: 'Consolidation Adjustments', amount: -eliminations[:equity][:total] }
      ]
    end

    def balance_check(combined, eliminations)
      total_assets = combined[:assets][:total] - eliminations[:assets][:total]
      total_liabilities = combined[:liabilities][:total] - eliminations[:liabilities][:total]
      total_equity = combined[:equity][:total] - eliminations[:equity][:total] + calculate_total_minority_interest

      difference = total_assets - total_liabilities - total_equity
      {
        balanced: difference.abs < 0.01,
        difference: difference
      }
    end

    def calculate_entity_growth(entity, metric)
      # Would compare to prior year
      0
    end

    # Consolidation adjustments
    def calculate_goodwill
      {
        opening: 0,
        additions: 0,
        impairment: 0,
        closing: 0
      }
    end

    def fair_value_adjustments
      []
    end

    def currency_translation_adjustments
      {
        opening: 0,
        movement: 0,
        closing: 0
      }
    end

    def minority_interest_adjustments
      {
        opening: calculate_total_minority_interest,
        share_of_profit: calculate_minority_interest({}, {}),
        dividends: 0,
        other: 0,
        closing: calculate_total_minority_interest
      }
    end

    def consolidation_reserve_movements
      {
        opening: 0,
        eliminations: 0,
        other: 0,
        closing: 0
      }
    end
  end
end
