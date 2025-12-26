# frozen_string_literal: true

module Gl
  # Concern for models that should respect period locks
  # Include in any model that has a date and shouldn't be modified in locked periods
  module PeriodLockable
    extend ActiveSupport::Concern

    included do
      before_save :check_period_lock
      before_destroy :check_period_lock_for_destroy
    end

    class PeriodLockedError < StandardError
      attr_reader :lock, :date

      def initialize(lock, date)
        @lock = lock
        @date = date
        super("Cannot modify transactions in locked period: #{lock.period_label}")
      end
    end

    private

    def check_period_lock
      return if skip_period_lock_check?

      date = lockable_date
      return unless date

      company = lockable_company
      return unless company

      lock = Gl::PeriodLock.lock_for_date(company, date)
      return unless lock

      # Check if this transaction type is allowed
      unless lock.allows_transaction?(lockable_transaction_type)
        errors.add(:base, "Cannot modify transactions in locked period: #{lock.period_label}")
        throw(:abort)
      end
    end

    def check_period_lock_for_destroy
      return if skip_period_lock_check?

      date = lockable_date
      return unless date

      company = lockable_company
      return unless company

      if Gl::PeriodLock.date_hard_locked?(company, date)
        lock = Gl::PeriodLock.lock_for_date(company, date)
        errors.add(:base, "Cannot delete transactions in locked period: #{lock.period_label}")
        throw(:abort)
      end
    end

    # Override in including class to specify the date column
    def lockable_date
      respond_to?(:date) ? date : (respond_to?(:transaction_date) ? transaction_date : nil)
    end

    # Override in including class to specify the company
    def lockable_company
      if respond_to?(:corporate_company_id)
        corporate_company_id
      elsif respond_to?(:corporate_company)
        corporate_company
      end
    end

    # Override to specify transaction type for soft lock checking
    def lockable_transaction_type
      nil
    end

    # Override to skip lock checking (e.g., for system corrections)
    def skip_period_lock_check?
      @skip_period_lock_check || false
    end

    # Call this to temporarily bypass lock check
    def skip_period_lock!
      @skip_period_lock_check = true
    end
  end
end
