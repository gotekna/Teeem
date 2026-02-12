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
  BREAKDOWN_CACHE_KEY = "vercel_usage_breakdown"
  CACHE_TTL = 1.hour

  class << self
    def usage_breakdown(force_refresh: false)
      Rails.cache.delete(BREAKDOWN_CACHE_KEY) if force_refresh

      cached = Rails.cache.read(BREAKDOWN_CACHE_KEY)
      return cached.merge(cached: true) if cached

      result = fetch_usage_breakdown
      Rails.cache.write(BREAKDOWN_CACHE_KEY, result, expires_in: CACHE_TTL) if result[:success]
      result.merge(cached: false)
    rescue StandardError => e
      Rails.logger.error("[VercelBillingService] Breakdown error: #{e.message}")
      fallback = Rails.cache.read(BREAKDOWN_CACHE_KEY)
      fallback ? fallback.merge(cached: true) : { success: false, error: e.message }
    end

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

    def fetch_usage_breakdown
      token = ENV["VERCEL_TOKEN"]
      team_id = ENV["VERCEL_TEAM_ID"]
      return { success: false, error: "VERCEL_TOKEN not configured" } unless token.present?
      return { success: false, error: "VERCEL_TEAM_ID not configured" } unless team_id.present?

      # Get current billing period dates from upcoming invoice
      upcoming_data = vercel_get(token, "/v1/invoices/upcoming?teamId=#{team_id}")
      upcoming_invoice = upcoming_data&.dig("data", 0)
      return { success: false, error: "No upcoming invoice found" } unless upcoming_invoice

      bm_item = (upcoming_invoice["lineItems"] || []).find { |li| (li["title"] || "").include?("Build") }
      return { success: false, error: "No build minutes line item found" } unless bm_item

      # Derive billing cycle dates.
      # The line item periodStart is in milliseconds. Sanity check: if it results in
      # a date before 2020, fall back to 30 days ago (Vercel billing is monthly).
      raw_start = bm_item["periodStart"].to_i
      raw_end = bm_item["periodEnd"].to_i
      Rails.logger.info("[VercelBillingService] Raw periodStart=#{raw_start}, periodEnd=#{raw_end}")
      period_start = raw_start > 1_000_000_000_000 ? Time.at(raw_start / 1000) : Time.at(raw_start)
      period_end = raw_end > 1_000_000_000_000 ? Time.at(raw_end / 1000) : Time.at(raw_end)
      Rails.logger.info("[VercelBillingService] Resolved cycle: #{period_start} to #{period_end}")

      # If still unreasonable, fall back to ~30 days ago
      if period_start.year < 2020
        Rails.logger.warn("[VercelBillingService] periodStart unreliable (#{raw_start}), falling back to 30 days")
        period_start = 30.days.ago
      end

      # Split billing period into day-sized windows and fetch in parallel.
      # With ~10k deployments, sequential pagination takes >2 min (exceeds Heroku 30s limit).
      # Day-sized parallel fetches: ~18 days * ~1s each in 6 threads = ~3-4 seconds.
      cycle_start_date = period_start.in_time_zone("Australia/Brisbane").to_date
      period_end_date = period_end.in_time_zone("Australia/Brisbane").to_date
      today = Time.current.in_time_zone("Australia/Brisbane").to_date

      day_ranges = []
      d = cycle_start_date
      max_days = 35  # Safety: billing cycle is ~30 days, cap to prevent runaway
      while d <= today && day_ranges.length < max_days
        day_start_ms = d.in_time_zone("Australia/Brisbane").beginning_of_day.to_i * 1000
        day_end_ms = d.in_time_zone("Australia/Brisbane").end_of_day.to_i * 1000
        day_ranges << { date: d, since: day_start_ms, until_ms: day_end_ms }
        d += 1.day
      end

      # Fetch deployments for each day in parallel threads (max 6 concurrent)
      daily_data = {}
      mutex = Mutex.new
      thread_pool = []

      day_ranges.each_slice(6) do |batch|
        batch.each do |day_range|
          thread_pool << Thread.new(day_range) do |dr|
            day_deployments = fetch_day_deployments(token, team_id, dr[:since], dr[:until_ms])
            day_result = aggregate_day(day_deployments, dr[:date])
            mutex.synchronize { daily_data[dr[:date].iso8601] = day_result } if day_result
          end
        end
        thread_pool.each(&:join)
        thread_pool.clear
      end

      # Group days into weeks (aligned to billing cycle start, relative numbering)
      sorted_dates = daily_data.keys.sort
      weeks = []
      current_week = nil

      sorted_dates.each do |date_str|
        date = Date.parse(date_str)
        week_num = ((date - cycle_start_date) / 7).floor
        week_start = cycle_start_date + (week_num * 7)
        week_end = [week_start + 6, period_end_date].min

        if current_week.nil? || current_week[:weekNum] != week_num
          current_week = {
            weekNum: week_num,
            label: "Week #{week_num + 1}",
            periodStart: week_start.iso8601,
            periodEnd: week_end.iso8601,
            minutes: 0.0,
            deploys: 0,
            days: []
          }
          weeks << current_week
        end

        day = daily_data[date_str]
        current_week[:days] << day
        current_week[:minutes] += day[:minutes]
        current_week[:deploys] += day[:deploys]
      end

      weeks.each do |w|
        w[:minutes] = w[:minutes].round(1)
        w[:days].reverse!  # Latest day first within each week
      end
      weeks.reverse!  # Latest week first

      # Vercel Pro plan: 100 hours = 6,000 build minutes included per month
      included_minutes = 6_000

      {
        success: true,
        periodStart: cycle_start_date.iso8601,
        periodEnd: period_end_date.iso8601,
        totalMinutes: daily_data.values.sum { |d| d[:minutes] }.round(1),
        totalDeploys: daily_data.values.sum { |d| d[:deploys] },
        includedMinutes: included_minutes,
        weeks: weeks,
        fetchedAt: Time.current.iso8601
      }
    end

    def fetch_day_deployments(token, team_id, since_ms, until_ms)
      deployments = []
      url_cursor = nil

      loop do
        path = "/v6/deployments?teamId=#{team_id}&limit=100&since=#{since_ms}&state=READY"
        path += "&until=#{url_cursor || until_ms}"

        page = vercel_get(token, path)
        break unless page

        page_deps = page["deployments"] || []
        break if page_deps.empty?

        deployments.concat(page_deps)

        pagination = page["pagination"]
        break unless pagination && pagination["next"].present?
        url_cursor = pagination["next"]
      end

      deployments
    end

    def aggregate_day(deployments, date)
      minutes = 0.0
      deploys = 0
      projects = Hash.new { |h, k| h[k] = { minutes: 0.0, deploys: 0 } }

      deployments.each do |d|
        building_at = d["buildingAt"]
        ready_at = d["ready"]
        next unless building_at && ready_at && building_at > 0 && ready_at > 0

        duration_min = (ready_at - building_at) / 60_000.0
        next if duration_min <= 0

        project = d["name"] || "unknown"
        minutes += duration_min
        deploys += 1
        projects[project][:minutes] += duration_min
        projects[project][:deploys] += 1
      end

      return nil if deploys == 0

      {
        date: date.iso8601,
        dayLabel: date.strftime("%a %d %b"),
        minutes: minutes.round(1),
        deploys: deploys,
        projects: projects.map { |name, data| { name: name, minutes: data[:minutes].round(1), deploys: data[:deploys] } }
          .sort_by { |p| -p[:minutes] }
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
