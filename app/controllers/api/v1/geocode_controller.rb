class Api::V1::GeocodeController < ApplicationController
  # GET /api/v1/geocode/search?q=address
  # Proxies geocoding requests to Mapbox to avoid CORS issues and protect API key
  def search
    query = params[:q]

    if query.blank? || query.length < 3
      render json: { error: "Query must be at least 3 characters" }, status: :bad_request
      return
    end

    mapbox_token = ENV["MAPBOX_ACCESS_TOKEN"]

    if mapbox_token.blank?
      render json: { error: "Geocoding not configured" }, status: :service_unavailable
      return
    end

    # Add Australia to the query for better results
    search_query = "#{query}, Australia"

    params_hash = {
      access_token: mapbox_token,
      country: "au",
      limit: 8,
      types: "address,place"
    }

    url = "https://api.mapbox.com/geocoding/v5/mapbox.places/#{URI.encode_www_form_component(search_query)}.json?#{params_hash.to_query}"

    response = HTTParty.get(url, timeout: 10)

    unless response.success?
      render json: { error: "Geocoding request failed" }, status: :bad_gateway
      return
    end

    data = response.parsed_response
    data = JSON.parse(data) if data.is_a?(String)

    suggestions = Array(data["features"]).map do |feature|
      context = feature["context"] || []

      suburb = context.find { |c| c["id"].to_s.start_with?("place", "locality") }&.dig("text")
      state = context.find { |c| c["id"].to_s.start_with?("region") }&.dig("text")
      postcode = context.find { |c| c["id"].to_s.start_with?("postcode") }&.dig("text")

      {
        id: feature["id"],
        placeName: feature["place_name"],
        center: feature["center"], # [longitude, latitude]
        address: {
          houseNumber: feature["address"] || "",
          street: feature["text"] || "",
          suburb: suburb || "",
          state: abbreviate_state(state) || "",
          postcode: postcode || ""
        }
      }
    end

    render json: { suggestions: suggestions }
  rescue StandardError => e
    Rails.logger.error "Geocoding error: #{e.message}"
    render json: { error: "Geocoding request failed" }, status: :internal_server_error
  end

  private

  def abbreviate_state(state_name)
    return nil if state_name.blank?

    abbreviations = {
      "Queensland" => "QLD",
      "New South Wales" => "NSW",
      "Victoria" => "VIC",
      "South Australia" => "SA",
      "Western Australia" => "WA",
      "Tasmania" => "TAS",
      "Northern Territory" => "NT",
      "Australian Capital Territory" => "ACT"
    }
    abbreviations[state_name] || state_name
  end
end
