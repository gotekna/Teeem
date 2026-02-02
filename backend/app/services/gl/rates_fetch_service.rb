# frozen_string_literal: true

module Gl
  # Service for fetching exchange rates from external sources
  #
  # Supported sources:
  # - RBA (Reserve Bank of Australia) - Free, daily rates
  # - Xero - From connected Xero organization
  # - Manual entry
  #
  class RatesFetchService
    attr_reader :corporate

    # RBA RSS feed for exchange rates
    RBA_RATES_URL = 'https://www.rba.gov.au/rss/rss-cb-exchange-rates.xml'

    # Currency codes RBA provides rates for
    RBA_CURRENCIES = %w[USD CNY JPY EUR KRW GBP SGD INR THB NZD TWD MYR IDR VND AED].freeze

    def initialize(corporate)
      @corporate = corporate
    end

    # Fetch and store rates from the best available source
    #
    # @param date [Date] The date to fetch rates for
    # @param source [String] Preferred source ('auto', 'rba', 'xero', 'manual')
    # @return [Hash] { success:, rates_updated:, source:, errors: }
    #
    def fetch_rates(date: Date.current, source: 'auto')
      case source
      when 'auto'
        fetch_auto(date)
      when 'rba'
        fetch_from_rba(date)
      when 'xero'
        fetch_from_xero(date)
      else
        { success: false, error: "Unknown source: #{source}" }
      end
    end

    # Fetch rates automatically using best available source
    def fetch_auto(date = Date.current)
      # Try RBA first (free, reliable)
      result = fetch_from_rba(date)
      return result if result[:success]

      # Try Xero if connected
      if xero_connected?
        result = fetch_from_xero(date)
        return result if result[:success]
      end

      { success: false, error: 'No rate source available' }
    end

    # Fetch rates from RBA (Reserve Bank of Australia)
    #
    # RBA publishes daily rates for major currencies against AUD
    # Free, no API key required
    #
    def fetch_from_rba(date = Date.current)
      # RBA only provides current day rates
      # For historical rates, we use the most recent available
      require 'net/http'
      require 'rexml/document'

      uri = URI(RBA_RATES_URL)
      response = Net::HTTP.get_response(uri)

      unless response.is_a?(Net::HTTPSuccess)
        return { success: false, error: "RBA request failed: #{response.code}" }
      end

      rates = parse_rba_response(response.body)
      return { success: false, error: 'No rates found in RBA response' } if rates.empty?

      # Store the rates
      rates_updated = 0
      rates.each do |currency_code, rate|
        currency = find_or_create_currency(currency_code)
        next unless currency

        Gl::ExchangeRate.set_rate(
          corporate,
          currency,
          date,
          rate,
          source: 'rba'
        )
        rates_updated += 1
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.warn "[RatesFetchService] Failed to save rate for #{currency_code}: #{e.message}"
      end

      {
        success: true,
        rates_updated: rates_updated,
        source: 'rba',
        date: date,
        currencies: rates.keys
      }
    rescue StandardError => e
      { success: false, error: "RBA fetch failed: #{e.message}" }
    end

    # Fetch rates from Xero
    #
    # Uses Xero's currency rates API for the connected organization
    #
    def fetch_from_xero(date = Date.current)
      unless xero_connected?
        return { success: false, error: 'Xero not connected' }
      end

      # Get Xero credentials
      credential = XeroCredential.active_for_company(corporate)
      return { success: false, error: 'No active Xero credential' } unless credential

      # Fetch rates from Xero API
      client = XeroApiClient.new(credential)
      response = client.get('Currencies')

      return { success: false, error: 'Failed to fetch Xero currencies' } unless response['Currencies']

      rates_updated = 0
      response['Currencies'].each do |xero_currency|
        code = xero_currency['Code']
        next if code == 'AUD' # Skip base currency

        # Xero may not provide rates for all currencies
        # We need to get rate from a different endpoint
        rate_response = fetch_xero_rate(client, code, date)
        next unless rate_response

        currency = find_or_create_currency(code)
        next unless currency

        Gl::ExchangeRate.set_rate(
          corporate,
          currency,
          date,
          rate_response,
          source: 'xero'
        )
        rates_updated += 1
      rescue StandardError => e
        Rails.logger.warn "[RatesFetchService] Failed to fetch Xero rate for #{code}: #{e.message}"
      end

      {
        success: true,
        rates_updated: rates_updated,
        source: 'xero',
        date: date
      }
    rescue StandardError => e
      { success: false, error: "Xero fetch failed: #{e.message}" }
    end

    # Set rate manually
    def set_manual_rate(currency_code, rate, date: Date.current)
      currency = find_or_create_currency(currency_code)
      return { success: false, error: "Currency #{currency_code} not found" } unless currency

      Gl::ExchangeRate.set_rate(
        corporate,
        currency,
        date,
        rate,
        source: 'manual'
      )

      {
        success: true,
        currency: currency_code,
        rate: rate,
        date: date,
        source: 'manual'
      }
    rescue ActiveRecord::RecordInvalid => e
      { success: false, error: e.message }
    end

    # Import rates from a hash
    #
    # @param rates [Hash] { 'USD' => 0.67, 'EUR' => 0.58, ... }
    # @param date [Date] Date for the rates
    # @param source [String] Source identifier
    # @return [Hash] Result summary
    #
    def import_rates(rates, date: Date.current, source: 'manual')
      Gl::ExchangeRate.import_rates(corporate, rates, date: date, source: source)

      {
        success: true,
        rates_updated: rates.keys.length,
        date: date,
        source: source
      }
    end

    # Get rate history for a currency
    def rate_history(currency_code, from_date: 30.days.ago, to_date: Date.current)
      currency = Gl::Currency.find_by(
        corporate: corporate,
        code: currency_code.upcase
      )

      return [] unless currency

      currency.exchange_rates
        .where(effective_date: from_date..to_date)
        .order(:effective_date)
        .map do |rate|
          {
            date: rate.effective_date,
            rate: rate.rate,
            source: rate.source,
            change: rate.rate_change,
            change_percentage: rate.rate_change_percentage
          }
        end
    end

    # Check if rates are stale (older than threshold)
    def rates_stale?(threshold: 1.day)
      latest_rate = Gl::ExchangeRate
        .joins(:gl_currency)
        .where(gl_currencies: { corporate: corporate })
        .order(effective_date: :desc)
        .first

      return true unless latest_rate

      latest_rate.effective_date < threshold.ago.to_date
    end

    private

    def parse_rba_response(xml_body)
      doc = REXML::Document.new(xml_body)
      rates = {}

      doc.elements.each('rss/channel/item') do |item|
        title = item.elements['title']&.text
        description = item.elements['description']&.text

        next unless title && description

        # Parse title like "USD/AUD"
        match = title.match(/^(\w{3})\/AUD/)
        next unless match

        currency_code = match[1]
        next unless RBA_CURRENCIES.include?(currency_code)

        # Parse rate from description
        # Format: "1 Australian Dollar = X.XXXX Currency"
        rate_match = description.match(/1 Australian Dollar = ([\d.]+)/)
        next unless rate_match

        # RBA gives AUD to foreign, we want foreign to AUD
        foreign_rate = rate_match[1].to_f
        rate_to_aud = foreign_rate.zero? ? 0 : 1 / foreign_rate

        rates[currency_code] = rate_to_aud.round(6)
      end

      rates
    end

    def find_or_create_currency(code)
      code = code.to_s.upcase
      info = Gl::Currency::COMMON_CURRENCIES[code]

      Gl::Currency.find_or_create_by!(
        corporate: corporate,
        code: code
      ) do |currency|
        if info
          currency.name = info[:name]
          currency.symbol = info[:symbol]
          currency.decimal_places = info[:decimal_places]
        else
          currency.name = code
          currency.symbol = code
          currency.decimal_places = 2
        end
        currency.is_base_currency = false
      end
    rescue ActiveRecord::RecordInvalid
      nil
    end

    def xero_connected?
      XeroCredential.active_for_company(corporate).present?
    rescue
      false
    end

    def fetch_xero_rate(client, currency_code, date)
      # Xero doesn't have a direct exchange rate endpoint
      # We'd need to calculate from a currency pair or use a recent invoice
      # For now, return nil and rely on RBA
      nil
    end
  end
end
