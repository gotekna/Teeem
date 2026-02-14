# frozen_string_literal: true

# InfrastructureUrls - SSoT for all environment URLs
#
# Uses TenantSetting::API_ENVIRONMENT_URLS and FRONTEND_ENVIRONMENT_URLS
# as the source of truth. Falls back to ENV vars for flexibility.
#
# WHY THIS EXISTS (Root Cause):
# - 33 hardcoded Heroku/Vercel URLs scattered across backend
# - URL changes (e.g., old teeemlive → new teeem-production) required grep-replace
# - Mixed conventions: some used ENV, some hardcoded, some mixed
# - CORS configs duplicated URLs in multiple files
#
# SSoT HIERARCHY:
# 1. TenantSetting constants (THE ONE source)
# 2. ENV vars (for local dev overrides)
# 3. localhost defaults (for Rails.env.development?)
#
# USAGE:
#   InfrastructureUrls.backend_url               # Current env backend
#   InfrastructureUrls.frontend_url              # Current env frontend
#   InfrastructureUrls.production_backend_url    # Always production
#   InfrastructureUrls.production_frontend_url   # Always production
#   InfrastructureUrls.all_backend_urls          # For CORS allowed origins
#   InfrastructureUrls.all_frontend_urls         # For CORS allowed origins
#
module InfrastructureUrls
  # Get backend URL for current environment (or specified env)
  # Defaults to localhost:3001 for development
  def self.backend_url(env = nil)
    env ||= Rails.env.to_s

    return "http://localhost:3001" if env == "development"

    TenantSetting::API_ENVIRONMENT_URLS[env] ||
      ENV["APP_HOST"] ||
      TenantSetting::API_ENVIRONMENT_URLS["production"]
  end

  # Get frontend URL for current environment (or specified env)
  # Defaults to localhost:3000 for development
  def self.frontend_url(env = nil)
    env ||= Rails.env.to_s

    return "http://localhost:3000" if env == "development"

    TenantSetting::FRONTEND_ENVIRONMENT_URLS[env] ||
      ENV["FRONTEND_URL"] ||
      TenantSetting::FRONTEND_ENVIRONMENT_URLS["production"]
  end

  # Always return production backend URL
  def self.production_backend_url
    TenantSetting::API_ENVIRONMENT_URLS["production"]
  end

  # Always return production frontend URL
  def self.production_frontend_url
    TenantSetting::FRONTEND_ENVIRONMENT_URLS["production"]
  end

  # Get all backend URLs (for CORS allowed origins)
  def self.all_backend_urls
    TenantSetting::API_ENVIRONMENT_URLS.values
  end

  # Get all frontend URLs (for CORS allowed origins)
  def self.all_frontend_urls
    TenantSetting::FRONTEND_ENVIRONMENT_URLS.values
  end

  # Portal URLs (SSoT)
  # Subcontractor portal (quote requests, supplier responses)
  SUBCONTRACTOR_PORTAL_URL = "https://portal.teeem.com".freeze
  # Payment portal (invoices, payment links)
  PAYMENT_PORTAL_URL = "https://pay.teeem.com".freeze

  # Get subcontractor portal URL (ENV override for dev/staging)
  def self.portal_url
    ENV["PORTAL_URL"] || SUBCONTRACTOR_PORTAL_URL
  end

  # Get payment portal URL (ENV override for dev/staging)
  def self.payment_portal_url
    ENV["PAYMENT_PORTAL_URL"] || PAYMENT_PORTAL_URL
  end

  # Check if current app is a dev Heroku instance (should not redirect)
  def self.dev_instance?
    ENV["HEROKU_APP_NAME"]&.include?("-dev")
  end
end
