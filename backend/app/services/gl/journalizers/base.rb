# frozen_string_literal: true

module Gl
  module Journalizers
    # Base class for journalizers
    #
    # Journalizers convert source documents (invoices, bills, payments)
    # into double-entry journal entries.
    #
    class Base
      attr_reader :source, :corporate_company

      def initialize(source)
        @source = source
        @corporate_company = source.corporate_company
      end

      # Create the journal entry - subclasses must implement
      def journalize
        raise NotImplementedError, "#{self.class} must implement #journalize"
      end

      protected

      # Find the appropriate period for a date
      def period_for(date)
        Gl::Period.find_or_create_for_date(corporate_company, date)
      end

      # Find account by system account type
      def find_system_account(system_type)
        Gl::Account.find_by(
          corporate_company: corporate_company,
          system_account: system_type,
          active: true
        )
      end

      # Find account by code
      def find_account_by_code(code)
        return nil if code.blank?

        Gl::Account.find_by(
          corporate_company: corporate_company,
          code: code,
          active: true
        )
      end

      # Find account by ID
      def find_account(id)
        return nil if id.blank?

        Gl::Account.find_by(
          corporate_company: corporate_company,
          id: id,
          active: true
        )
      end

      # Get AR account
      def accounts_receivable
        find_system_account('accounts_receivable')
      end

      # Get AP account
      def accounts_payable
        find_system_account('accounts_payable')
      end

      # Get GST Collected account
      def gst_collected
        find_system_account('gst_collected')
      end

      # Get GST Paid account
      def gst_paid
        find_system_account('gst_paid')
      end

      # Get default sales account
      def sales_account
        find_system_account('sales') || find_account_by_code('200')
      end

      # Get default expense account
      def expense_account
        find_system_account('expense') || find_account_by_code('400')
      end

      # Create a new journal entry
      def create_journal_entry(attrs = {})
        Gl::JournalEntry.new(
          {
            corporate_company: corporate_company,
            status: 'posted',
            currency_code: 'AUD',
            exchange_rate: 1.0
          }.merge(attrs)
        )
      end
    end
  end
end
