# frozen_string_literal: true

require "zlib"
require "stringio"

# HerokuPlatformService
# Fetches live dyno and addon data from the Heroku Platform API.
# Uses HEROKU_API_KEY (same env var as worker_watchdog.rb).
# Caches results for 10 minutes. Pass force_refresh: true to bust cache.
class HerokuPlatformService
  include CacheConstants

  CACHE_KEY = "heroku_platform:infrastructure".freeze
  CACHE_TTL = CACHE_TTL_LONG

  # All TEEEM Heroku apps to query
  APPS = %w[
    teeem-production
    teeem-beta
    teeem-staging
    teeem-shared-worker
    teeem-email-worker
    teeem-sam-dev
    teeem-rob-dev
    teeem-jake-dev
  ].freeze

  # Production app name (SSoT for database backups and production-specific operations)
  PRODUCTION_APP = "teeem-production".freeze

  # Human-readable metadata for each app
  APP_METADATA = {
    "teeem-production"    => { environment: "Production", description: "Production Rails API" },
    "teeem-beta"          => { environment: "Beta",       description: "Beta/UAT Rails API" },
    "teeem-staging"       => { environment: "Staging",    description: "Staging Rails API" },
    "teeem-shared-worker" => { environment: "Shared",     description: "Shared job processing (all envs)" },
    "teeem-email-worker"  => { environment: "Email",      description: "Dedicated email sync worker" },
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

  # Dev apps that can be toggled on/off from the dashboard
  DEV_APPS = %w[
    teeem-sam-dev
    teeem-rob-dev
    teeem-jake-dev
  ].freeze

  # Dev apps that should share Sam Dev's database (not their own)
  DEV_DB_SOURCE = "teeem-sam-dev".freeze
  DEV_DB_TARGETS = %w[teeem-rob-dev teeem-jake-dev].freeze

  class << self
    # SSoT for Heroku API key access
    def api_key
      ENV["HEROKU_API_KEY"].presence || raise("HEROKU_API_KEY not configured")
    end

    def api_key?
      ENV["HEROKU_API_KEY"].present?
    end

    # Points target dev apps' DATABASE_URL to the source dev app's database.
    # This lets Jake Dev and Rob Dev share Sam Dev's database.
    def share_dev_database
      return { success: false, error: "HEROKU_API_KEY not configured" } unless api_key?
      key = api_key

      # Get Sam Dev's DATABASE_URL
      source_config = heroku_get(key, "/apps/#{DEV_DB_SOURCE}/config-vars")
      return { success: false, error: "Could not read #{DEV_DB_SOURCE} config vars" } unless source_config
      source_db_url = source_config["DATABASE_URL"]
      return { success: false, error: "#{DEV_DB_SOURCE} has no DATABASE_URL" } unless source_db_url.present?

      results = {}
      DEV_DB_TARGETS.each do |target_app|
        # Check current DATABASE_URL
        target_config = heroku_get(key, "/apps/#{target_app}/config-vars")
        current_url = target_config&.dig("DATABASE_URL")

        if current_url == source_db_url
          results[target_app] = { status: "already_shared", message: "Already using #{DEV_DB_SOURCE} database" }
          next
        end

        # Set DATABASE_URL to Sam Dev's (this restarts the app)
        result = heroku_patch(key, "/apps/#{target_app}/config-vars", { "DATABASE_URL" => source_db_url })
        if result
          results[target_app] = { status: "updated", message: "Now using #{DEV_DB_SOURCE} database", previousUrl: current_url&.truncate(40) }
        else
          results[target_app] = { status: "failed", message: "Heroku API call failed" }
        end
      end

      Rails.cache.delete(CACHE_KEY)
      { success: true, data: { source: DEV_DB_SOURCE, targets: results } }
    end

    def restart_dyno(app_name)
      return { success: false, error: "HEROKU_API_KEY not configured" } unless api_key?
      return { success: false, error: "Unknown app" } unless app_name.in?(APPS)

      result = heroku_delete(api_key, "/apps/#{app_name}/dynos")

      if result
        Rails.cache.delete(CACHE_KEY)
        { success: true, data: { app: app_name, restarted: true } }
      else
        { success: false, error: "Heroku API call failed" }
      end
    end

    def scale_dyno(app_name, dyno_type, quantity)
      return { success: false, error: "HEROKU_API_KEY not configured" } unless api_key?
      return { success: false, error: "Only dev apps can be scaled from the dashboard" } unless app_name.in?(DEV_APPS)
      return { success: false, error: "Quantity must be 0 or 1" } unless quantity.in?([0, 1])

      result = heroku_patch(api_key, "/apps/#{app_name}/formation/#{dyno_type}", { quantity: quantity })

      if result
        # Bust cache so dashboard shows updated state
        Rails.cache.delete(CACHE_KEY)
        { success: true, data: { app: app_name, dyno: dyno_type, quantity: quantity } }
      else
        { success: false, error: "Heroku API call failed" }
      end
    end

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
      unless api_key?
        return {
          dynos: [],
          addons: [],
          externalServices: EXTERNAL_SERVICES,
          savingsHistory: SAVINGS_HISTORY,
          fetchedAt: Time.current.iso8601,
          error: "HEROKU_API_KEY not configured"
        }
      end

      key = api_key

      all_dynos = []
      all_addons = []
      errors = []

      # Query all apps in parallel using threads
      threads = APPS.map do |app_name|
        Thread.new(app_name) do |app|
          formation = fetch_formation(key, app)
          addons = fetch_addons(key, app)
          dynos = fetch_dyno_instances(key, app)
          [app, formation, addons, nil, dynos]
        rescue => e
          Rails.logger.error("[HerokuPlatformService] Failed to fetch #{app}: #{e.message}")
          [app, nil, nil, e.message, nil]
        end
      end

      all_boot_times = {}

      threads.each do |t|
        app, formation, addons, error, dynos = t.value
        meta = APP_METADATA[app] || { environment: app, description: "" }

        if error
          errors << "#{app}: #{error}"
          next
        end

        # Process formation (dynos)
        if formation.is_a?(Array)
          formation.each do |dyno|
            qty = dyno["quantity"].to_i
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
              environment: meta[:environment],
              scaledDown: qty == 0
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

        # Extract latest boot time from dyno instances
        if dynos.is_a?(Array) && dynos.any?
          latest = dynos.map { |d| d["created_at"] }.compact.max
          all_boot_times[app] = latest if latest
        end
      end

      result = {
        dynos: all_dynos.sort_by { |d| [d[:environment], d[:dyno]] },
        addons: all_addons.sort_by { |a| [a[:addonServiceName], a[:app]] },
        bootTimes: all_boot_times,
        externalServices: EXTERNAL_SERVICES,
        savingsHistory: SAVINGS_HISTORY,
        apiKeyStatus: fetch_api_key_status,
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

    def fetch_dyno_instances(api_key, app_name)
      heroku_get(api_key, "/apps/#{app_name}/dynos")
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
        body = response.body
        # Heroku API may return gzip-compressed responses. Ruby's Net::HTTP
        # auto-decompression doesn't always work in threaded contexts.
        if body.bytes[0..1] == [0x1F, 0x8B] # gzip magic number
          body = Zlib::GzipReader.new(StringIO.new(body)).read
        end
        JSON.parse(body)
      else
        Rails.logger.error("[HerokuPlatformService] GET #{path} failed (HTTP #{response.code})")
        nil
      end
    end

    def heroku_patch(api_key, path, body)
      uri = URI("https://api.heroku.com#{path}")
      request = Net::HTTP::Patch.new(uri)
      request["Authorization"] = "Bearer #{api_key}"
      request["Accept"] = "application/vnd.heroku+json; version=3"
      request["Content-Type"] = "application/json"
      request.body = body.to_json

      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.open_timeout = 10
        http.read_timeout = 10
        http.request(request)
      end

      if response.code.to_i < 300
        JSON.parse(response.body)
      else
        Rails.logger.error("[HerokuPlatformService] PATCH #{path} failed (HTTP #{response.code}): #{response.body}")
        nil
      end
    end

    def heroku_delete(api_key, path)
      uri = URI("https://api.heroku.com#{path}")
      request = Net::HTTP::Delete.new(uri)
      request["Authorization"] = "Bearer #{api_key}"
      request["Accept"] = "application/vnd.heroku+json; version=3"

      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.open_timeout = 10
        http.read_timeout = 30
        http.request(request)
      end

      if response.code.to_i < 300
        true
      else
        Rails.logger.error("[HerokuPlatformService] DELETE #{path} failed (HTTP #{response.code}): #{response.body}")
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

    def fetch_api_key_status
      keys = []

      # ENV-based API keys
      {
        "Anthropic" => "ANTHROPIC_API_KEY",
        "Vercel" => "VERCEL_TOKEN",
        "Heroku" => "HEROKU_API_KEY",
        "AWS" => "AWS_ACCESS_KEY_ID",
        "Sentry" => "SENTRY_DSN",
        "Stripe" => "STRIPE_SECRET_KEY",
        "Twilio" => "TWILIO_AUTH_TOKEN",
        "SendGrid" => "SENDGRID_API_KEY",
        "Basiq" => "BASIQ_API_KEY",
        "OpenAI" => "OPENAI_API_KEY"
      }.each do |name, env_var|
        val = ENV[env_var]
        keys << {
          name: name,
          type: "api_key",
          status: val.present? ? "active" : "missing",
          envVar: env_var,
          lastChars: val.present? ? "...#{val.last(4)}" : nil
        }
      end

      # Xero OAuth credentials (have token expiry)
      # Small lookup table (< 10 credentials typically), .all is fine
      XeroCredential.all.each do |cred|
        keys << {
          name: "Xero (#{cred.xero_tenant_name.presence || cred.id})",
          type: "oauth",
          status: cred.connected? ? "active" : (cred.expired? ? "expired" : cred.status),
          expiresAt: cred.expires_at&.iso8601,
          expiresIn: cred.token_expiry_text
        }
      end

      # Microsoft OAuth credentials (have token expiry)
      # Small lookup table (< 10 credentials typically), .all is fine
      MicrosoftCredential.all.each do |cred|
        keys << {
          name: "Microsoft (#{cred.credential_type} - #{cred.email.presence || cred.id})",
          type: "oauth",
          status: cred.connected? ? "active" : (cred.token_expired? ? "expired" : cred.status),
          expiresAt: cred.token_expires_at&.iso8601,
          expiresIn: cred.token_expires_at.present? ? time_until(cred.token_expires_at) : nil
        }
      end

      # S3 credentials (Wasabi)
      # Small lookup table (< 5 credentials typically), .all is fine
      S3CompatibleCredential.all.each do |cred|
        keys << {
          name: "S3/Wasabi (#{cred.provider_type.presence || 'default'})",
          type: "api_key",
          status: cred.status == "connected" ? "active" : cred.status,
          lastChars: cred.access_key_id.present? ? "...#{cred.access_key_id.last(4)}" : nil
        }
      end

      keys
    rescue StandardError => e
      Rails.logger.error("[HerokuPlatformService] API key status check failed: #{e.message}")
      []
    end

    def time_until(time)
      return nil unless time
      diff = time - Time.current
      return "Expired" if diff <= 0
      if diff < 1.hour
        "#{(diff / 60).round}m"
      elsif diff < 1.day
        "#{(diff / 1.hour).round}h"
      else
        "#{(diff / 1.day).round}d"
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
