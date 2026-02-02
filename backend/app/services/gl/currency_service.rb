# frozen_string_literal: true

module Gl
  # Currency Service
  # Wraps multi-currency functionality
  # Delegates to CurrencyConverter and CurrencyRevaluationService
  class CurrencyService
    attr_reader :company

    def initialize(company)
      @company = company
    end

    # Get all currencies for company
    def currencies
      Gl::Currency.where(corporate: company).order(:code)
    end

    # Get base currency
    def base_currency
      Gl::Currency.find_by(corporate: company, is_base_currency: true) ||
        Gl::Currency.find_by(corporate: company, code: 'AUD')
    end

    # Convert amount between currencies
    def convert(amount, from_currency, to_currency, date: nil)
      converter.convert(amount, from_currency, to_currency, date: date)
    end

    # Get exchange rate
    def get_rate(from_currency, to_currency, date: nil)
      converter.get_rate(from_currency, to_currency, date: date)
    end

    # Set exchange rate
    def set_rate(currency_code, rate, date: nil)
      currency = Gl::Currency.find_by(corporate: company, code: currency_code)
      return { success: false, error: 'Currency not found' } unless currency

      effective_date = date || Date.current

      exchange_rate = Gl::ExchangeRate.find_or_initialize_by(
        corporate: company,
        gl_currency: currency,
        effective_date: effective_date
      )

      exchange_rate.rate = rate
      exchange_rate.source = 'manual'

      if exchange_rate.save
        { success: true, rate: exchange_rate }
      else
        { success: false, error: exchange_rate.errors.full_messages.join(', ') }
      end
    end

    # Fetch rates from external source
    def fetch_rates(currencies: nil)
      rates_service.fetch_all(currencies: currencies)
    end

    # Import rates from file
    def import_rates(file_data)
      rates_service.import(file_data)
    end

    # Get rate history
    def rate_history(currency_code, from_date: nil, to_date: nil)
      currency = Gl::Currency.find_by(corporate: company, code: currency_code)
      return [] unless currency

      scope = Gl::ExchangeRate.where(
        corporate: company,
        gl_currency: currency
      ).order(effective_date: :desc)

      scope = scope.where('effective_date >= ?', from_date) if from_date
      scope = scope.where('effective_date <= ?', to_date) if to_date

      scope.map do |rate|
        {
          date: rate.effective_date,
          rate: rate.rate,
          source: rate.source
        }
      end
    end

    # Check for stale rates
    def stale_rates(days: 7)
      stale_date = days.days.ago.to_date

      currencies.select do |currency|
        next if currency.is_base_currency

        latest_rate = Gl::ExchangeRate.where(
          corporate: company,
          gl_currency: currency
        ).order(effective_date: :desc).first

        latest_rate.nil? || latest_rate.effective_date < stale_date
      end
    end

    # Preview revaluation
    def revaluation_preview(as_at_date: nil)
      revaluation_service(as_at_date).preview
    end

    # Run revaluation
    def run_revaluation(as_at_date: nil)
      revaluation_service(as_at_date).run
    end

    # Get gain/loss report
    def gain_loss_report(from_date: nil, to_date: nil)
      revaluation_service.gain_loss_report(from_date: from_date, to_date: to_date)
    end

    # Setup default currencies (AUD, USD, NZD, GBP, EUR)
    def setup_defaults
      default_currencies = [
        { code: 'AUD', name: 'Australian Dollar', symbol: '$', is_base: true },
        { code: 'USD', name: 'US Dollar', symbol: 'US$', is_base: false },
        { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', is_base: false },
        { code: 'GBP', name: 'British Pound', symbol: '£', is_base: false },
        { code: 'EUR', name: 'Euro', symbol: '€', is_base: false }
      ]

      created = []
      default_currencies.each do |curr|
        currency = Gl::Currency.find_or_create_by(
          corporate: company,
          code: curr[:code]
        ) do |c|
          c.name = curr[:name]
          c.symbol = curr[:symbol]
          c.is_base_currency = curr[:is_base]
          c.active = true
        end
        created << currency.code
      end

      { success: true, currencies: created }
    end

    private

    def converter
      @converter ||= CurrencyConverter.new(company)
    end

    def rates_service
      @rates_service ||= RatesFetchService.new(company)
    end

    def revaluation_service(as_at_date = nil)
      CurrencyRevaluationService.new(company, as_at_date: as_at_date || Date.current)
    end
  end
end
