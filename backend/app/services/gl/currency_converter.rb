# frozen_string_literal: true

module Gl
  # Service for converting amounts between currencies
  #
  # Handles:
  # - Single amount conversions
  # - Batch conversions
  # - Rate lookups with fallback
  # - Cross-currency conversions (via base currency)
  #
  class CurrencyConverter
    attr_reader :corporate, :base_currency

    def initialize(corporate)
      @corporate = corporate
      @base_currency = Gl::Currency.base_currency_for(corporate)
      @rate_cache = {}
    end

    # Convert amount from one currency to another
    #
    # @param amount [Decimal] The amount to convert
    # @param from_currency [Gl::Currency, String] Source currency or code
    # @param to_currency [Gl::Currency, String] Target currency or code
    # @param date [Date] The date for exchange rate lookup
    # @return [Hash] { amount:, rate:, from:, to:, date: }
    #
    def convert(amount, from_currency:, to_currency:, date: Date.current)
      from = resolve_currency(from_currency)
      to = resolve_currency(to_currency)

      return zero_result(from, to, date) if amount.nil? || amount.zero?

      # Same currency - no conversion needed
      if from.id == to.id
        return {
          amount: amount.to_d,
          rate: 1.0,
          from_currency: from.code,
          to_currency: to.code,
          date: date,
          converted: false
        }
      end

      # Convert via base currency
      # from -> base -> to
      from_rate = get_rate(from, date)
      to_rate = get_rate(to, date)

      # Cross rate calculation
      cross_rate = to_rate.zero? ? 0 : from_rate / to_rate
      converted_amount = (amount.to_d * cross_rate).round(to.decimal_places)

      {
        amount: converted_amount,
        rate: cross_rate.round(6),
        inverse_rate: (cross_rate.zero? ? 0 : 1 / cross_rate).round(6),
        from_currency: from.code,
        to_currency: to.code,
        date: date,
        converted: true
      }
    end

    # Convert to base currency
    def to_base(amount, from_currency:, date: Date.current)
      convert(
        amount,
        from_currency: from_currency,
        to_currency: base_currency,
        date: date
      )
    end

    # Convert from base currency
    def from_base(amount, to_currency:, date: Date.current)
      convert(
        amount,
        from_currency: base_currency,
        to_currency: to_currency,
        date: date
      )
    end

    # Get rate for a currency to base currency
    def get_rate(currency, date = Date.current)
      currency = resolve_currency(currency)
      return 1.0 if currency.base?

      cache_key = "#{currency.id}:#{date}"
      @rate_cache[cache_key] ||= currency.rate_for(date)
    end

    # Batch convert multiple amounts
    #
    # @param items [Array<Hash>] Array of { amount:, currency: }
    # @param to_currency [Gl::Currency, String] Target currency
    # @param date [Date] Exchange rate date
    # @return [Array<Hash>] Converted amounts with details
    #
    def batch_convert(items, to_currency:, date: Date.current)
      to = resolve_currency(to_currency)

      items.map do |item|
        convert(
          item[:amount],
          from_currency: item[:currency],
          to_currency: to,
          date: date
        )
      end
    end

    # Calculate exchange gain/loss between two dates
    #
    # @param amount [Decimal] Original foreign currency amount
    # @param currency [Gl::Currency] Foreign currency
    # @param original_date [Date] Original transaction date
    # @param revaluation_date [Date] Revaluation date
    # @return [Hash] { gain_loss:, original_base:, current_base:, rate_change: }
    #
    def exchange_gain_loss(amount, currency:, original_date:, revaluation_date: Date.current)
      currency = resolve_currency(currency)

      return zero_gain_loss if currency.base?
      return zero_gain_loss if amount.nil? || amount.zero?

      original_rate = get_rate(currency, original_date)
      current_rate = get_rate(currency, revaluation_date)

      original_base = (amount.to_d * original_rate).round(base_currency.decimal_places)
      current_base = (amount.to_d * current_rate).round(base_currency.decimal_places)
      gain_loss = current_base - original_base

      {
        foreign_amount: amount,
        currency_code: currency.code,
        original_rate: original_rate.round(6),
        current_rate: current_rate.round(6),
        rate_change: (current_rate - original_rate).round(6),
        rate_change_percentage: original_rate.zero? ? 0 : ((current_rate - original_rate) / original_rate * 100).round(2),
        original_base_amount: original_base,
        current_base_amount: current_base,
        gain_loss: gain_loss,
        gain_loss_type: gain_loss.positive? ? 'gain' : (gain_loss.negative? ? 'loss' : 'none'),
        original_date: original_date,
        revaluation_date: revaluation_date
      }
    end

    # Get all available exchange rates for a date
    def rates_for_date(date = Date.current)
      Gl::Currency
        .where(corporate: corporate)
        .active
        .foreign
        .map do |currency|
          rate = get_rate(currency, date)
          {
            currency_code: currency.code,
            currency_name: currency.name,
            symbol: currency.symbol,
            rate: rate.round(6),
            inverse_rate: rate.zero? ? 0 : (1 / rate).round(6),
            date: date
          }
        end
    end

    # Calculate total in base currency for mixed currency items
    def sum_to_base(items, date: Date.current)
      total = 0.0

      items.each do |item|
        result = to_base(item[:amount], from_currency: item[:currency], date: date)
        total += result[:amount]
      end

      {
        total: total.round(base_currency.decimal_places),
        currency: base_currency.code,
        date: date,
        items_count: items.length
      }
    end

    private

    def resolve_currency(currency_or_code)
      return currency_or_code if currency_or_code.is_a?(Gl::Currency)

      Gl::Currency.find_by!(
        corporate: corporate,
        code: currency_or_code.to_s.upcase
      )
    rescue ActiveRecord::RecordNotFound
      raise ArgumentError, "Currency '#{currency_or_code}' not found"
    end

    def zero_result(from, to, date)
      {
        amount: 0,
        rate: 1.0,
        from_currency: from.code,
        to_currency: to.code,
        date: date,
        converted: false
      }
    end

    def zero_gain_loss
      {
        gain_loss: 0,
        gain_loss_type: 'none'
      }
    end
  end
end
