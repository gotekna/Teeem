# frozen_string_literal: true

module Gl
  # Personal Tax Return Service
  #
  # Prepares data for Australian individual tax returns including:
  # - Salary and wages (Item 1)
  # - Interest income (Item 10)
  # - Dividend income with franking credits (Item 11)
  # - Rental income (Item 21)
  # - Work-related deductions (D1-D5)
  # - Self-education expenses (D4)
  # - Other deductions
  # - Tax calculation with offsets
  #
  # Supports entity types:
  # - Individual (personal tax return)
  # - Sole Trader (business schedule)
  # - Partnership (share of partnership income)
  # - Trust beneficiary (trust distributions)
  #
  class PersonalTaxService
    attr_reader :user, :financial_year, :options

    # 2024-25 Tax Rates for Residents
    TAX_BRACKETS_RESIDENT = [
      { min: 0, max: 18_200, rate: 0, base: 0 },
      { min: 18_201, max: 45_000, rate: 0.16, base: 0 },
      { min: 45_001, max: 135_000, rate: 0.30, base: 4_288 },
      { min: 135_001, max: 190_000, rate: 0.37, base: 31_288 },
      { min: 190_001, max: Float::INFINITY, rate: 0.45, base: 51_638 }
    ].freeze

    # Medicare Levy
    MEDICARE_LEVY_RATE = 0.02
    MEDICARE_LEVY_SURCHARGE_THRESHOLDS = {
      tier_1: { min: 93_000, max: 108_000, rate: 0.01 },
      tier_2: { min: 108_001, max: 144_000, rate: 0.0125 },
      tier_3: { min: 144_001, max: Float::INFINITY, rate: 0.015 }
    }.freeze

    # Income labels matching ATO Individual Tax Return
    INCOME_ITEMS = {
      item_1: { label: 'Salary or wages', description: 'Gross payments from employers' },
      item_2: { label: 'Allowances, earnings, tips, director fees', description: 'Other employment income' },
      item_3: { label: 'Employer lump sum payments', description: 'Unused leave, ETPs' },
      item_4: { label: 'Employment termination payments', description: 'Redundancy, early retirement' },
      item_5: { label: 'Australian Government payments', description: 'Centrelink, JobSeeker' },
      item_6: { label: 'Australian Government pensions', description: 'Age pension, disability' },
      item_7: { label: 'Australian annuities and super income streams', description: 'Super pensions' },
      item_8: { label: 'Australian super lump sum payments', description: 'Super withdrawals' },
      item_9: { label: 'Attributed personal services income', description: 'PSI attribution' },
      item_10: { label: 'Interest', description: 'Bank interest, term deposits' },
      item_11: { label: 'Dividends', description: 'Dividends from shares' },
      item_12: { label: 'Employee share schemes', description: 'ESS discount amounts' },
      item_13: { label: 'Partnerships and trusts', description: 'Share of partnership/trust income' },
      item_14: { label: 'Personal services income', description: 'Contractor income' },
      item_15: { label: 'Net income or loss from business', description: 'Sole trader business income' },
      item_18: { label: 'Capital gains', description: 'Profit on sale of assets' },
      item_20: { label: 'Foreign income', description: 'Overseas income' },
      item_21: { label: 'Rent', description: 'Rental property income' },
      item_24: { label: 'Other income', description: 'Any other assessable income' }
    }.freeze

    # Deduction labels matching ATO Individual Tax Return
    DEDUCTION_ITEMS = {
      d1: { label: 'Work-related car expenses', description: 'Car usage for work purposes' },
      d2: { label: 'Work-related travel expenses', description: 'Travel away from home for work' },
      d3: { label: 'Work-related clothing and laundry', description: 'Uniforms, protective clothing' },
      d4: { label: 'Work-related self-education expenses', description: 'Study related to current work' },
      d5: { label: 'Other work-related expenses', description: 'Tools, union fees, phone, internet' },
      d6: { label: 'Low value pool deduction', description: 'Depreciation pooling' },
      d7: { label: 'Interest deductions', description: 'Interest on investment loans' },
      d8: { label: 'Dividend deductions', description: 'Costs of earning dividend income' },
      d9: { label: 'Gifts or donations', description: 'Donations to DGRs' },
      d10: { label: 'Cost of managing tax affairs', description: 'Tax agent fees, ruling fees' },
      d11: { label: 'Deductible amount of undeducted purchase price', description: 'UPP of annuities' },
      d12: { label: 'Personal superannuation contributions', description: 'Contributions claimed as deduction' },
      d13: { label: 'Deduction for project pool', description: 'Blackhole expenditure' },
      d14: { label: 'Forestry managed investment scheme', description: 'Forestry MIS deductions' },
      d15: { label: 'Other deductions', description: 'Other allowable deductions' }
    }.freeze

    def initialize(user_or_company, financial_year = nil, options = {})
      @user = user_or_company
      @financial_year = financial_year || current_fy
      @options = options.with_indifferent_access
    end

    # Generate complete personal tax return
    def generate
      {
        financial_year: financial_year,
        entity: entity_info,
        income: income_schedule,
        deductions: deductions_schedule,
        tax_calculation: calculate_tax,
        offsets: calculate_offsets,
        medicare: medicare_calculation,
        summary: tax_summary,
        comparison: prior_year_comparison,
        tips: tax_tips
      }
    end

    # Quick tax estimate
    def estimate
      income = total_assessable_income
      deductions = total_deductions
      taxable = [income - deductions, 0].max

      tax = calculate_tax_on_income(taxable)
      medicare = calculate_medicare_levy(taxable)
      withheld = total_tax_withheld

      {
        total_income: income.to_d.round(2),
        total_deductions: deductions.to_d.round(2),
        taxable_income: taxable.to_d.round(2),
        tax_on_income: tax.to_d.round(2),
        medicare_levy: medicare.to_d.round(2),
        total_tax: (tax + medicare).to_d.round(2),
        tax_withheld: withheld.to_d.round(2),
        refund_or_payable: (withheld - tax - medicare).to_d.round(2),
        is_refund: withheld > (tax + medicare)
      }
    end

    # Sole trader business schedule
    def business_schedule
      return nil unless entity_type == 'sole_trader'

      {
        business_name: options[:business_name] || 'Business',
        abn: options[:abn],
        industry: options[:industry],
        income: business_income,
        expenses: business_expenses,
        net_profit: business_net_profit,
        depreciation: business_depreciation,
        motor_vehicle: business_motor_vehicle
      }
    end

    # Rental property schedule
    def rental_schedule
      rental_income = calculate_rental_income
      return nil if rental_income.zero? && rental_expenses.zero?

      {
        properties: rental_properties,
        total_income: rental_income.to_d.round(2),
        total_expenses: rental_expenses.to_d.round(2),
        net_rental: (rental_income - rental_expenses).to_d.round(2),
        depreciation: rental_depreciation,
        interest: rental_interest
      }
    end

    # Capital gains schedule
    def capital_gains_schedule
      gains = calculate_capital_gains
      return nil if gains[:total_gains].zero?

      gains
    end

    private

    # =========================================================================
    # ENTITY INFORMATION
    # =========================================================================

    def entity_info
      {
        type: entity_type,
        name: user.respond_to?(:name) ? user.name : 'Individual',
        tfn_provided: options[:tfn].present?,
        residency: options[:residency] || 'resident',
        has_private_health: options[:private_health] || false,
        spouse: options[:spouse_income].present?,
        dependants: options[:dependants] || 0
      }
    end

    def entity_type
      options[:entity_type] || 'individual'
    end

    # =========================================================================
    # INCOME SCHEDULE
    # =========================================================================

    def income_schedule
      {
        employment: employment_income,
        investments: investment_income,
        business: entity_type == 'sole_trader' ? business_income_summary : nil,
        rental: rental_income_summary,
        capital_gains: capital_gains_summary,
        other: other_income,
        total_income: total_assessable_income.to_d.round(2),
        labels: INCOME_ITEMS
      }
    end

    def employment_income
      {
        item_1_salary_wages: (options[:salary_wages] || 0).to_d.round(2),
        item_1_tax_withheld: (options[:tax_withheld] || 0).to_d.round(2),
        item_2_allowances: (options[:allowances] || 0).to_d.round(2),
        item_3_lump_sum: (options[:lump_sum] || 0).to_d.round(2),
        reportable_fringe_benefits: (options[:fringe_benefits] || 0).to_d.round(2),
        reportable_super: (options[:reportable_super] || 0).to_d.round(2)
      }
    end

    def investment_income
      {
        item_10_interest: calculate_interest_income.to_d.round(2),
        item_10_tax_withheld: (options[:interest_tax_withheld] || 0).to_d.round(2),
        item_11_dividends: {
          unfranked: (options[:unfranked_dividends] || 0).to_d.round(2),
          franked: (options[:franked_dividends] || 0).to_d.round(2),
          franking_credits: calculate_franking_credits.to_d.round(2)
        },
        item_13_partnerships_trusts: (options[:partnership_trust_income] || 0).to_d.round(2)
      }
    end

    def business_income_summary
      return nil unless entity_type == 'sole_trader'

      {
        item_15_net_business_income: business_net_profit.to_d.round(2),
        included_in_total: true
      }
    end

    def rental_income_summary
      net = calculate_rental_income - rental_expenses
      return nil if net.zero? && calculate_rental_income.zero?

      {
        item_21_net_rent: net.to_d.round(2),
        gross_rent: calculate_rental_income.to_d.round(2),
        expenses: rental_expenses.to_d.round(2)
      }
    end

    def capital_gains_summary
      gains = calculate_capital_gains
      return nil if gains[:net_capital_gain].zero?

      {
        item_18_net_capital_gain: gains[:net_capital_gain].to_d.round(2),
        total_gains: gains[:total_gains].to_d.round(2),
        total_losses: gains[:total_losses].to_d.round(2),
        discount_applied: gains[:discount_applied].to_d.round(2)
      }
    end

    def other_income
      {
        item_24_other: (options[:other_income] || 0).to_d.round(2),
        foreign_income: (options[:foreign_income] || 0).to_d.round(2)
      }
    end

    def total_assessable_income
      salary = options[:salary_wages] || 0
      allowances = options[:allowances] || 0
      lump_sum = options[:lump_sum] || 0
      interest = calculate_interest_income
      dividends = (options[:unfranked_dividends] || 0) + (options[:franked_dividends] || 0) + calculate_franking_credits
      partnership_trust = options[:partnership_trust_income] || 0
      business = entity_type == 'sole_trader' ? business_net_profit : 0
      rental = calculate_rental_income - rental_expenses
      capital = calculate_capital_gains[:net_capital_gain]
      other = options[:other_income] || 0

      salary + allowances + lump_sum + interest + dividends + partnership_trust +
        business + rental + capital + other
    end

    # =========================================================================
    # DEDUCTIONS SCHEDULE
    # =========================================================================

    def deductions_schedule
      {
        work_related: work_related_deductions,
        investment: investment_deductions,
        other: other_deductions,
        total_deductions: total_deductions.to_d.round(2),
        labels: DEDUCTION_ITEMS
      }
    end

    def work_related_deductions
      {
        d1_car_expenses: calculate_car_expenses.to_d.round(2),
        d1_method: options[:car_method] || 'cents_per_km',
        d2_travel: (options[:work_travel] || 0).to_d.round(2),
        d3_clothing: calculate_clothing_expenses.to_d.round(2),
        d4_self_education: (options[:self_education] || 0).to_d.round(2),
        d5_other_work: calculate_other_work_expenses.to_d.round(2),
        home_office: calculate_home_office.to_d.round(2),
        home_office_method: options[:home_office_method] || 'fixed_rate'
      }
    end

    def investment_deductions
      {
        d7_interest: (options[:investment_interest] || 0).to_d.round(2),
        d8_dividend_expenses: (options[:dividend_expenses] || 0).to_d.round(2),
        rental_expenses: rental_expenses.to_d.round(2)
      }
    end

    def other_deductions
      {
        d9_gifts: (options[:donations] || 0).to_d.round(2),
        d10_tax_affairs: (options[:tax_agent_fees] || 0).to_d.round(2),
        d12_super_contributions: (options[:personal_super] || 0).to_d.round(2),
        d15_other: (options[:other_deductions] || 0).to_d.round(2)
      }
    end

    def total_deductions
      work = calculate_car_expenses + (options[:work_travel] || 0) +
             calculate_clothing_expenses + (options[:self_education] || 0) +
             calculate_other_work_expenses + calculate_home_office

      investment = (options[:investment_interest] || 0) +
                   (options[:dividend_expenses] || 0) +
                   rental_expenses

      other = (options[:donations] || 0) + (options[:tax_agent_fees] || 0) +
              (options[:personal_super] || 0) + (options[:other_deductions] || 0)

      work + investment + other
    end

    # =========================================================================
    # DEDUCTION CALCULATIONS
    # =========================================================================

    def calculate_car_expenses
      method = options[:car_method] || 'cents_per_km'

      case method
      when 'cents_per_km'
        # 85 cents per km for 2024-25, max 5000 km
        kms = [options[:work_kms] || 0, 5000].min
        kms * 0.85
      when 'logbook'
        total_expenses = options[:car_total_expenses] || 0
        business_pct = options[:car_business_percentage] || 0
        total_expenses * (business_pct / 100.0)
      else
        0
      end
    end

    def calculate_clothing_expenses
      uniform = options[:uniform_expenses] || 0
      laundry = options[:laundry_expenses] || 0

      # Laundry can be claimed without receipts up to $150
      laundry = [laundry, 150].min if options[:laundry_no_receipts]

      uniform + laundry
    end

    def calculate_other_work_expenses
      phone_internet = options[:phone_internet] || 0
      tools = options[:tools_equipment] || 0
      union_fees = options[:union_fees] || 0
      journals = options[:professional_journals] || 0
      other = options[:other_work_expenses] || 0

      phone_internet + tools + union_fees + journals + other
    end

    def calculate_home_office
      method = options[:home_office_method] || 'fixed_rate'

      case method
      when 'fixed_rate'
        # 67 cents per hour for 2024-25
        hours = options[:home_office_hours] || 0
        hours * 0.67
      when 'actual'
        options[:home_office_actual] || 0
      else
        0
      end
    end

    # =========================================================================
    # INCOME CALCULATIONS
    # =========================================================================

    def calculate_interest_income
      # Would pull from bank accounts if linked
      options[:interest_income] || 0
    end

    def calculate_franking_credits
      franked = options[:franked_dividends] || 0
      # Franking credits = franked dividends × (tax rate ÷ (1 - tax rate))
      # For 30% company rate: credits = dividends × 0.4286
      franked * 0.4286
    end

    def calculate_rental_income
      options[:rental_income] || 0
    end

    def rental_expenses
      return 0 unless options[:rental_income]

      interest = options[:rental_interest] || 0
      rates = options[:rental_rates] || 0
      insurance = options[:rental_insurance] || 0
      repairs = options[:rental_repairs] || 0
      depreciation = options[:rental_depreciation] || 0
      agent_fees = options[:rental_agent_fees] || 0
      other = options[:rental_other_expenses] || 0

      interest + rates + insurance + repairs + depreciation + agent_fees + other
    end

    def rental_interest
      options[:rental_interest] || 0
    end

    def rental_depreciation
      options[:rental_depreciation] || 0
    end

    def rental_properties
      # Would return list of properties if tracked
      [{ address: options[:rental_address] || 'Property 1', ownership_percentage: 100 }]
    end

    def calculate_capital_gains
      total_gains = options[:capital_gains] || 0
      total_losses = options[:capital_losses] || 0

      # Apply CGT discount (50% for assets held > 12 months)
      discountable = options[:discountable_gains] || total_gains
      discount = discountable * 0.5

      net = [total_gains - total_losses - discount, 0].max

      {
        total_gains: total_gains,
        total_losses: total_losses,
        discount_applied: discount,
        net_capital_gain: net
      }
    end

    # =========================================================================
    # BUSINESS (SOLE TRADER)
    # =========================================================================

    def business_income
      options[:business_income] || 0
    end

    def business_expenses
      options[:business_expenses] || 0
    end

    def business_net_profit
      business_income - business_expenses
    end

    def business_depreciation
      options[:business_depreciation] || 0
    end

    def business_motor_vehicle
      options[:business_motor_vehicle] || 0
    end

    # =========================================================================
    # TAX CALCULATION
    # =========================================================================

    def calculate_tax
      taxable = taxable_income
      tax_on_taxable = calculate_tax_on_income(taxable)
      offsets = calculate_offsets
      total_offsets = offsets.values.sum

      tax_payable = [tax_on_taxable - total_offsets, 0].max
      medicare = medicare_calculation
      total_tax = tax_payable + medicare[:levy] + medicare[:surcharge]

      withheld = total_tax_withheld
      franking = calculate_franking_credits

      net_payable = total_tax - withheld - franking

      {
        taxable_income: taxable.to_d.round(2),
        tax_on_taxable_income: tax_on_taxable.to_d.round(2),
        less_offsets: total_offsets.to_d.round(2),
        tax_payable: tax_payable.to_d.round(2),
        medicare_levy: medicare[:levy].to_d.round(2),
        medicare_surcharge: medicare[:surcharge].to_d.round(2),
        total_tax_liability: total_tax.to_d.round(2),
        less_tax_withheld: withheld.to_d.round(2),
        less_franking_credits: franking.to_d.round(2),
        net_tax_payable: net_payable.to_d.round(2),
        refund_due: net_payable < 0 ? net_payable.abs.to_d.round(2) : 0.to_d
      }
    end

    def taxable_income
      [total_assessable_income - total_deductions, 0].max
    end

    def calculate_tax_on_income(income)
      return 0 if income <= 0

      bracket = TAX_BRACKETS_RESIDENT.find { |b| income >= b[:min] && income <= b[:max] }
      return 0 unless bracket

      bracket[:base] + ((income - bracket[:min] + 1) * bracket[:rate])
    end

    def total_tax_withheld
      salary_withheld = options[:tax_withheld] || 0
      interest_withheld = options[:interest_tax_withheld] || 0
      dividend_withheld = options[:dividend_tax_withheld] || 0
      other_withheld = options[:other_tax_withheld] || 0

      salary_withheld + interest_withheld + dividend_withheld + other_withheld
    end

    # =========================================================================
    # TAX OFFSETS
    # =========================================================================

    def calculate_offsets
      offsets = {}

      # Low and middle income tax offset (LMITO) - expired 30 June 2023
      # Low income tax offset (LITO)
      lito = calculate_lito
      offsets[:lito] = lito if lito > 0

      # Seniors and pensioners tax offset
      if options[:eligible_sapto]
        offsets[:sapto] = calculate_sapto
      end

      # Private health insurance rebate
      if options[:private_health_rebate]
        offsets[:health_rebate] = options[:private_health_rebate]
      end

      # Franking credits offset
      franking = calculate_franking_credits
      offsets[:franking_credits] = franking if franking > 0

      offsets
    end

    def calculate_lito
      taxable = taxable_income

      if taxable <= 37_500
        700
      elsif taxable <= 45_000
        700 - ((taxable - 37_500) * 0.05)
      elsif taxable <= 66_667
        325 - ((taxable - 45_000) * 0.015)
      else
        0
      end
    end

    def calculate_sapto
      # Simplified SAPTO calculation
      taxable = taxable_income
      max_offset = options[:single] ? 2_230 : 1_602

      if taxable <= 32_279
        max_offset
      elsif taxable <= 50_119
        max_offset - ((taxable - 32_279) * 0.125)
      else
        0
      end
    end

    # =========================================================================
    # MEDICARE
    # =========================================================================

    def medicare_calculation
      taxable = taxable_income

      # Medicare levy
      levy = calculate_medicare_levy(taxable)

      # Medicare levy surcharge (if no private health and income > threshold)
      surcharge = 0
      unless options[:private_health]
        surcharge = calculate_mls(taxable)
      end

      {
        levy: levy.to_d.round(2),
        surcharge: surcharge.to_d.round(2),
        total: (levy + surcharge).to_d.round(2),
        private_health_held: options[:private_health] || false
      }
    end

    def calculate_medicare_levy(taxable)
      # Full levy above threshold
      threshold = 26_000 # 2024-25 single threshold

      if taxable <= threshold
        0
      else
        taxable * MEDICARE_LEVY_RATE
      end
    end

    def calculate_mls(taxable)
      return 0 if taxable <= 93_000

      tier = MEDICARE_LEVY_SURCHARGE_THRESHOLDS.values.find do |t|
        taxable >= t[:min] && taxable <= t[:max]
      end

      tier ? taxable * tier[:rate] : 0
    end

    # =========================================================================
    # SUMMARY & COMPARISON
    # =========================================================================

    def tax_summary
      estimate_data = estimate

      {
        total_income: estimate_data[:total_income],
        total_deductions: estimate_data[:total_deductions],
        taxable_income: estimate_data[:taxable_income],
        total_tax: estimate_data[:total_tax],
        tax_withheld: estimate_data[:tax_withheld],
        result: estimate_data[:is_refund] ? 'refund' : 'payable',
        amount: estimate_data[:refund_or_payable].abs,
        effective_tax_rate: calculate_effective_rate
      }
    end

    def calculate_effective_rate
      taxable = taxable_income
      return 0 if taxable.zero?

      total_tax = calculate_tax_on_income(taxable) + calculate_medicare_levy(taxable)
      ((total_tax / taxable) * 100).round(1)
    end

    def prior_year_comparison
      # Would compare with prior year if available
      {
        available: false,
        note: 'Prior year comparison requires historical data'
      }
    end

    # =========================================================================
    # TAX TIPS
    # =========================================================================

    def tax_tips
      tips = []

      # Super contributions
      if (options[:salary_wages] || 0) > 45_000 && (options[:personal_super] || 0).zero?
        tips << {
          category: 'superannuation',
          tip: 'Consider making personal super contributions',
          detail: 'You may be able to claim a tax deduction for personal super contributions up to the concessional cap ($30,000 for 2024-25)'
        }
      end

      # Private health insurance
      unless options[:private_health]
        if taxable_income > 93_000
          tips << {
            category: 'health_insurance',
            tip: 'Consider private health insurance',
            detail: 'Without private health cover, you may be liable for Medicare Levy Surcharge of up to 1.5%'
          }
        end
      end

      # Home office
      if options[:home_office_hours] && options[:home_office_hours] > 0 && options[:home_office_method].nil?
        tips << {
          category: 'home_office',
          tip: 'Review home office claiming method',
          detail: 'The fixed rate method (67c per hour) may be simpler, but actual cost method could be higher'
        }
      end

      # Car expenses
      if (options[:work_kms] || 0) > 0 && options[:car_method] != 'logbook'
        tips << {
          category: 'car_expenses',
          tip: 'Consider logbook method for car expenses',
          detail: 'If your work-related car use is high, the logbook method may provide a larger deduction than cents per km'
        }
      end

      # Donations
      if (options[:donations] || 0).zero?
        tips << {
          category: 'donations',
          tip: 'Claim any charitable donations',
          detail: 'Gifts of $2 or more to registered charities are tax deductible'
        }
      end

      tips
    end

    # =========================================================================
    # HELPERS
    # =========================================================================

    def current_fy
      today = Date.current
      year = today.month >= 7 ? today.year + 1 : today.year
      "FY#{year}"
    end
  end
end
