# frozen_string_literal: true

# SmTimeEntry - Time tracking for tasks and resources in SM Gantt Phase 2
#
# See GANTT_ARCHITECTURE_PLAN.md Section 16
#
class SmTimeEntry < ApplicationRecord
  # Entry types
  ENTRY_TYPES = %w[regular overtime travel standby].freeze

  # Associations
  belongs_to :task, class_name: 'SmTask'
  belongs_to :resource, class_name: 'SmResource'
  belongs_to :allocation, class_name: 'SmResourceAllocation', optional: true
  belongs_to :approved_by, class_name: 'User', optional: true
  belongs_to :created_by, class_name: 'User', optional: true

  # Validations
  validates :entry_date, presence: true
  validates :total_hours, presence: true, numericality: { greater_than: 0 }
  validates :entry_type, inclusion: { in: ENTRY_TYPES }
  validates :break_minutes, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  # Scopes
  scope :for_date, ->(date) { where(entry_date: date) }
  scope :for_date_range, ->(start_date, end_date) { where(entry_date: start_date..end_date) }
  scope :approved, -> { where.not(approved_at: nil) }
  scope :pending_approval, -> { where(approved_at: nil) }
  scope :regular, -> { where(entry_type: 'regular') }
  scope :overtime, -> { where(entry_type: 'overtime') }
  scope :ordered, -> { order(:entry_date, :start_time) }

  # Entry type helpers
  def regular?
    entry_type == 'regular'
  end

  def overtime?
    entry_type == 'overtime'
  end

  def travel?
    entry_type == 'travel'
  end

  def standby?
    entry_type == 'standby'
  end

  # Approval helpers
  def approved?
    approved_at.present?
  end

  def approve!(user)
    update!(approved_by: user, approved_at: Time.current)
  end

  # Calculate total hours from start/end time
  def calculate_total_hours
    return unless start_time && end_time
    hours = (end_time - start_time) / 1.hour
    hours -= (break_minutes || 0) / 60.0
    hours.round(2)
  end
end
