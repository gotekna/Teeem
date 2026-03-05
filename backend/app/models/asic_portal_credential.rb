class AsicPortalCredential < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :tenant, optional: true
  belongs_to :corporate
  belongs_to :contact, optional: true

  # Encryption (Rails 7 Active Record Encryption)
  encrypts :encrypted_password
  encrypts :encrypted_recovery_answer

  # Safe accessors for encrypted fields that may have decryption issues
  def encrypted_password
    super
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.warn("AsicPortalCredential##{id}: Password decryption failed - #{e.message}")
    nil
  end

  def encrypted_recovery_answer
    super
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.warn("AsicPortalCredential##{id}: Recovery answer decryption failed - #{e.message}")
    nil
  end

  # Constants
  STATUSES = %w[active resigned expired].freeze

  # Validations
  validates :username, presence: true
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :resigned, -> { where(status: "resigned") }
  scope :expired, -> { where(status: "expired") }

  # Display helper
  def contact_name
    contact&.display_name
  end
end
