class SdaOwnerStatement < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :owner_contact, class_name: "Contact"
  belongs_to :statement_blob, class_name: "StorageBlob", optional: true

  STATEMENT_TYPES = %w[monthly quarterly annual tax_summary].freeze
  STATUSES = %w[draft generated sent acknowledged].freeze

  validates :statement_type, presence: true, inclusion: { in: STATEMENT_TYPES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :period_start, :period_end, presence: true
  validate :end_after_start

  scope :draft, -> { where(status: "draft") }
  scope :sent, -> { where(status: "sent") }
  scope :by_type, ->(type) { where(statement_type: type) }
  scope :for_period, ->(start_date, end_date) { where("period_start >= ? AND period_end <= ?", start_date, end_date) }

  def total_income
    gross_income.to_d + sda_income.to_d + participant_income.to_d + other_income.to_d
  end

  def net_position
    total_income - total_expenses.to_d
  end

  def tax_deductible_total
    depreciation.to_d + interest_expense.to_d + capital_works_deduction.to_d + total_expenses.to_d
  end

  def generate_from_ledger!
    entries = SdaRentLedgerEntry
      .where(property_id: property_id)
      .for_period(period_start, period_end)

    income_entries = entries.where("debit_amount > 0")
    self.gross_income = income_entries.where(entry_type: "rent_received").sum(:debit_amount)
    self.sda_income = income_entries.where(entry_type: "ndia_payment").sum(:debit_amount)
    self.participant_income = income_entries.where(entry_type: "participant_contribution").sum(:debit_amount)

    expense_entries = entries.where("credit_amount > 0")
    self.management_fees = expense_entries.where(entry_type: "management_fee").sum(:credit_amount)
    self.maintenance_costs = expense_entries.where(entry_type: "expense_payment").sum(:credit_amount)
    self.total_expenses = management_fees.to_d + maintenance_costs.to_d + insurance.to_d +
                          council_rates.to_d + water_rates.to_d + body_corporate.to_d + other_expenses.to_d
    self.net_income = total_income - total_expenses.to_d
    self.amount_disbursed = entries.disbursements.sum(:credit_amount)

    self.income_items = income_entries.map { |e| { date: e.entry_date, type: e.entry_type, amount: e.debit_amount, description: e.description } }
    self.expense_items = expense_entries.map { |e| { date: e.entry_date, type: e.entry_type, amount: e.credit_amount, description: e.description } }

    self.status = "generated"
    save!
  end

  def mark_sent!
    update!(status: "sent", sent_date: Date.current)
  end

  def net_yield_pct
    return nil unless property.effective_value&.positive?
    return nil unless net_income

    annualisation_factor = case statement_type
                           when "monthly" then 12
                           when "quarterly" then 4
                           else 1
                           end

    annualised = net_income * annualisation_factor
    (annualised / property.effective_value * 100).round(2)
  end

  private

  def end_after_start
    return unless period_start && period_end
    errors.add(:period_end, "must be after start") if period_end <= period_start
  end
end
