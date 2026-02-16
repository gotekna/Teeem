# frozen_string_literal: true

# Email drafts for work-in-progress emails
# Syncs across devices (replaces localStorage-only storage)
#
# Lifecycle:
# - Created when user starts composing
# - Updated on auto-save (every 30 seconds)
# - Deleted when email is sent or user discards
#
# SSoT (Feb 2026): Uses Tenant for isolation, Organization deprecated.
#
class EmailDraft < ApplicationRecord
  belongs_to :user
  # SSoT (Feb 2026): Tenant is THE ONE for multi-tenancy isolation
  belongs_to :tenant
  belongs_to :imap_credential, optional: true
  belongs_to :microsoft_credential, optional: true

  # Constants
  STATUSES = %w[draft sending sent].freeze

  # Drafts can have empty fields - only validate when sending
  validates :to_addresses, presence: true, unless: :draft?
  validates :subject, presence: true, unless: :draft?
  validates :body, presence: true, unless: :draft?
  validates :status, presence: true, inclusion: { in: STATUSES }

  def draft?
    status == "draft"
  end

  # Can this draft be synced to a provider Drafts folder?
  def provider_syncable?
    draft? && (microsoft_credential_id.present? || imap_credential_id.present?)
  end

  # Scopes
  scope :recent, ->(limit = 50) { order(updated_at: :desc).limit(limit) }
  scope :for_user, ->(user) { where(user: user) }
  scope :drafts_only, -> { where(status: "draft") }
  # SSoT (Feb 2026): Tenant-scoped lookup
  scope :for_tenant, ->(tenant) { where(tenant: tenant) }
  # Provider sync scopes (for monitoring)
  scope :synced, -> { where.not(provider_synced_at: nil) }
  scope :unsynced, -> { where(provider_synced_at: nil) }
  scope :sync_errors, -> { where.not(provider_sync_error: nil) }

  # Parse JSON addresses to array
  def to_list
    parse_addresses(to_addresses)
  end

  def cc_list
    parse_addresses(cc_addresses)
  end

  def bcc_list
    parse_addresses(bcc_addresses)
  end

  # Convert to API response format (matches frontend interface)
  def as_api_response
    {
      id: id.to_s,
      credential_id: imap_credential_id&.to_s,
      microsoft_credential_id: microsoft_credential_id&.to_s,
      from_address: from_address,
      to: to_addresses_string,
      cc: cc_addresses_string,
      bcc: bcc_addresses_string,
      subject: subject,
      body: body,
      reply_to_message_id: reply_to_message_id,
      attachment_names: attachment_names,
      status: status,
      provider_draft_id: provider_draft_id,
      provider_type: provider_type,
      provider_synced_at: provider_synced_at&.iso8601,
      provider_sync_error: provider_sync_error,
      created_at: created_at&.iso8601,
      updated_at: updated_at&.iso8601
    }
  end

  private

  def parse_addresses(addresses)
    return [] if addresses.blank?

    if addresses.is_a?(Array)
      addresses
    else
      JSON.parse(addresses) rescue addresses.split(",").map(&:strip)
    end
  end

  # Convert array back to comma-separated string for frontend
  def to_addresses_string
    to_list.join(", ")
  end

  def cc_addresses_string
    cc_list.join(", ")
  end

  def bcc_addresses_string
    bcc_list.join(", ")
  end

  def attachment_names
    return [] if attachments.blank?

    attachments.map { |a| a["name"] || a[:name] }.compact
  end
end
