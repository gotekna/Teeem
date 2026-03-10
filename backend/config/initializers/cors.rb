# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    # Allow explicit Vercel deployments (no wildcards - security risk)
    # See: OWASP CORS misconfiguration - wildcards can match attacker-controlled subdomains
    # NOTE: Cannot use InfrastructureUrls here - not autoloaded yet at initializer time.
    # These must match TenantSetting::FRONTEND_ENVIRONMENT_URLS.
    origins(
      "https://app.teeem.com.au",          # Production frontend (custom domain)
      "https://beta.teeem.com.au",         # Beta frontend (custom domain)
      "https://staging.teeem.com.au",      # Staging frontend (custom domain)
      "https://teeem.vercel.app",          # Production frontend (Vercel)
      "https://teeem-beta.vercel.app",     # Beta frontend (Vercel)
      "https://teeem-staging.vercel.app",  # Staging frontend (Vercel)
      "https://teeemrob.vercel.app",       # Rob's dev frontend
      "https://teeemsam.vercel.app",       # Sam's dev frontend
      "https://teeemjake.vercel.app",      # Jake's dev frontend
      "https://oldfrontend-one.vercel.app", # Legacy frontend deployment
      # Vercel preview deployments - explicit pattern for teeem-next project only
      # Format: teeem-next-<hash>-<team>.vercel.app (Vercel's project name format)
      /https:\/\/teeem-next-[a-z0-9]+-gotekna\.vercel\.app$/,
      /http:\/\/(localhost|127\.0\.0\.1):\d+$/,  # Local development (any port)
      "https://tekna.com.au",              # Tekna Homes website (embedded login widget)
      "https://www.tekna.com.au",          # Tekna Homes www subdomain
      "https://sdapropertyhub.com.au",     # SDA Property Hub public site
      "https://www.sdapropertyhub.com.au", # SDA Property Hub www subdomain
      /https:\/\/sda-property-hub[a-z0-9-]*\.vercel\.app$/ # SDA Hub Vercel previews
    )

    resource "*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options, :head ],
      credentials: true,
      expose: [ "Set-Cookie" ]
  end
end
