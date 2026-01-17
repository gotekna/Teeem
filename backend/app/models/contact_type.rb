# frozen_string_literal: true

class ContactType < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant
  acts_as_tenant :corporate_group, foreign_key: :company_group_id

  # Validations
  validates :name, presence: true, uniqueness: { scope: :company_group_id }
  validates :display_name, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than: 0 }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position) }

  # Class methods
  def self.for_select
    active.ordered.map do |ct|
      {
        value: ct.name,
        label: ct.display_name,
        tabLabel: ct.tab_label || ct.display_name
      }
    end
  end
end
