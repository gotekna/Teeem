# frozen_string_literal: true

# SmResourceAllocation - Resource allocation to tasks for SM Gantt Phase 2
#
# See GANTT_ARCHITECTURE_PLAN.md Section 16
#
class SmResourceAllocation < ApplicationRecord
  # Status values
  STATUSES = %w[planned confirmed in_progress completed].freeze

  # Associations
  belongs_to :task, class_name: 'SmTask'
  belongs_to :resource, class_name: 'SmResource'

  # Validations
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :planned, -> { where(status: 'planned') }
  scope :confirmed, -> { where(status: 'confirmed') }
  scope :in_progress, -> { where(status: 'in_progress') }
  scope :completed, -> { where(status: 'completed') }
  scope :for_date, ->(date) { where(allocation_date: date) }
  scope :for_date_range, ->(start_date, end_date) { where(allocation_date: start_date..end_date) }

  # Status helpers
  def planned?
    status == 'planned'
  end

  def confirmed?
    status == 'confirmed'
  end

  def in_progress?
    status == 'in_progress'
  end

  def completed?
    status == 'completed'
  end
end
