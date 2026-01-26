# frozen_string_literal: true

# CloudflareService - API client for Cloudflare DNS management
#
# Used by the email reseller feature to automatically provision DNS records
# when new email subscriptions are created.
#
# API Documentation: https://developers.cloudflare.com/api/
#
# Usage:
#   service = CloudflareService.new
#   service.provision_email_dns("example.com")
#   service.verify_email_dns("example.com")
#
class CloudflareService
  class ApiError < StandardError; end
  class AuthenticationError < ApiError; end
  class ZoneNotFoundError < ApiError; end
  class RecordExistsError < ApiError; end
  class RateLimitError < ApiError; end

  BASE_URL = "https://api.cloudflare.com/client/v4"

  def initialize(credential = nil)
    @credential = credential || CloudflareCredential.active_credential
    raise AuthenticationError, "Cloudflare not configured" unless @credential
  end

  # ====================
  # CONNECTION
  # ====================

  # Test API connection
  # @return [Boolean]
  def test_connection
    response = get("user/tokens/verify")
    response["success"] == true
  rescue ApiError => e
    Rails.logger.warn "[CloudflareService] Connection test failed: #{e.message}"
    false
  end

  # ====================
  # ZONE MANAGEMENT
  # ====================

  # List all zones in the account
  # @return [Array<Hash>]
  def list_zones
    response = get("zones", { per_page: 50 })
    response["result"] || []
  end

  # Get a specific zone by domain name
  # @param domain [String] Domain name
  # @return [Hash, nil]
  def get_zone(domain)
    response = get("zones", { name: domain })
    zones = response["result"] || []
    zones.first
  end

  # Check if zone exists
  # @param domain [String] Domain name
  # @return [Boolean]
  def zone_exists?(domain)
    get_zone(domain).present?
  end

  # Get zone ID for a domain
  # @param domain [String] Domain name
  # @return [String]
  # @raise [ZoneNotFoundError] if domain not found
  def zone_id_for(domain)
    zone = get_zone(domain)
    raise ZoneNotFoundError, "Zone not found for #{domain}" unless zone

    zone["id"]
  end

  # ====================
  # DNS RECORD MANAGEMENT
  # ====================

  # List all DNS records for a zone
  # @param zone_id [String] Cloudflare zone ID
  # @param type [String] Optional record type filter (A, CNAME, MX, TXT, etc.)
  # @return [Array<Hash>]
  def list_dns_records(zone_id, type: nil)
    params = { per_page: 100 }
    params[:type] = type.upcase if type
    response = get("zones/#{zone_id}/dns_records", params)
    response["result"] || []
  end

  # Get a specific DNS record
  # @param zone_id [String] Cloudflare zone ID
  # @param record_id [String] DNS record ID
  # @return [Hash, nil]
  def get_dns_record(zone_id, record_id)
    response = get("zones/#{zone_id}/dns_records/#{record_id}")
    response["result"]
  rescue ApiError
    nil
  end

  # Create a DNS record
  # @param zone_id [String] Cloudflare zone ID
  # @param type [String] Record type (A, CNAME, MX, TXT)
  # @param name [String] Record name (use @ for root)
  # @param content [String] Record value
  # @param priority [Integer] Priority (for MX records)
  # @param proxied [Boolean] Enable Cloudflare proxy (default: false)
  # @param ttl [Integer] TTL in seconds (1 = auto)
  # @return [Hash] Created record
  def create_dns_record(zone_id, type:, name:, content:, priority: nil, proxied: false, ttl: 1)
    payload = {
      type: type.upcase,
      name: name,
      content: content,
      ttl: ttl,
      proxied: proxied
    }
    payload[:priority] = priority if priority && type.upcase == 'MX'

    response = post("zones/#{zone_id}/dns_records", payload)

    unless response["success"]
      errors = response["errors"]&.map { |e| e["message"] }&.join(", ") || "Unknown error"

      # Check if record already exists
      if errors.include?("already exists")
        raise RecordExistsError, "Record already exists: #{name}"
      end

      raise ApiError, "Failed to create DNS record: #{errors}"
    end

    response["result"]
  end

  # Update a DNS record
  # @param zone_id [String] Cloudflare zone ID
  # @param record_id [String] DNS record ID
  # @return [Hash] Updated record
  def update_dns_record(zone_id, record_id, **attrs)
    response = patch("zones/#{zone_id}/dns_records/#{record_id}", attrs)

    unless response["success"]
      errors = response["errors"]&.map { |e| e["message"] }&.join(", ") || "Unknown error"
      raise ApiError, "Failed to update DNS record: #{errors}"
    end

    response["result"]
  end

  # Delete a DNS record
  # @param zone_id [String] Cloudflare zone ID
  # @param record_id [String] DNS record ID
  # @return [Boolean]
  def delete_dns_record(zone_id, record_id)
    response = delete("zones/#{zone_id}/dns_records/#{record_id}")
    response["success"] == true
  end

  # ====================
  # EMAIL-SPECIFIC HELPERS
  # ====================

  # Provision all required DNS records for email hosting
  # @param domain [String] Domain name
  # @param dkim_value [String] DKIM public key (optional)
  # @return [Hash] Results with created records
  def provision_email_dns(domain, dkim_value: nil)
    zone_id = zone_id_for(domain)
    records = EmailDnsRecord.default_records_for(domain, dkim_value: dkim_value)

    results = {
      success: true,
      created: [],
      skipped: [],
      errors: []
    }

    records.each do |record|
      begin
        # For @ records, use the domain name
        name = record[:name] == '@' ? domain : "#{record[:name]}.#{domain}"

        created = create_dns_record(
          zone_id,
          type: record[:record_type],
          name: name,
          content: record[:content],
          priority: record[:priority],
          proxied: false  # Never proxy email records
        )

        results[:created] << {
          type: record[:record_type],
          name: record[:name],
          cloudflare_id: created["id"]
        }
      rescue RecordExistsError => e
        results[:skipped] << {
          type: record[:record_type],
          name: record[:name],
          reason: e.message
        }
      rescue ApiError => e
        results[:success] = false
        results[:errors] << {
          type: record[:record_type],
          name: record[:name],
          error: e.message
        }
      end
    end

    results
  end

  # Verify email DNS records are present and correct
  # @param domain [String] Domain name
  # @return [Hash] Verification results
  def verify_email_dns(domain)
    zone_id = zone_id_for(domain)
    existing_records = list_dns_records(zone_id)
    expected_records = EmailDnsRecord.default_records_for(domain)

    results = {
      verified: [],
      missing: [],
      incorrect: []
    }

    expected_records.each do |expected|
      name = expected[:name] == '@' ? domain : "#{expected[:name]}.#{domain}"
      type = expected[:record_type].upcase

      # Find matching record
      found = existing_records.find do |r|
        r["type"] == type && r["name"] == name
      end

      if found.nil?
        results[:missing] << {
          type: expected[:record_type],
          name: expected[:name],
          expected_content: expected[:content]
        }
      elsif found["content"] != expected[:content]
        results[:incorrect] << {
          type: expected[:record_type],
          name: expected[:name],
          expected_content: expected[:content],
          actual_content: found["content"],
          cloudflare_id: found["id"]
        }
      else
        results[:verified] << {
          type: expected[:record_type],
          name: expected[:name],
          cloudflare_id: found["id"]
        }
      end
    end

    results[:status] = if results[:missing].empty? && results[:incorrect].empty?
                         :verified
                       elsif results[:missing].any?
                         :missing
                       else
                         :incorrect
                       end

    results
  end

  # Get DNS status for a domain (quick check)
  # @param domain [String] Domain name
  # @return [Hash] Status summary
  def get_dns_status(domain)
    verification = verify_email_dns(domain)

    {
      domain: domain,
      status: verification[:status],
      verified_count: verification[:verified].count,
      missing_count: verification[:missing].count,
      incorrect_count: verification[:incorrect].count,
      total_expected: EmailDnsRecord::REQUIRED_RECORDS.count
    }
  rescue ZoneNotFoundError
    {
      domain: domain,
      status: :zone_not_found,
      verified_count: 0,
      missing_count: 0,
      incorrect_count: 0,
      total_expected: EmailDnsRecord::REQUIRED_RECORDS.count
    }
  end

  private

  # HTTP GET request
  def get(path, params = {})
    response = HTTP
      .auth("Bearer #{@credential.api_token}")
      .timeout(connect: 5, write: 10, read: 30)
      .get("#{BASE_URL}/#{path}", params: params)

    handle_response(response)
  end

  # HTTP POST request
  def post(path, body)
    response = HTTP
      .auth("Bearer #{@credential.api_token}")
      .headers("Content-Type" => "application/json")
      .timeout(connect: 5, write: 10, read: 30)
      .post("#{BASE_URL}/#{path}", json: body)

    handle_response(response)
  end

  # HTTP PATCH request
  def patch(path, body)
    response = HTTP
      .auth("Bearer #{@credential.api_token}")
      .headers("Content-Type" => "application/json")
      .timeout(connect: 5, write: 10, read: 30)
      .patch("#{BASE_URL}/#{path}", json: body)

    handle_response(response)
  end

  # HTTP DELETE request
  def delete(path)
    response = HTTP
      .auth("Bearer #{@credential.api_token}")
      .timeout(connect: 5, write: 10, read: 30)
      .delete("#{BASE_URL}/#{path}")

    handle_response(response)
  end

  # Handle API response
  def handle_response(response)
    case response.status.code
    when 401
      raise AuthenticationError, "Invalid API token"
    when 429
      raise RateLimitError, "Rate limit exceeded"
    when 400..499
      body = response.parse rescue {}
      errors = body.dig("errors")&.map { |e| e["message"] }&.join(", ") || "Client error"
      raise ApiError, errors
    when 500..599
      raise ApiError, "Cloudflare server error: #{response.status}"
    end

    response.parse
  rescue JSON::ParserError
    raise ApiError, "Invalid JSON response from Cloudflare"
  end
end
