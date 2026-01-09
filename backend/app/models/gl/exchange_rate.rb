# frozen_string_literal: true

module Gl
  class ExchangeRate < ApplicationRecord
    self.table_name = 'gl_exchange_rates'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company
    belongs_to :gl_currency, class_name: 'Gl::Currency'

    # Delegate
    delegate :code, :name, :symbol, to: :gl_currency, prefix: :currency

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    SOURCES = %w[manual xero quickbooks myob rba xe oanda].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :effective_date, presence: true
    validates :rate, presence: true, numericality: { greater_than: 0 }
    validates :source, inclusion: { in: SOURCES }, allow_blank: true
    validates :effective_date, uniqueness: {
      scope: [:corporate_company_id, :gl_currency_id],
      message: 'already has a rate for this currency'
    }

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :for_currency, ->(currency) { where(gl_currency: currency) }
    scope :for_date, ->(date) { where(effective_date: date) }
    scope :on_or_before, ->(date) { where('effective_date <= ?', date) }
    scope :latest_first, -> { order(effective_date: :desc) }
    scope :ordered, -> { order(:effective_date) }

    # ═══════════════════════════════════════════════════════════════
    # CLASS METHODS
    # ═══════════════════════════════════════════════════════════════
    class << self
      # Get rate for a currency on a specific date (or most recent before)
      def rate_for(currency, date)
        for_currency(currency)
          .on_or_before(date)
          .latest_first
          .first
          &.rate || 1.0
      end

      # Set rate for a currency on a date
      def set_rate(corporate_company, currency, date, rate, source: 'manual')
        find_or_initialize_by(
          corporate_company: corporate_company,
          gl_currency: currency,
          effective_date: date
        ).tap do |er|
          er.rate = rate
          er.source = source
          er.save!
        end
      end

      # Import rates from an external source
      def import_rates(corporate_company, rates_hash, date: Date.current, source: 'manual')
        rates_hash.each do |currency_code, rate|
          currency = Gl::Currency.find_by(
            corporate_company: corporate_company,
            code: currency_code.to_s.upcase
          )
          next unless currency

          set_rate(corporate_company, currency, date, rate, source: source)
        end
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Convert amount from this currency to base
    def convert_to_base(amount)
      amount * rate
    end

    # Convert amount from base to this currency
    def convert_from_base(amount)
      return amount if rate.zero?

      amount / rate
    end

    # Previous rate for comparison
    def previous_rate
      self.class
        .for_currency(gl_currency)
        .where('effective_date < ?', effective_date)
        .latest_first
        .first
    end

    # Rate change from previous
    def rate_change
      prev = previous_rate
      return nil unless prev

      rate - prev.rate
    end

    # Rate change percentage
    def rate_change_percentage
      prev = previous_rate
      return nil unless prev
      return nil if prev.rate.zero?

      ((rate - prev.rate) / prev.rate * 100).round(2)
    end

    # Display string
    def display_rate
      "1 #{currency_code} = #{rate.round(6)} #{corporate_company.base_currency_code || 'AUD'}"
    end
  end
end
