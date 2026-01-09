class TokenHealthCheckJob < ApplicationJob
  queue_as :default

  def perform
    check_onedrive_tokens
    check_xero_tokens
  end

  private

  def check_onedrive_tokens
    # SSoT: Use MicrosoftCredential for org-level SharePoint credentials
    MicrosoftCredential.delegated_credentials.org_level.active.find_each do |credential|
      days_until_expiry = days_until_expiry(credential.token_expires_at)

      if days_until_expiry.nil?
        Rails.logger.warn("[TokenHealth] SharePoint credential #{credential.id} (#{credential.name}) has no expiry date")
      elsif days_until_expiry < 0
        Rails.logger.error("[TokenHealth] SharePoint credential #{credential.id} (#{credential.name}) is EXPIRED - reconnection required")
      elsif days_until_expiry < 7
        Rails.logger.warn("[TokenHealth] SharePoint credential #{credential.id} (#{credential.name}) expires in #{days_until_expiry} days")
      else
        Rails.logger.info("[TokenHealth] SharePoint credential #{credential.id} (#{credential.name}) is healthy (expires in #{days_until_expiry} days)")
      end

      # Check if credential is valid
      unless credential.valid_credential?
        Rails.logger.error("[TokenHealth] SharePoint credential #{credential.id} (#{credential.name}) is INVALID - reconnection required")
      end
    end

    # Alert if no active credentials (check both delegated and app credentials)
    unless MicrosoftCredential.sharepoint_credential.present?
      Rails.logger.error("[TokenHealth] NO ACTIVE SharePoint credentials found - uploads will fail")
    end
  end

  def check_xero_tokens
    XeroCredential.find_each do |credential|
      next unless credential.active?

      days_until_expiry = days_until_expiry(credential.token_expires_at)
      tenant_name = credential.tenant_name.presence || "Tenant #{credential.id}"

      if days_until_expiry.nil?
        Rails.logger.warn("[TokenHealth] Xero credential #{credential.id} (#{tenant_name}) has no expiry date")
      elsif days_until_expiry < 0
        Rails.logger.error("[TokenHealth] Xero credential #{credential.id} (#{tenant_name}) is EXPIRED - reconnection required")
      elsif days_until_expiry < 7
        Rails.logger.warn("[TokenHealth] Xero credential #{credential.id} (#{tenant_name}) expires in #{days_until_expiry} days")
      else
        Rails.logger.info("[TokenHealth] Xero credential #{credential.id} (#{tenant_name}) is healthy (expires in #{days_until_expiry} days)")
      end

      # Check if credential is expired
      if credential.expired?
        Rails.logger.error("[TokenHealth] Xero credential #{credential.id} (#{tenant_name}) is EXPIRED - reconnection required")
      end
    end

    # Alert if no active credentials
    if XeroCredential.where(active: true).none?
      Rails.logger.error("[TokenHealth] NO ACTIVE Xero credentials found - Xero sync will fail")
    end
  end

  def days_until_expiry(expires_at)
    return nil if expires_at.nil?
    ((expires_at - Time.current) / 1.day).round
  end
end
