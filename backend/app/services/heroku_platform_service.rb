# frozen_string_literal: true

# HerokuPlatformService
# Fetches live dyno and addon data from the Heroku Platform API.
# Uses HEROKU_API_KEY (same env var as worker_watchdog.rb).
# Caches results for 10 minutes. Pass force_refresh: true to bust cache.
class HerokuPlatformService
  CACHE_KEY = "heroku_platform:infrastructure"
  CACHE_TTL = 10.minutes

  # All TEEEM Heroku apps to query
  APPS = %w[
    teeem-production
    teeem-beta
    teeem-staging
    teeem-shared-worker
    teeem-sam-dev
    teeem-rob-dev
    teeem-jake-dev
  ].freeze

  # Human-readable metadata for each app
  APP_METADATA = {
    "teeem-production"    => { environment: "Production", description: "Production Rails API" },
    "teeem-beta"          => { environment: "Beta",       description: "Beta/UAT Rails API" },
    "teeem-staging"       => { environment: "Staging",    description: "Staging Rails API" },
    "teeem-shared-worker" => { environment: "Shared",     description: "Shared job processing (all envs)" },
    "teeem-sam-dev"       => { environment: "Sam Dev",    description: "Sam's dev environment" },
    "teeem-rob-dev"       => { environment: "Rob Dev",    description: "Rob's dev environment" },
    "teeem-jake-dev"      => { environment: "Jake Dev",   description: "Jake's dev environment" }
  }.freeze

  # Dyno size → monthly cost (USD). Heroku pricing as of Feb 2026.
  DYNO_COSTS = {
    "Eco"          => 5,
    "Basic"        => 7,
    "Standard-1X"  => 25,
    "Standard-2X"  => 50,
    "Performance-M" => 250,
    "Performance-L" => 500
  }.freeze

  # Addon plan → monthly cost (USD). Common Heroku addon plans.
  ADDON_COSTS = {
    # Heroku Postgres
    "heroku-postgresql:mini"        => 5,
    "heroku-postgresql:essential-0" => 5,
    "heroku-postgresql:essential-1" => 9,
    "heroku-postgresql:essential-2" => 20,
    "heroku-postgresql:standard-0"  => 50,
    "heroku-postgresql:standard-2"  => 200,
    "heroku-postgresql:premium-0"   => 200,
    # Heroku Data for Redis
    "heroku-redis:mini"             => 3,
    "heroku-redis:premium-0"        => 15,
    "heroku-redis:premium-1"        => 30,
    # Heroku Scheduler
    "scheduler:standard"            => 0,
    # Papertrail
    "papertrail:choklad"            => 0,
    "papertrail:fixa"               => 7,
    # SendGrid
    "sendgrid:starter"              => 0
  }.freeze

  # External services not on Heroku (no API to query — manual constants)
  EXTERNAL_SERVICES = [
    { name: "Vercel (Pro)",      cost: 20,       purpose: "Next.js frontend hosting + edge CDN for all environments", category: "hosting",    paidBy: "vercel" },
    { name: "Wasabi Storage",    cost: 7,        purpose: "Primary S3-compatible document warehouse (jobs, emails, corporate docs)", category: "hosting", paidBy: "wasabi" },
    { name: "Backblaze B2",      cost: "~5-10",  purpose: "Disaster recovery backups - weekly mirror from Wasabi", category: "hosting",    paidBy: "backblaze" },
    { name: "Webcentral",        cost: "~15",    purpose: "Domain registration & DNS for teeem.com.au", category: "hosting",    paidBy: "webcentral", note: "Update with actual cost" },
    { name: "Cloudflare",        cost: 0,        purpose: "DNS management, email DNS provisioning, wildcard SSL (free tier)", category: "hosting", paidBy: "free" },
    { name: "Anthropic (Claude)", cost: "~50-100", purpose: "AI summaries, email classification, plan review, writing assistant, invoice matching", category: "ai", paidBy: "anthropic" },
    { name: "AWS Rekognition",   cost: "~1-5",   purpose: "Face verification for site check-in/out (prevents buddy punching)", category: "ai", paidBy: "aws" },
    { name: "Xero API",          cost: 0,        purpose: "Contact/invoice sync via webhooks (included in Xero subscription)", category: "integration", paidBy: "free" },
    { name: "Microsoft Graph",   cost: 0,        purpose: "Email sync (O365), SharePoint, calendar (included in M365)", category: "integration", paidBy: "free" },
    { name: "Polaris Mail",      cost: "TBD",    purpose: "White-label email hosting - mailbox provisioning, aliases, billing", category: "integration", paidBy: "polaris", note: "Email reseller" },
    { name: "Sentry",            cost: 0,        purpose: "Error tracking & performance monitoring (free tier: 5k errors/mo)", category: "integration", paidBy: "free" },
    { name: "WeatherAPI",        cost: 0,        purpose: "Automatic rain log tracking for construction jobs (free tier: 100k calls/mo)", category: "integration", paidBy: "free" },
    { name: "Cloudinary",        cost: 0,        purpose: "Product images, pricebook photos, image optimization (free tier: 25GB)", category: "integration", paidBy: "free" },
    { name: "Metabase",          cost: 0,        purpose: "Business intelligence dashboards (self-hosted on Heroku)", category: "integration", paidBy: "heroku", note: "Runs on Heroku" },
    { name: "Stripe",            cost: "fees only", purpose: "Payment processing - payment links, subscriptions, customer portal", category: "payperuse", paidBy: "stripe" },
    { name: "Twilio",            cost: "per msg", purpose: "SMS notifications - quote reminders, alerts", category: "payperuse", paidBy: "twilio" },
    { name: "Basiq",             cost: "TBD",    purpose: "Bank feed aggregation - account linking for financial tracking", category: "payperuse", paidBy: "basiq" }
  ].freeze

  SAVINGS_HISTORY = [
    { date: "Feb 2026", description: "Destroyed orphan HEROKU_POSTGRESQL_RED (Essential-2)", monthlySaved: 20 },
    { date: "Feb 2026", description: "Destroyed orphan QUEUE_DATABASE (Essential-1)", monthlySaved: 9 }
  ].freeze

  class << self
    def infrastructure(force_refresh: false)
      Rails.cache.delete(CACHE_KEY) if force_refresh

      cached = Rails.cache.read(CACHE_KEY)
      return cached.merge(cached: true) if cached

      result = deep_scrub_strings(fetch_from_heroku)
      Rails.cache.write(CACHE_KEY, result, expires_in: CACHE_TTL)
      result.merge(cached: false)
    rescue => e
      Rails.logger.error("[HerokuPlatformService] Error: #{e.message}")
      # Return cached data if available, otherwise empty with error
      fallback = Rails.cache.read(CACHE_KEY)
      if fallback
        fallback.merge(cached: true, error: "Live fetch failed, showing cached data")
      else
        {
          dynos: [],
          addons: [],
          externalServices: EXTERNAL_SERVICES,
          savingsHistory: SAVINGS_HISTORY,
          fetchedAt: nil,
          cached: false,
          error: "Could not reach Heroku API: #{e.message}"
        }
      end
    end

    private

    def fetch_from_heroku
      api_key = ENV["HEROKU_API_KEY"]
      unless api_key.present?
        return {
          dynos: [],
          addons: [],
          externalServices: EXTERNAL_SERVICES,
          savingsHistory: SAVINGS_HISTORY,
          fetchedAt: Time.current.iso8601,
          error: "HEROKU_API_KEY not configured"
        }
      end

      all_dynos = []
      all_addons = []
      errors = []

      # Query all apps in parallel using threads
      threads = APPS.map do |app_name|
        Thread.new(app_name) do |app|
          formation = fetch_formation(api_key, app)
          addons = fetch_addons(api_key, app)
          [app, formation, addons]
        rescue => e
          Rails.logger.error("[HerokuPlatformService] Failed to fetch #{app}: #{e.message}")
          [app, nil, nil, e.message]
        end
      end

      threads.each do |t|
        app, formation, addons, error = t.value
        meta = APP_METADATA[app] || { environment: app, description: "" }

        if error
          errors << "#{app}: #{error}"
          next
        end

        # Process formation (dynos)
        if formation.is_a?(Array)
          formation.each do |dyno|
            qty = dyno["quantity"].to_i
            next if qty == 0 # Skip scaled-down dynos

            size = dyno["size"]
            unit_cost = DYNO_COSTS[size] || 0

            all_dynos << {
              app: app,
              dyno: dyno["type"],
              size: size,
              quantity: qty,
              cost: unit_cost * qty,
              unitCost: unit_cost,
              purpose: purpose_for(app, dyno["type"]),
              environment: meta[:environment]
            }
          end
        end

        # Process addons
        if addons.is_a?(Array)
          addons.each do |addon|
            plan_name = addon.dig("plan", "name") || "unknown"
            addon_service = addon.dig("addon_service", "name") || "unknown"
            cost = ADDON_COSTS[plan_name]

            all_addons << {
              app: app,
              name: addon["name"],
              addonServiceName: addon_service,
              plan: plan_name,
              cost: cost,
              state: addon["state"],
              environment: meta[:environment]
            }
          end
        end
      end

      result = {
        dynos: all_dynos.sort_by { |d| [d[:environment], d[:dyno]] },
        addons: all_addons.sort_by { |a| [a[:addonServiceName], a[:app]] },
        externalServices: EXTERNAL_SERVICES,
        savingsHistory: SAVINGS_HISTORY,
        fetchedAt: Time.current.iso8601
      }
      result[:errors] = errors if errors.any?
      result
    end

    def fetch_formation(api_key, app_name)
      heroku_get(api_key, "/apps/#{app_name}/formation")
    end

    def fetch_addons(api_key, app_name)
      heroku_get(api_key, "/apps/#{app_name}/addons")
    end

    def heroku_get(api_key, path)
      uri = URI("https://api.heroku.com#{path}")
      request = Net::HTTP::Get.new(uri)
      request["Authorization"] = "Bearer #{api_key}"
      request["Accept"] = "application/vnd.heroku+json; version=3"

      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.open_timeout = 10
        http.read_timeout = 10
        http.request(request)
      end

      if response.code.to_i < 300
        # Parse the raw body as-is. Don't scrub here — scrubbing replaces
        # leading bytes with "?" which breaks JSON.parse. The original error
        # was on JSON *generation* (render json:), not parsing. String values
        # are scrubbed later by deep_scrub_strings on the final result hash.
        JSON.parse(response.body)
      else
        Rails.logger.error("[HerokuPlatformService] GET #{path} failed (HTTP #{response.code})")
        nil
      end
    end

    def deep_scrub_strings(obj)
      case obj
      when String
        obj.encode("UTF-8", invalid: :replace, undef: :replace, replace: "?").scrub("?")
      when Hash
        obj.transform_values { |v| deep_scrub_strings(v) }
      when Array
        obj.map { |v| deep_scrub_strings(v) }
      else
        obj
      end
    end

    def purpose_for(app, dyno_type)
      meta = APP_METADATA[app]
      return "#{app} #{dyno_type}" unless meta

      case dyno_type
      when "web"
        "#{meta[:description]}"
      when "worker"
        if app == "teeem-shared-worker"
          meta[:description]
        else
          "#{meta[:environment]} background jobs"
        end
      else
        "#{meta[:environment]} #{dyno_type}"
      end
    end
  end
end
