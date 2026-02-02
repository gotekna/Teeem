# frozen_string_literal: true

module Gl
  class TaxRate < ApplicationRecord
    self.table_name = 'gl_tax_rates'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :gl_account, class_name: 'Gl::Account', optional: true

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    TAX_TYPES = %w[output input none].freeze
    PROVIDERS = %w[xero quickbooks myob].freeze

    # Australian GST defaults
    AUSTRALIAN_TAX_RATES = [
      { code: 'GST', name: 'GST on Income', tax_type: 'output', rate: 10.00 },
      { code: 'GST', name: 'GST on Expenses', tax_type: 'input', rate: 10.00 },
      { code: 'GST-FREE', name: 'GST Free Income', tax_type: 'output', rate: 0.00 },
      { code: 'GST-FREE', name: 'GST Free Expenses', tax_type: 'input', rate: 0.00 },
      { code: 'BAS-EXCLUDED', name: 'BAS Excluded', tax_type: 'none', rate: 0.00 },
      { code: 'EXEMPT', name: 'Tax Exempt', tax_type: 'none', rate: 0.00 }
    ].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :code, presence: true
    validates :name, presence: true
    validates :rate, presence: true, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
    validates :tax_type, inclusion: { in: TAX_TYPES }, allow_blank: true
    validates :external_provider, inclusion: { in: PROVIDERS }, allow_blank: true
    validates :code, uniqueness: {
      scope: [:corporate_company_id, :external_provider, :external_tenant_id],
      message: 'must be unique per company and provider'
    }

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :active, -> { where(active: true) }
    scope :inactive, -> { where(active: false) }
    scope :for_expenses, -> { where(can_apply_to_expenses: true) }
    scope :for_revenue, -> { where(can_apply_to_revenue: true) }
    scope :output_taxes, -> { where(tax_type: 'output') }
    scope :input_taxes, -> { where(tax_type: 'input') }
    scope :for_provider, ->(provider, tenant_id) {
      where(external_provider: provider, external_tenant_id: tenant_id)
    }
    scope :standalone, -> { where(external_provider: nil) }
    scope :with_rate, -> { where('rate > 0') }
    scope :zero_rate, -> { where(rate: 0) }
    scope :ordered, -> { order(:code, :name) }

    # ═══════════════════════════════════════════════════════════════
    # CLASS METHODS
    # ═══════════════════════════════════════════════════════════════
    class << self
      # Set up Australian GST defaults
      def setup_australian_defaults(corporate_company)
        AUSTRALIAN_TAX_RATES.each do |attrs|
          create_with(attrs.except(:code))
            .find_or_create_by!(
              corporate_company: corporate_company,
              code: attrs[:code],
              tax_type: attrs[:tax_type]
            )
        end
      end

      # Find the default GST rate for expenses
      def default_expense_gst(corporate_company)
        where(corporate_company: corporate_company)
          .active
          .for_expenses
          .input_taxes
          .with_rate
          .first
      end

      # Find the default GST rate for revenue
      def default_revenue_gst(corporate_company)
        where(corporate_company: corporate_company)
          .active
          .for_revenue
          .output_taxes
          .with_rate
          .first
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Calculate tax on an amount
    def calculate_tax(amount)
      (amount * rate / 100).round(2)
    end

    # Calculate the gross amount from a net amount
    def gross_from_net(net_amount)
      net_amount + calculate_tax(net_amount)
    end

    # Calculate the net amount from a gross amount
    def net_from_gross(gross_amount)
      (gross_amount / (1 + rate / 100)).round(2)
    end

    # Calculate tax included in a gross amount
    def tax_from_gross(gross_amount)
      gross_amount - net_from_gross(gross_amount)
    end

    # Is this a GST rate?
    def gst?
      rate > 0
    end

    # Is this zero-rated?
    def zero_rated?
      rate.zero?
    end

    # Is this for output (sales)?
    def output?
      tax_type == 'output'
    end

    # Is this for input (purchases)?
    def input?
      tax_type == 'input'
    end

    # Display name with rate
    def display_name
      if rate.zero?
        name
      else
        "#{name} (#{rate.to_i}%)"
      end
    end

    # Code and name
    def code_and_name
      "#{code} - #{name}"
    end
  end
end
