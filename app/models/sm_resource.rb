# frozen_string_literal: true

# SmResource - Resources (people, equipment, materials) for SM Gantt Phase 2
#
# See GANTT_ARCHITECTURE_PLAN.md Section 16
#
class SmResource < ApplicationRecord
  # Resource types
  RESOURCE_TYPES = %w[person equipment material].freeze

  # Associations
  belongs_to :user, optional: true
  has_many :resource_allocations, class_name: 'SmResourceAllocation', dependent: :destroy
  has_many :time_entries, class_name: 'SmTimeEntry', dependent: :destroy
  has_many :tasks, through: :resource_allocations, source: :task

  # Validations
  validates :name, presence: true, length: { maximum: 100 }
  validates :resource_type, presence: true, inclusion: { in: RESOURCE_TYPES }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :people, -> { where(resource_type: 'person') }
  scope :equipment, -> { where(resource_type: 'equipment') }
  scope :materials, -> { where(resource_type: 'material') }
  scope :ordered, -> { order(:name) }

  # Helper to check type
  def person?
    resource_type == 'person'
  end

  def equipment?
    resource_type == 'equipment'
  end

  def material?
    resource_type == 'material'
  end

  # Get total hours allocated for a date range
  def allocated_hours_for_range(start_date, end_date)
    resource_allocations
      .where(allocation_date: start_date..end_date)
      .sum(:allocated_hours)
  end

  # Get total hours logged for a date range
  def logged_hours_for_range(start_date, end_date)
    time_entries
      .where(entry_date: start_date..end_date)
      .sum(:total_hours)
  end
end
