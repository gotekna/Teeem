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

      # Fetch latest 2 paid invoices + upcoming (current period) in parallel
      invoices_data = vercel_get(token, "/v1/invoices?teamId=#{team_id}&limit=2")
      upcoming_data = vercel_get(token, "/v1/invoices/upcoming?teamId=#{team_id}")

      return { success: false, error: "Failed to fetch Vercel invoices" } unless invoices_data

      invoices = invoices_data["data"] || []
      return { success: false, error: "No invoices found" } if invoices.empty?

      last_paid = invoices[0]
      previous = invoices[1]

      # Parse line items from last paid invoice
      line_items = parse_line_items(last_paid)

      # Build minutes from last paid invoice (for comparison)
      last_build = extract_build_minutes(last_paid)
      prev_build = previous ? extract_build_minutes(previous) : nil

      # Current billing period from upcoming invoice
      upcoming_invoice = upcoming_data&.dig("data", 0)
      current_period = nil
      if upcoming_invoice
        upcoming_build = extract_build_minutes_detail(upcoming_invoice)
        current_period = {
          periodStart: upcoming_build&.dig(:periodStart),
          periodEnd: upcoming_build&.dig(:periodEnd),
          minutesUsed: upcoming_build&.dig(:minutes) || 0,
          minutesCost: upcoming_build&.dig(:cost) || 0,
          allocationCost: upcoming_build&.dig(:allocationCost) || 0,
          overageCost: upcoming_build&.dig(:overageCost) || 0,
          totalCost: upcoming_build&.dig(:totalCost) || 0,
          amountDue: upcoming_invoice["amountDue"].to_f,
          dueDate: upcoming_invoice["dueDate"],
          teamSeats: extract_team_seats(upcoming_invoice)
        }
      end

      {
        success: true,
        plan: "pro",
        currentPeriod: current_period,
        currentInvoice: {
          number: last_paid["invoiceNumber"],
          total: last_paid["amountDue"].to_f,
          status: last_paid["status"],
          createdAt: last_paid["createdAt"]
        },
        previousInvoice: previous ? {
          number: previous["invoiceNumber"],
          total: previous["amountDue"].to_f,
          status: previous["status"]
        } : nil,
        buildMinutes: last_build ? { cost: last_build[:cost], minutes: last_build[:minutes] } : nil,
        previousBuildMinutes: prev_build ? { cost: prev_build[:cost], minutes: prev_build[:minutes] } : nil,
        teamSeats: extract_team_seats(last_paid),
        fetchedAt: Time.current.iso8601
      }
    end

    def parse_line_items(invoice)
      (invoice["lineItems"] || []).map do |li|
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
    end

    def extract_build_minutes(invoice)
      bm = (invoice["lineItems"] || []).find { |li| (li["title"] || "").include?("Build") }
      return nil unless bm

      { cost: bm["amount"].to_f, minutes: bm["quantity"].to_i }
    end

    def extract_build_minutes_detail(invoice)
      bm = (invoice["lineItems"] || []).find { |li| (li["title"] || "").include?("Build") }
      return nil unless bm

      consumption = bm["consumption"] || {}
      {
        minutes: bm["quantity"].to_i,
        cost: bm["amount"].to_f,
        allocationCost: consumption["allocation"].to_f,
        overageCost: consumption["onDemand"].to_f,
        totalCost: consumption["total"].to_f,
        periodStart: bm["periodStart"],
        periodEnd: bm["periodEnd"]
      }
    end

    def extract_team_seats(invoice)
      seat_item = (invoice["lineItems"] || []).find { |li| (li["title"] || "").include?("Seat") }
      # 1 seat included with Pro plan + additional seats from line item
      additional = seat_item ? seat_item["quantity"].to_i : 0
      1 + additional
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
