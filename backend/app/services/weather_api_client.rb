require "net/http"
require "json"

class WeatherApiClient
  BASE_URL = "https://api.weatherapi.com/v1"

  class Error < StandardError; end
  class ConfigurationError < Error; end
  class ApiError < Error; end

  def initialize
    @api_key = ENV["WEATHER_API_KEY"]
    raise ConfigurationError, "WEATHER_API_KEY not configured" if @api_key.blank?
  end

  # Fetch historical weather data for a specific date and location
  # @param location [String] Location (suburb, city, or coordinates)
  # @param date [Date] Date to fetch weather for
  # @return [Hash] Weather data including rainfall
  def fetch_historical(location, date)
    raise ArgumentError, "Location cannot be blank" if location.blank?
    raise ArgumentError, "Date cannot be blank" if date.blank?
    raise ArgumentError, "Date cannot be in the future" if date > Date.current

    url = build_url("/history.json", {
      q: location,
      dt: date.strftime("%Y-%m-%d")
    })

    response = make_request(url)
    parse_response(response)
  rescue StandardError => e
    Rails.logger.error("WeatherAPI error: #{e.message}")
    raise ApiError, "Failed to fetch weather data: #{e.message}"
  end

  # Parse API response and extract rainfall data
  # @param response [Hash] Raw API response
  # @return [Hash] Normalized weather data
  def parse_response(response)
    day_data = response.dig("forecast", "forecastday", 0, "day")

    return {} unless day_data

    {
      rainfall_mm: day_data["totalprecip_mm"].to_f,
      date: response.dig("forecast", "forecastday", 0, "date"),
      location: response.dig("location", "name"),
      region: response.dig("location", "region"),
      country: response.dig("location", "country"),
      max_temp_c: day_data["maxtemp_c"].to_f,
      min_temp_c: day_data["mintemp_c"].to_f,
      condition: day_data.dig("condition", "text"),
      raw_response: response
    }
  end

  private

  def build_url(path, params = {})
    uri = URI("#{BASE_URL}#{path}")
    uri.query = URI.encode_www_form(params.merge(key: @api_key))
    uri
  end

  def make_request(uri)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.read_timeout = 10
    http.open_timeout = 10

    request = Net::HTTP::Get.new(uri)
    response = http.request(request)

    unless response.is_a?(Net::HTTPSuccess)
      raise ApiError, "HTTP #{response.code}: #{response.body}"
    end

    JSON.parse(response.body)
  end
end
