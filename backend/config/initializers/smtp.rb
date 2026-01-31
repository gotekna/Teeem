# frozen_string_literal: true

# SMTP configuration for transactional emails (PolarisMail/EmailArray)
# Environment variables:
#   SMTP_ADDRESS, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_DOMAIN
#
# From address must match SMTP_USERNAME for PolarisMail authentication

if ENV["SMTP_ADDRESS"].present?
  Rails.application.config.action_mailer.delivery_method = :smtp
  Rails.application.config.action_mailer.smtp_settings = {
    address: ENV["SMTP_ADDRESS"],
    port: ENV.fetch("SMTP_PORT", 587).to_i,
    user_name: ENV["SMTP_USERNAME"],
    password: ENV["SMTP_PASSWORD"],
    domain: ENV.fetch("SMTP_DOMAIN", "teeem.com.au"),
    authentication: :plain,
    enable_starttls_auto: true
  }

  # Also set on ActionMailer::Base directly for immediate effect
  ActionMailer::Base.delivery_method = :smtp
  ActionMailer::Base.smtp_settings = Rails.application.config.action_mailer.smtp_settings
end
