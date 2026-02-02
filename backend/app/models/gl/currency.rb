# frozen_string_literal: true

module Gl
  class Currency < ApplicationRecord
    self.table_name = 'gl_currencies'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company, class_name: "Corporate"

    has_many :exchange_rates, class_name: 'Gl::ExchangeRate', foreign_key: 'gl_currency_id', dependent: :destroy

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    COMMON_CURRENCIES = {
      'AUD' => { name: 'Australian Dollar', symbol: '$', decimal_places: 2 },
      'USD' => { name: 'US Dollar', symbol: 'US$', decimal_places: 2 },
      'NZD' => { name: 'New Zealand Dollar', symbol: 'NZ$', decimal_places: 2 },
      'GBP' => { name: 'British Pound', symbol: '£', decimal_places: 2 },
      'EUR' => { name: 'Euro', symbol: '€', decimal_places: 2 },
      'JPY' => { name: 'Japanese Yen', symbol: '¥', decimal_places: 0 },
      'CAD' => { name: 'Canadian Dollar', symbol: 'C$', decimal_places: 2 },
      'SGD' => { name: 'Singapore Dollar', symbol: 'S$', decimal_places: 2 },
      'HKD' => { name: 'Hong Kong Dollar', symbol: 'HK$', decimal_places: 2 },
      'CNY' => { name: 'Chinese Yuan', symbol: '¥', decimal_places: 2 }
    }.freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :code, presence: true, length: { is: 3 }
    validates :name, presence: true
    validates :decimal_places, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 4 }
    validates :code, uniqueness: { scope: :corporate_company_id }
    validate :only_one_base_currency

    # ═══════════════════════════════════════════════════════════════
    # CALLBACKS
    # ═══════════════════════════════════════════════════════════════
    before_validation :upcase_code

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :active, -> { where(active: true) }
    scope :base, -> { where(is_base_currency: true) }
    scope :foreign, -> { where(is_base_currency: false) }
    scope :ordered, -> { order(:code) }

    # ═══════════════════════════════════════════════════════════════
    # CLASS METHODS
    # ═══════════════════════════════════════════════════════════════
    class << self
      # Get base currency for a company
      def base_currency_for(corporate_company)
        where(corporate_company: corporate_company, is_base_currency: true).first
      end

      # Set up common currencies for a company
      def setup_defaults_for(corporate_company, base_code: 'AUD')
        COMMON_CURRENCIES.each do |code, attrs|
          create_with(
            name: attrs[:name],
            symbol: attrs[:symbol],
            decimal_places: attrs[:decimal_places],
            is_base_currency: code == base_code
          ).find_or_create_by!(
            corporate_company: corporate_company,
            code: code
          )
        end
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    def base?
      is_base_currency
    end

    def foreign?
      !is_base_currency
    end

    # Get exchange rate for a specific date
    def rate_for(date)
      return 1.0 if is_base_currency

      exchange_rates
        .where('effective_date <= ?', date)
        .order(effective_date: :desc)
        .first
        &.rate || 1.0
    end

    # Convert an amount to base currency
    def to_base(amount, date = Date.current)
      amount * rate_for(date)
    end

    # Convert an amount from base currency
    def from_base(amount, date = Date.current)
      rate = rate_for(date)
      return amount if rate.zero?

      amount / rate
    end

    # Format an amount in this currency
    def format(amount)
      formatted = amount.round(decimal_places)
      "#{symbol}#{formatted}"
    end

    # Display name with code
    def display_name
      "#{name} (#{code})"
    end

    private

    def upcase_code
      self.code = code&.upcase
    end

    def only_one_base_currency
      return unless is_base_currency
      return unless is_base_currency_changed?

      existing_base = self.class
        .where(corporate_company: corporate_company, is_base_currency: true)
        .where.not(id: id)
        .exists?

      if existing_base
        errors.add(:is_base_currency, 'there can only be one base currency per company')
      end
    end
  end
end
