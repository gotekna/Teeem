class PropertyContact < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :contact

  # Roles
  ROLES = %w[owner tenant co_tenant guarantor agent property_manager sda_participant].freeze

  validates :role, presence: true, inclusion: { in: ROLES }
  validates :contact_id, uniqueness: { scope: [:property_id, :role], message: "already has this role on this property" }
  validates :is_primary, uniqueness: { scope: [:property_id, :role], message: "already set for this role" }, if: :is_primary?

  # Scopes
  scope :primary, -> { where(is_primary: true) }
  scope :by_role, ->(role) { where(role: role) }
  scope :active, -> { where(end_date: nil).or(where("end_date >= ?", Date.current)) }

  def active?
    end_date.nil? || end_date >= Date.current
  end
end
