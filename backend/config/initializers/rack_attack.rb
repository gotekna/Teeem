class Rack::Attack
  # Use Redis in production for distributed rate limiting, MemoryStore in development
  Rack::Attack.cache.store = if Rails.env.production? && ENV["REDIS_URL"].present?
    ActiveSupport::Cache::RedisCacheStore.new(url: ENV["REDIS_URL"])
  else
    ActiveSupport::Cache::MemoryStore.new
  end

  # Whitelist localhost for development
  safelist("allow-localhost") do |req|
    req.ip == "127.0.0.1" || req.ip == "::1" || req.ip == "localhost"
  end

  # Whitelist WebSocket connections (ActionCable)
  # WebSockets are long-lived connections, not request floods
  safelist("allow-websocket") do |req|
    req.path == "/cable"
  end

  # Whitelist health check endpoint
  safelist("allow-health-check") do |req|
    req.path == "/up" || req.path == "/version"
  end

  # Staging environment detection
  # SECURITY NOTE: Staging still has rate limits (higher thresholds) rather than being fully disabled.
  # This prevents abuse while allowing development/testing flexibility.
  is_staging = ENV["HEROKU_APP_NAME"]&.include?("rob-dev") || ENV["HEROKU_APP_NAME"]&.include?("sam-dev")

  # Determine rate limit based on environment
  # Staging: 3000/5min (higher for development/testing)
  # Production: 1500/5min to handle SPA concurrent requests, retries, and email polling
  general_limit = is_staging ? 3000 : 1500

  # Throttle all requests by IP (prevent general abuse)
  throttle("req/ip", limit: general_limit, period: 5.minutes) do |req|
    req.ip
  end

  # Throttle POST requests to /api/v1/auth/* by IP address
  throttle("auth/ip", limit: 5, period: 20.seconds) do |req|
    if req.path =~ %r{^/api/v1/auth/} && req.post?
      req.ip
    end
  end

  # Throttle external API endpoints (Unreal Engine)
  throttle("external/unreal", limit: 60, period: 1.minute) do |req|
    if req.path =~ %r{^/api/v1/external/unreal_estimates}
      req.ip
    end
  end

  # Throttle webhook endpoints
  throttle("webhooks/ip", limit: 100, period: 1.minute) do |req|
    if req.path =~ %r{^/api/v1/(xero|outlook)/webhook}
      req.ip
    end
  end

  # Throttle Xero API requests (per tenant ID)
  # Each tenant gets its own 60/minute limit, so 10 tenants = 600 total requests/minute
  throttle("xero/tenant", limit: 60, period: 1.minute) do |req|
    if req.path =~ %r{^/api/v1/xero/}
      # Extract tenant ID from query params, path, or fall back to IP
      tenant_id = req.params["tenant_id"] ||
                  req.path.match(%r{/tenants/([^/]+)})&.[](1) ||
                  req.env["rack.session"]&.dig("xero_tenant_id")
      # Use tenant_id + IP to rate limit per-tenant per-user
      tenant_id ? "#{req.ip}:#{tenant_id}" : req.ip
    end
  end

  # Throttle password reset requests
  throttle("password/email", limit: 3, period: 1.hour) do |req|
    if req.path == "/api/v1/auth/forgot_password" && req.post?
      req.params["email"].presence
    end
  end

  # ============================================
  # EXPENSIVE ENDPOINT THROTTLES
  # Protect CPU-intensive and AI-powered endpoints
  # ============================================

  # PDF generation endpoints (CPU-intensive, uses Puppeteer)
  throttle("pdf/ip", limit: 10, period: 1.minute) do |req|
    if req.path =~ %r{^/api/v1/(documents|invoices|quotes)/.*/(pdf|generate_pdf|preview_pdf)}
      req.ip
    end
  end

  # AI processing endpoints (Claude API costs, slow responses)
  throttle("ai/ip", limit: 20, period: 1.minute) do |req|
    if req.path =~ %r{^/api/v1/(ai_|classify|analyze|extract)}
      req.ip
    end
  end

  # Document analysis endpoints (OCR, PDF parsing)
  throttle("document_analysis/ip", limit: 15, period: 1.minute) do |req|
    if req.path =~ %r{^/api/v1/(bill_inbox|invoices)/\d+/analyze}
      req.ip
    end
  end

  # Financial export endpoints (large data queries)
  throttle("exports/ip", limit: 5, period: 1.minute) do |req|
    if req.path =~ %r{^/api/v1/financial_exports/}
      req.ip
    end
  end

  # SharePoint sync endpoints (external API calls)
  throttle("sharepoint/ip", limit: 30, period: 1.minute) do |req|
    if req.path =~ %r{^/api/v1/(sharepoint|onedrive)/}
      req.ip
    end
  end

  # Custom response for throttled requests
  self.throttled_responder = lambda do |request|
    match_data = request.env["rack.attack.match_data"] || {}
    retry_after = match_data[:period] || 60
    [
      429,
      {
        "Content-Type" => "application/json",
        "Retry-After" => retry_after.to_s
      },
      [ { error: "Rate limit exceeded. Please try again later." }.to_json ]
    ]
  end

  # Log blocked requests
  ActiveSupport::Notifications.subscribe("throttle.rack_attack") do |_name, _start, _finish, _request_id, payload|
    req = payload[:request]
    Rails.logger.warn "[Rack::Attack] Throttled #{req.ip} for #{req.path}"
  end
end
