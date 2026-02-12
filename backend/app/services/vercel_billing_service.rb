# frozen_string_literal: true

# VercelBillingService - Fetches real billing data from Vercel API
#
# SSoT: THE ONE source for Vercel cost data on the Architecture dashboard
#
# Requires: VERCEL_TOKEN env var (Bearer token from Vercel account)
#           VERCEL_TEAM_ID env var (team_xxx from Vercel)
#
class VercelBillingService
  CACHE_KEY = "vercel_billing_data"
  CACHE_TTL = 1.hour

  class << self
    def billing(force_refresh: false)
      Rails.cache.delete(CACHE_KEY) if force_refresh

      cached = Rails.cache.read(CACHE_KEY)
      return cached.merge(cached: true) if cached

      result = fetch_billing
      Rails.cache.write(CACHE_KEY, result, expires_in: CACHE_TTL) if result[:success]
      result.merge(cached: false)
    rescue StandardError => e
      Rails.logger.error("[VercelBillingService] Error: #{e.message}")
      fallback = Rails.cache.read(CACHE_KEY)
      fallback ? fallback.merge(cached: true) : { success: false, error: e.message }
    end

    private

    def fetch_billing
      token = ENV["VERCEL_TOKEN"]
      team_id = ENV["VERCEL_TEAM_ID"]
      return { success: false, error: "VERCEL_TOKEN not configured" } unless token.present?
      return { success: false, error: "VERCEL_TEAM_ID not configured" } unless team_id.present?

      # Fetch latest 2 invoices for comparison
      invoices_data = vercel_get(token, "/v1/invoices?teamId=#{team_id}&limit=2")
      return { success: false, error: "Failed to fetch Vercel invoices" } unless invoices_data

      invoices = invoices_data["data"] || []
      return { success: false, error: "No invoices found" } if invoices.empty?

      current = invoices[0]
      previous = invoices[1]

      # Parse line items from current invoice
      line_items = (current["lineItems"] || []).map do |li|
        amount = li["amount"].to_f
        next if amount == 0

        {
          name: li["title"] || li["description"],
          amount: amount,
          quantity: li["quantity"],
          unit: li.dig("unit", "plural") || li.dig("unit", "singular"),
          group: li["group"]
        }
      end.compact.sort_by { |li| -li[:amount] }

      # Parse groups (Infrastructure usage vs Vercel platform)
      groups = (current["groups"] || []).map do |g|
        { id: g["id"], title: g["title"], total: g["total"].to_f, subtotal: g["subtotal"].to_f }
      end

      # Build minutes is the key cost driver
      build_minutes_item = line_items.find { |li| li[:name]&.include?("Build") }
      build_minutes = build_minutes_item ? {
        cost: build_minutes_item[:amount],
        minutes: build_minutes_item[:quantity].to_i
      } : nil

      # Previous month build minutes for comparison
      prev_build = nil
      if previous
        prev_line_items = (previous["lineItems"] || [])
        prev_bm = prev_line_items.find { |li| (li["title"] || "").include?("Build") }
        if prev_bm
          prev_build = {
            cost: prev_bm["amount"].to_f,
            minutes: prev_bm["quantity"].to_i
          }
        end
      end

      {
        success: true,
        plan: "pro",
        currentInvoice: {
          number: current["invoiceNumber"],
          total: current["amountDue"].to_f,
          status: current["status"],
          createdAt: current["createdAt"],
          groups: groups,
          lineItems: line_items.first(10)  # Top 10 by cost
        },
        previousInvoice: previous ? {
          number: previous["invoiceNumber"],
          total: previous["amountDue"].to_f,
          status: previous["status"]
        } : nil,
        buildMinutes: build_minutes,
        previousBuildMinutes: prev_build,
        teamSeats: line_items.find { |li| li[:name]&.include?("Seat") }&.dig(:quantity) || 1,
        fetchedAt: Time.current.iso8601
      }
    end

    def vercel_get(token, path)
      uri = URI("https://api.vercel.com#{path}")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 10
      http.read_timeout = 15

      request = Net::HTTP::Get.new(uri)
      request["Authorization"] = "Bearer #{token}"
      request["Content-Type"] = "application/json"

      response = http.request(request)
      return nil unless response.is_a?(Net::HTTPSuccess)

      JSON.parse(response.body)
    rescue StandardError => e
      Rails.logger.error("[VercelBillingService] API call failed: #{e.message}")
      nil
    end
  end
end
