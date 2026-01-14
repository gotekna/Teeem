# frozen_string_literal: true

# EmailDnsRecord - Tracks DNS records provisioned for email subscriptions
#
# Each email subscription requires multiple DNS records:
# - MX: Mail delivery to EmailArray
# - TXT (SPF): Sender authentication
# - TXT (DKIM): Email signing
# - TXT (DMARC): Policy enforcement
# - CNAME (autodiscover): Outlook auto-configuration
# - CNAME (autoconfig): Thunderbird auto-configuration
#
class EmailDnsRecord < ApplicationRecord
  belongs_to :email_subscription

  # Record types
  RECORD_TYPES = %w[mx txt cname].freeze

  # Required records for email hosting
  REQUIRED_RECORDS = [
    { type: 'mx', name: '@', purpose: 'Mail delivery' },
    { type: 'txt', name: '@', purpose: 'SPF - Sender authentication' },
    { type: 'txt', name: 'dkim._domainkey', purpose: 'DKIM - Email signing' },
    { type: 'txt', name: '_dmarc', purpose: 'DMARC - Policy' },
    { type: 'cname', name: 'autodiscover', purpose: 'Outlook auto-config' },
    { type: 'cname', name: 'autoconfig', purpose: 'Thunderbird auto-config' }
  ].freeze

  # EmailArray DNS values
  EMAILARRAY_MX = 'mail.emailarray.com'.freeze
  EMAILARRAY_MX_PRIORITY = 10
  EMAILARRAY_SPF = 'v=spf1 include:spf.emailarray.com ~all'.freeze
  EMAILARRAY_AUTODISCOVER = 'autodiscover.emailarray.com'.freeze
  EMAILARRAY_AUTOCONFIG = 'autoconfig.emailarray.com'.freeze

  # Validations
  validates :record_type, presence: true, inclusion: { in: RECORD_TYPES }
  validates :name, presence: true
  validates :content, presence: true
  validates :email_subscription_id, uniqueness: { scope: [:record_type, :name],
                                                   message: "already has this DNS record" }

  # Status enum
  enum :status, {
    pending: 0,    # Not yet created in Cloudflare
    created: 1,    # Created in Cloudflare, not verified
    verified: 2,   # Created and DNS resolves correctly
    error: 3,      # Failed to create or update
    missing: 4     # Was created but now missing from Cloudflare
  }, prefix: true

  # Scopes
  scope :mx_records, -> { where(record_type: 'mx') }
  scope :txt_records, -> { where(record_type: 'txt') }
  scope :cname_records, -> { where(record_type: 'cname') }
  scope :healthy, -> { where(status: [:created, :verified]) }
  scope :problematic, -> { where(status: [:pending, :error, :missing]) }

  # Class methods
  class << self
    # Generate default records for a domain
    # @param domain [String] Domain name
    # @param dkim_value [String] DKIM public key (optional)
    # @return [Array<Hash>] Record definitions
    def default_records_for(domain, dkim_value: nil)
      dmarc_email = "dmarc@#{domain}"

      [
        {
          record_type: 'mx',
          name: '@',
          content: EMAILARRAY_MX,
          priority: EMAILARRAY_MX_PRIORITY
        },
        {
          record_type: 'txt',
          name: '@',
          content: EMAILARRAY_SPF
        },
        {
          record_type: 'txt',
          name: 'dkim._domainkey',
          content: dkim_value || placeholder_dkim
        },
        {
          record_type: 'txt',
          name: '_dmarc',
          content: "v=DMARC1; p=quarantine; rua=mailto:#{dmarc_email}"
        },
        {
          record_type: 'cname',
          name: 'autodiscover',
          content: EMAILARRAY_AUTODISCOVER
        },
        {
          record_type: 'cname',
          name: 'autoconfig',
          content: EMAILARRAY_AUTOCONFIG
        }
      ]
    end

    # Placeholder DKIM until we get real value from EmailArray
    def placeholder_dkim
      'v=DKIM1; k=rsa; p=PENDING_DKIM_KEY'
    end
  end

  # Instance methods

  # Full record name (e.g., "autodiscover.example.com")
  def full_name
    domain = email_subscription.domain
    name == '@' ? domain : "#{name}.#{domain}"
  end

  # Mark as created with Cloudflare ID
  def mark_created!(cloudflare_record_id:, zone_id: nil)
    update!(
      status: :created,
      cloudflare_record_id: cloudflare_record_id,
      cloudflare_zone_id: zone_id,
      provisioned_at: Time.current,
      error_message: nil
    )
  end

  # Mark as verified
  def mark_verified!
    update!(
      status: :verified,
      last_verified_at: Time.current,
      error_message: nil
    )
  end

  # Mark as error
  def mark_error!(message)
    update!(
      status: :error,
      error_message: message
    )
  end

  # Mark as missing
  def mark_missing!
    update!(
      status: :missing,
      error_message: 'Record not found in Cloudflare'
    )
  end

  # Check if this is a critical record (MX or SPF)
  def critical?
    record_type == 'mx' || (record_type == 'txt' && name == '@')
  end

  # Human-readable purpose
  def purpose
    REQUIRED_RECORDS.find { |r| r[:type] == record_type && r[:name] == name }&.dig(:purpose) || 'Custom'
  end
end
