# frozen_string_literal: true

# JobTab - Configurable tabs for the job detail view
#
# Defines which tabs appear on job pages and their order.
# Each tenant can have their own set of tabs.
#
class JobTab < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable
  self.sync_key_source = :slug

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: { scope: :tenant_id }
  validates :icon, presence: true
  validates :position, presence: true, numericality: { only_integer: true }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position) }
end
