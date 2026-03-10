class PropertyStatus < ApplicationRecord
  acts_as_tenant :tenant

  has_many :properties, dependent: :nullify

  validates :name, presence: true, uniqueness: { scope: :tenant_id }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(position: :asc, name: :asc) }
end
