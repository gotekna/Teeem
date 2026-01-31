# frozen_string_literal: true

module Gl
  # Locks accounting periods to prevent changes after month/quarter/year close
  class PeriodLock < ApplicationRecord
    self.table_name = "gl_period_locks"

    PERIOD_TYPES = %w[month quarter year].freeze
    STATUSES = %w[locked unlocked soft_locked].freeze

    belongs_to :corporate_company
    belongs_to :locked_by, class_name: "User", optional: true
    belongs_to :unlocked_by, class_name: "User", optional: true

    validates :period_start, presence: true
    validates :period_end, presence: true
    validates :period_type, presence: true, inclusion: { in: PERIOD_TYPES }
    validates :status, presence: true, inclusion: { in: STATUSES }

    validate :period_end_after_start
    validate :no_overlapping_locks

    scope :locked, -> { where(status: "locked") }
    scope :soft_locked, -> { where(status: "soft_locked") }
    scope :active, -> { where(status: %w[locked soft_locked]) }
    scope :for_date, ->(date) { where("period_start <= ? AND period_end >= ?", date, date) }

    # Check if a date is locked for a company
    def self.date_locked?(company, date)
      company_id = company.is_a?(CorporateCompany) ? company.id : company
      active.where(corporate_company_id: company_id).for_date(date).exists?
    end

    # Check if a date is hard locked (no exceptions)
    def self.date_hard_locked?(company, date)
      company_id = company.is_a?(CorporateCompany) ? company.id : company
      locked.where(corporate_company_id: company_id).for_date(date).exists?
    end

    # Get the lock for a specific date
    def self.lock_for_date(company, date)
      company_id = company.is_a?(CorporateCompany) ? company.id : company
      active.where(corporate_company_id: company_id).for_date(date).first
    end

    # Lock a period
    def self.lock_period!(company, period_type:, period_end:, locked_by: nil, reason: nil)
      company_id = company.is_a?(CorporateCompany) ? company.id : company

      period_start = calculate_period_start(period_end, period_type)

      # Calculate audit info
      transactions_count = Gl::JournalEntry
                           .where(corporate_company_id: company_id)
                           .where(date: period_start..period_end)
                           .count

      lock = create!(
        corporate_company_id: company_id,
        period_type: period_type,
        period_start: period_start,
        period_end: period_end,
        status: "locked",
        locked_at: Time.current,
        locked_by: locked_by,
        lock_reason: reason,
        transactions_at_lock: transactions_count
      )

      # Update company setting for quick lookup
      TenantSetting.find_or_create_by(corporate_company_id: company_id).update!(
        gl_lock_date: period_end
      )

      lock
    end

    # Unlock a period (requires reason and admin)
    def unlock!(unlocked_by:, reason:)
      update!(
        status: "unlocked",
        unlocked_at: Time.current,
        unlocked_by: unlocked_by,
        unlock_reason: reason
      )

      # Recalculate company lock date
      recalculate_company_lock_date!
    end

    # Soft lock (allows adjustments with approval)
    def soft_lock!
      update!(status: "soft_locked")
    end

    # Re-lock after soft lock
    def relock!(locked_by: nil, reason: nil)
      update!(
        status: "locked",
        locked_at: Time.current,
        locked_by: locked_by,
        lock_reason: reason
      )
    end

    # Check if transaction is allowed
    def allows_transaction?(transaction_type = nil)
      return true if status == "unlocked"
      return false if status == "locked"

      # Soft lock allows certain adjustments
      %w[adjustment correction reversal].include?(transaction_type.to_s)
    end

    def period_label
      case period_type
      when "month"
        period_end.strftime("%B %Y")
      when "quarter"
        quarter = ((period_end.month - 1) / 3) + 1
        "Q#{quarter} #{period_end.year}"
      when "year"
        "FY #{period_end.year}"
      else
        "#{period_start.strftime('%d %b %Y')} - #{period_end.strftime('%d %b %Y')}"
      end
    end

    private

    def period_end_after_start
      return unless period_start && period_end

      errors.add(:period_end, "must be after period start") if period_end < period_start
    end

    def no_overlapping_locks
      return unless corporate_company_id && period_start && period_end

      overlapping = self.class
                        .where(corporate_company_id: corporate_company_id)
                        .where(status: %w[locked soft_locked])
                        .where.not(id: id)
                        .where("period_start <= ? AND period_end >= ?", period_end, period_start)

      errors.add(:base, "Period overlaps with existing lock") if overlapping.exists?
    end

    def recalculate_company_lock_date!
      latest_lock = self.class
                        .where(corporate_company_id: corporate_company_id)
                        .locked
                        .order(period_end: :desc)
                        .first

      TenantSetting.find_by(corporate_company_id: corporate_company_id)&.update!(
        gl_lock_date: latest_lock&.period_end
      )
    end

    def self.calculate_period_start(period_end, period_type)
      case period_type
      when "month"
        period_end.beginning_of_month
      when "quarter"
        period_end.beginning_of_quarter
      when "year"
        # Australian financial year starts July 1
        period_end.month >= 7 ? Date.new(period_end.year, 7, 1) : Date.new(period_end.year - 1, 7, 1)
      else
        period_end.beginning_of_month
      end
    end
  end
end
