# frozen_string_literal: true

module Gl
  # Periodic snapshot for audit compliance
  class AuditSnapshot < ApplicationRecord
    self.table_name = "gl_audit_snapshots"

    SNAPSHOT_TYPES = %w[daily monthly quarterly annual eofy].freeze

    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :created_by, class_name: "User", optional: true

    validates :snapshot_type, presence: true, inclusion: { in: SNAPSHOT_TYPES }
    validates :snapshot_date, presence: true

    before_create :generate_reference
    before_create :capture_totals

    scope :for_type, ->(type) { where(snapshot_type: type) }
    scope :recent, -> { order(snapshot_date: :desc) }

    # Create daily snapshot
    def self.daily_snapshot!(company, date: Date.current, user: nil)
      create!(
        corporate: company,
        snapshot_type: "daily",
        snapshot_date: date,
        created_by: user
      )
    end

    # Create monthly snapshot
    def self.monthly_snapshot!(company, month_end: Date.current.end_of_month, user: nil)
      create!(
        corporate: company,
        snapshot_type: "monthly",
        snapshot_date: month_end,
        created_by: user
      )
    end

    # Create EOFY snapshot
    def self.eofy_snapshot!(company, fy_end: Date.new(Date.current.year, 6, 30), user: nil)
      create!(
        corporate: company,
        snapshot_type: "eofy",
        snapshot_date: fy_end,
        created_by: user
      )
    end

    # Export full data
    def export_data!
      data = {
        snapshot_date: snapshot_date,
        reference: reference,
        chart_of_accounts: export_accounts,
        trial_balance: export_trial_balance,
        invoices: export_invoices,
        payments: export_payments,
        journals: export_journals
      }

      json = data.to_json
      self.checksum = Digest::SHA256.hexdigest(json)
      save!

      json
    end

    private

    def generate_reference
      return if reference.present?

      prefix = snapshot_type.upcase[0..2]
      self.reference = "#{prefix}#{snapshot_date.strftime('%Y%m%d')}"
    end

    def capture_totals
      self.invoice_count = corporate.gl_invoices.where("date <= ?", snapshot_date).count
      self.payment_count = corporate.gl_payments.where("date <= ?", snapshot_date).count
      self.journal_count = corporate.gl_journal_entries.where("date <= ?", snapshot_date).count

      # Calculate totals from trial balance
      # This is simplified - would need proper implementation
      self.total_revenue = corporate.gl_accounts.where(account_type: "revenue").sum(:balance).abs
      self.total_expenses = corporate.gl_accounts.where(account_type: "expense").sum(:balance)
      self.total_assets = corporate.gl_accounts.where(account_type: "asset").sum(:balance)
      self.total_liabilities = corporate.gl_accounts.where(account_type: "liability").sum(:balance).abs
    end

    def export_accounts
      corporate.gl_accounts.order(:code).as_json
    end

    def export_trial_balance
      corporate.gl_accounts.map do |a|
        { code: a.code, name: a.name, debit: a.balance.positive? ? a.balance : 0, credit: a.balance.negative? ? a.balance.abs : 0 }
      end
    end

    def export_invoices
      corporate.gl_invoices.where("date <= ?", snapshot_date).as_json
    end

    def export_payments
      corporate.gl_payments.where("date <= ?", snapshot_date).as_json
    end

    def export_journals
      corporate.gl_journal_entries.where("date <= ?", snapshot_date).as_json
    end
  end
end
