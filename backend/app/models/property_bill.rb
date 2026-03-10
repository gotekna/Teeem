class PropertyBill < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy, optional: true
  belongs_to :supplier_contact, class_name: "Contact", optional: true

  # Bill types
  BILL_TYPES = %w[cleaning maintenance utilities insurance rates body_corporate other].freeze
  CHARGE_TO_OPTIONS = %w[owner tenant government_ndis].freeze
  STATUSES = %w[draft approved invoiced paid].freeze

  validates :bill_type, presence: true, inclusion: { in: BILL_TYPES }
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :bill_date, presence: true
  validates :charge_to, presence: true, inclusion: { in: CHARGE_TO_OPTIONS }
  validates :status, presence: true, inclusion: { in: STATUSES }

  # Scopes
  scope :by_type, ->(type) { where(bill_type: type) }
  scope :by_status, ->(status) { where(status: status) }
  scope :chargeable_to, ->(target) { where(charge_to: target) }
  scope :unpaid, -> { where.not(status: "paid") }
  scope :overdue, -> { where("due_date < ? AND status NOT IN (?)", Date.current, %w[paid invoiced]) }

  def total_with_tax
    amount + (tax_amount || 0)
  end
end
