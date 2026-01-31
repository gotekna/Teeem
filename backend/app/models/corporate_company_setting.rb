# frozen_string_literal: true

# DEPRECATED: Use TenantSetting instead
#
# This model is a backward-compatibility wrapper that delegates to TenantSetting.
# All methods log deprecation warnings and forward to TenantSetting.
#
# The corporate_company_settings table will be dropped in a future migration
# after all references have been updated.
#
# Migration path:
#   CorporateCompanySetting.instance      -> TenantSetting.instance
#   CorporateCompanySetting.today         -> TenantSetting.today
#   CorporateCompanySetting.brand_colors  -> TenantSetting.brand_colors
#   etc.
#
class CorporateCompanySetting < ApplicationRecord
  # Keep the table association for data migration purposes
  belongs_to :tenant, optional: true

  # Log deprecation warning (once per method per session)
  def self.deprecation_warning(method_name)
    @warned_methods ||= Set.new
    unless @warned_methods.include?(method_name)
      Rails.logger.warn "[DEPRECATED] CorporateCompanySetting.#{method_name} called. Use TenantSetting.#{method_name} instead."
      @warned_methods.add(method_name)
    end
  end

  # Delegate all class methods to TenantSetting
  class << self
    # Instance access
    def instance
      deprecation_warning(__method__)
      TenantSetting.instance
    end

    # Timezone methods
    def today
      deprecation_warning(__method__)
      TenantSetting.today
    end

    def now
      deprecation_warning(__method__)
      TenantSetting.now
    end

    def in_company_timezone(&block)
      deprecation_warning(__method__)
      TenantSetting.in_company_timezone(&block)
    end

    def timezone
      deprecation_warning(__method__)
      TenantSetting.timezone
    end

    # Business day methods
    def working_day?(date)
      deprecation_warning(__method__)
      TenantSetting.working_day?(date)
    end

    def public_holiday?(date)
      deprecation_warning(__method__)
      TenantSetting.public_holiday?(date)
    end

    def business_day?(date)
      deprecation_warning(__method__)
      TenantSetting.business_day?(date)
    end

    # Document path methods
    def company_documents_base_path
      deprecation_warning(__method__)
      TenantSetting.company_documents_base_path
    end

    def people_documents_base_path
      deprecation_warning(__method__)
      TenantSetting.people_documents_base_path
    end

    def job_documents_base_path
      deprecation_warning(__method__)
      TenantSetting.job_documents_base_path
    end

    # Template resolution
    def resolve_template(template, values)
      deprecation_warning(__method__)
      TenantSetting.resolve_template(template, values)
    end

    # Team email domains
    def team_email_domains
      deprecation_warning(__method__)
      TenantSetting.team_email_domains
    end

    def update_team_email_domains(domains)
      deprecation_warning(__method__)
      TenantSetting.update_team_email_domains(domains)
    end

    # Corporate entity types
    def corporate_entity_types
      deprecation_warning(__method__)
      TenantSetting.corporate_entity_types
    end

    def update_corporate_entity_types(types)
      deprecation_warning(__method__)
      TenantSetting.update_corporate_entity_types(types)
    end

    # Email configuration
    def internal_email_domains
      deprecation_warning(__method__)
      TenantSetting.internal_email_domains
    end

    def internal_email?(email)
      deprecation_warning(__method__)
      TenantSetting.internal_email?(email)
    end

    def internal_domain_patterns
      deprecation_warning(__method__)
      TenantSetting.internal_domain_patterns
    end

    def monitored_mailbox_pay
      deprecation_warning(__method__)
      TenantSetting.monitored_mailbox_pay
    end

    def monitored_mailbox_newtask
      deprecation_warning(__method__)
      TenantSetting.monitored_mailbox_newtask
    end

    def monitored_mailbox_newjob
      deprecation_warning(__method__)
      TenantSetting.monitored_mailbox_newjob
    end

    def monitored_mailbox_newcase
      deprecation_warning(__method__)
      TenantSetting.monitored_mailbox_newcase
    end

    def email_config
      deprecation_warning(__method__)
      TenantSetting.email_config
    end

    # Brand colors
    def brand_colors
      deprecation_warning(__method__)
      TenantSetting.brand_colors
    end

    def hex_to_hsl(hex)
      deprecation_warning(__method__)
      TenantSetting.hex_to_hsl(hex)
    end

    def hsl_to_hex(hsl_string)
      deprecation_warning(__method__)
      TenantSetting.hsl_to_hex(hsl_string)
    end

    def hue_to_rgb(p, q, t)
      deprecation_warning(__method__)
      TenantSetting.hue_to_rgb(p, q, t)
    end

    def brand_colors_hex
      deprecation_warning(__method__)
      TenantSetting.brand_colors_hex
    end

    def update_brand_colors_from_hex(colors)
      deprecation_warning(__method__)
      TenantSetting.update_brand_colors_from_hex(colors)
    end

    # Link expiry
    def link_expiry_days
      deprecation_warning(__method__)
      TenantSetting.link_expiry_days
    end

    def link_expiry_seconds
      deprecation_warning(__method__)
      TenantSetting.link_expiry_seconds
    end

    # API environment
    def api_environment
      deprecation_warning(__method__)
      TenantSetting.api_environment
    end

    def api_url
      deprecation_warning(__method__)
      TenantSetting.api_url
    end

    def api_environment_config
      deprecation_warning(__method__)
      TenantSetting.api_environment_config
    end
  end

  # Constants - delegate to TenantSetting
  VALID_API_ENVIRONMENTS = TenantSetting::VALID_API_ENVIRONMENTS
  API_ENVIRONMENT_URLS = TenantSetting::API_ENVIRONMENT_URLS
  FRONTEND_ENVIRONMENT_URLS = TenantSetting::FRONTEND_ENVIRONMENT_URLS
  DEFAULT_ENTITY_TYPES = TenantSetting::DEFAULT_ENTITY_TYPES
  DEFAULT_INTERNAL_DOMAINS = TenantSetting::DEFAULT_INTERNAL_DOMAINS
  DEFAULT_BRAND_COLORS = TenantSetting::DEFAULT_BRAND_COLORS
  DEFAULT_LINK_EXPIRY_DAYS = TenantSetting::DEFAULT_LINK_EXPIRY_DAYS
  DEFAULT_WORKING_DAYS = TenantSetting::DEFAULT_WORKING_DAYS
end
