class SdaRentLedgerEntry < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy, optional: true
  belongs_to :contact, optional: true
  belongs_to :gl_invoice, class_name: "Gl::Invoice", optional: true

  ENTRY_TYPES = %w[
    rent_received ndia_payment participant_contribution bond_received bond_refund
    disbursement_to_owner expense_payment management_fee adjustment arrears_notice
  ].freeze

  validates :entry_type, presence: true, inclusion: { in: ENTRY_TYPES }
  validates :entry_date, presence: true
  validates :debit_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :credit_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  scope :for_period, ->(start_date, end_date) { where(entry_date: start_date..end_date) }
  scope :trust_entries, -> { where(entry_type: %w[rent_received ndia_payment participant_contribution bond_received bond_refund]) }
  scope :unreconciled, -> { where(reconciled: false) }
  scope :by_type, ->(type) { where(entry_type: type) }

  def net_amount
    (debit_amount || 0) - (credit_amount || 0)
  end
end
