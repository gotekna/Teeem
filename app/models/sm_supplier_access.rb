# frozen_string_literal: true

# SmSupplierAccess - Access tokens for supplier portal
#
# Allows suppliers to view their assigned tasks without
# needing a full user account.
#
class SmSupplierAccess < ApplicationRecord
  belongs_to :contact # The supplier contact
  belongs_to :construction
  belongs_to :created_by, class_name: 'User', optional: true

  # Generate secure token
  has_secure_token :access_token

  # Validations
  validates :contact_id, uniqueness: { scope: :construction_id }
  validates :expires_at, presence: true

  # Scopes
  scope :active, -> { where('expires_at > ?', Time.current).where(revoked_at: nil) }
  scope :expired, -> { where('expires_at <= ?', Time.current) }
  scope :revoked, -> { where.not(revoked_at: nil) }
  scope :for_construction, ->(id) { where(construction_id: id) }

  # Callbacks
  before_validation :set_default_expiry, on: :create

  # Instance methods
  def active?
    expires_at > Time.current && revoked_at.nil?
  end

  def expired?
    expires_at <= Time.current
  end

  def revoked?
    revoked_at.present?
  end

  def revoke!
    update!(revoked_at: Time.current)
  end

  def extend!(days: 30)
    update!(expires_at: [expires_at, Time.current].max + days.days)
  end

  def record_access!
    increment!(:access_count)
    update!(last_accessed_at: Time.current)
  end

  # Get tasks assigned to this supplier for this construction
  def assigned_tasks
    SmTask.where(construction_id: construction_id, supplier_id: contact_id)
  end

  # Class methods
  class << self
    def find_by_token(token)
      find_by(access_token: token)
    end

    def create_for_supplier(contact:, construction:, created_by: nil, expires_in: 30.days)
      create!(
        contact: contact,
        construction: construction,
        created_by: created_by,
        expires_at: Time.current + expires_in
      )
    end
  end

  private

  def set_default_expiry
    self.expires_at ||= 30.days.from_now
  end
end
