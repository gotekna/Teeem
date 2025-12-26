# frozen_string_literal: true

# Email drafts for work-in-progress emails
# Syncs across devices (replaces localStorage-only storage)
#
# Lifecycle:
# - Created when user starts composing
# - Updated on auto-save (every 30 seconds)
# - Deleted when email is sent or user discards
#
class EmailDraft < ApplicationRecord
  belongs_to :user
  belongs_to :organization
  belongs_to :imap_credential, optional: true

  # Drafts can have empty fields - only validate when sending
  validates :to_addresses, presence: true, unless: :draft?
  validates :subject, presence: true, unless: :draft?
  validates :body, presence: true, unless: :draft?
  validates :status, presence: true, inclusion: { in: %w[draft sending sent] }

  def draft?
    status == "draft"
  end

  # Scopes
  scope :recent, ->(limit = 50) { order(updated_at: :desc).limit(limit) }
  scope :for_user, ->(user) { where(user: user) }
  scope :drafts_only, -> { where(status: "draft") }
  scope :for_organization, ->(org) { where(organization: org) }

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
      from_address: from_address,
      to: to_addresses_string,
      cc: cc_addresses_string,
      bcc: bcc_addresses_string,
      subject: subject,
      body: body,
      reply_to_message_id: reply_to_message_id,
      attachment_names: attachment_names,
      status: status,
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
