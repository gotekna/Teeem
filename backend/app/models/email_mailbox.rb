# frozen_string_literal: true

# EmailMailbox - Individual mailbox within an email subscription
#
# Represents a single mailbox (user, shared, or resource) that is
# provisioned in PolarisMail and optionally linked to a TEEEM contact.
#
# Usage:
#   mailbox = subscription.email_mailboxes.create!(
#     email_address: "user@example.com",
#     display_name: "John Doe",
#     mailbox_type: "user"
#   )
#   mailbox.provision!
#
class EmailMailbox < ApplicationRecord
  belongs_to :email_subscription
  belongs_to :contact, optional: true

  has_many :email_migrations, dependent: :nullify

  # Constants
  MAILBOX_TYPES = %w[user shared resource].freeze
  STATUSES = %w[pending provisioning active suspended deleted failed].freeze

  # Validations
  validates :email_address, presence: true, uniqueness: true
  validates :mailbox_type, inclusion: { in: MAILBOX_TYPES }
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :pending, -> { where(status: "pending") }
  scope :users, -> { where(mailbox_type: "user") }
  scope :shared, -> { where(mailbox_type: "shared") }
  scope :resources, -> { where(mailbox_type: "resource") }

  # Callbacks
  before_validation :set_defaults, on: :create

  # Provision mailbox in PolarisMail
  def provision!
    update!(status: "provisioning")
    EmailMailboxProvisionJob.perform_later(id)
  end

  def mark_active!
    update!(status: "active", provisioned_at: Time.current)
    email_subscription.sync_mailbox_count!
  end

  def mark_failed!(error_message)
    update!(
      status: "failed",
      metadata: metadata.merge("error" => error_message)
    )
  end

  # Status helpers
  def active?
    status == "active"
  end

  def provisioned?
    provisioned_at.present?
  end

  def shared_mailbox?
    mailbox_type == "shared"
  end

  def user_mailbox?
    mailbox_type == "user"
  end

  # Storage calculations
  def storage_used_percentage
    return 0 unless storage_used_gb && storage_quota_gb&.positive?
    (storage_used_gb / storage_quota_gb * 100).round(1)
  end

  private

  def set_defaults
    self.status ||= "pending"
    self.mailbox_type ||= "user"
    self.storage_quota_gb ||= 50
  end
end
