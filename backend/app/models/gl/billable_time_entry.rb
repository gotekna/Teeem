# frozen_string_literal: true

module Gl
  # Time entry marked for billing
  class BillableTimeEntry < ApplicationRecord
    self.table_name = "gl_billable_time_entries"

    STATUSES = %w[unbilled pending_approval approved billed written_off].freeze
    TASK_TYPES = %w[design development meeting review admin travel other].freeze

    belongs_to :corporate_company
    belongs_to :user
    belongs_to :job, optional: true
    belongs_to :billable_rate, class_name: "Gl::BillableRate", optional: true
    belongs_to :invoice, class_name: "Gl::Invoice", optional: true
    belongs_to :approved_by, class_name: "User", optional: true

    validates :entry_date, presence: true
    validates :hours, presence: true, numericality: { greater_than: 0 }
    validates :hourly_rate, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :amount, presence: true
    validates :status, inclusion: { in: STATUSES }

    before_validation :calculate_amount, if: :should_calculate_amount?

    scope :unbilled, -> { where(status: "unbilled") }
    scope :pending, -> { where(status: "pending_approval") }
    scope :approved, -> { where(status: "approved") }
    scope :billed, -> { where(status: "billed") }
    scope :billable, -> { where(billable: true) }
    scope :for_job, ->(job) { where(job_id: job.id) }
    scope :for_period, ->(start_date, end_date) { where(entry_date: start_date..end_date) }
    scope :ready_to_bill, -> { where(status: "approved", billable: true, invoiced: false) }

    # Create from SmTimeEntry
    def self.create_from_time_entry!(time_entry, corporate_company:)
      rate = BillableRate.find_rate_for(
        corporate_company,
        user: time_entry.user,
        job: time_entry.job,
        date: time_entry.date
      )

      create!(
        corporate_company: corporate_company,
        time_entry_id: time_entry.id,
        user: time_entry.user,
        job: time_entry.job,
        entry_date: time_entry.date,
        hours: time_entry.hours,
        billable_hours: time_entry.hours,
        hourly_rate: rate&.hourly_rate || 0,
        billable_rate: rate,
        description: time_entry.notes,
        task_type: time_entry.task_type,
        billable: time_entry.billable != false
      )
    end

    # Submit for approval
    def submit_for_approval!
      return false unless status == "unbilled"

      update!(status: "pending_approval")
    end

    # Approve the time entry
    def approve!(approver)
      return false unless status == "pending_approval"

      update!(
        status: "approved",
        approved_at: Time.current,
        approved_by: approver
      )
    end

    # Reject back to unbilled
    def reject!
      return false unless status == "pending_approval"

      update!(status: "unbilled", approved_at: nil, approved_by: nil)
    end

    # Mark as billed
    def mark_billed!(invoice)
      update!(
        status: "billed",
        invoice: invoice,
        invoiced: true
      )
    end

    # Write off unbillable time
    def write_off!(reason = nil)
      update!(
        status: "written_off",
        billable: false,
        notes: [notes, "Written off: #{reason}"].compact.join("\n")
      )
    end

    # Adjust billable hours
    def adjust_hours!(new_hours, reason = nil)
      old_hours = billable_hours
      update!(
        billable_hours: new_hours,
        notes: [notes, "Hours adjusted from #{old_hours} to #{new_hours}: #{reason}"].compact.join("\n")
      )
      calculate_amount
      save!
    end

    private

    def should_calculate_amount?
      hours.present? && hourly_rate.present? && (hours_changed? || hourly_rate_changed? || billable_hours_changed?)
    end

    def calculate_amount
      self.billable_hours ||= hours
      self.amount = (billable_hours * hourly_rate).round(2)
    end
  end
end
