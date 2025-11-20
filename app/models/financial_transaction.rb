class FinancialTransaction < ApplicationRecord
  # Associations
  belongs_to :construction, optional: true
  belongs_to :user
  belongs_to :company
  belongs_to :keepr_journal, class_name: 'Keepr::Journal', optional: true

  # File attachment for receipts
  has_one_attached :receipt

  # Enums
  enum transaction_type: {
    income: 'income',
    expense: 'expense'
  }, _prefix: :type

  enum status: {
    draft: 'draft',
    posted: 'posted',
    synced: 'synced'
  }, _prefix: true

  # Validations
  validates :transaction_type, presence: true
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :transaction_date, presence: true
  validates :status, presence: true
  validate :transaction_date_not_in_future

  # Scopes
  scope :income, -> { where(transaction_type: 'income') }
  scope :expenses, -> { where(transaction_type: 'expense') }
  scope :posted, -> { where(status: 'posted') }
  scope :synced, -> { where(status: 'synced') }
  scope :unsynced, -> { where.not(status: 'synced') }
  scope :for_job, ->(job_id) { where(construction_id: job_id) }
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :in_date_range, ->(from_date, to_date) { where(transaction_date: from_date..to_date) }
  scope :recent, -> { order(transaction_date: :desc, created_at: :desc) }
  scope :by_category, ->(category) { where(category: category) }

  # Callbacks
  before_validation :set_default_status, on: :create

  # Instance Methods
  def income?
    transaction_type == 'income'
  end

  def expense?
    transaction_type == 'expense'
  end

  def can_edit?
    status_draft? || status_posted?
  end

  def can_delete?
    !status_synced?
  end

  def synced?
    status_synced?
  end

  def sync_to_external_system(integration)
    return false unless can_sync?

    # Will be implemented by sync service
    true
  end

  def mark_synced!(external_id, system_type)
    update!(
      status: 'synced',
      external_system_id: external_id,
      external_system_type: system_type,
      synced_at: Time.current
    )
  end

  # Class Methods
  def self.income_total(scope = all)
    scope.income.sum(:amount)
  end

  def self.expense_total(scope = all)
    scope.expenses.sum(:amount)
  end

  def self.net_profit(scope = all)
    income_total(scope) - expense_total(scope)
  end

  def self.by_month(date = Date.current)
    start_date = date.beginning_of_month
    end_date = date.end_of_month
    in_date_range(start_date, end_date)
  end

  def self.by_year(year = Date.current.year)
    start_date = Date.new(year, 1, 1)
    end_date = Date.new(year, 12, 31)
    in_date_range(start_date, end_date)
  end

  def self.categories_for_type(type)
    if type == 'income'
      ['Job Revenue', 'Material Sales', 'Other Income']
    else
      ['Materials', 'Labour', 'Subcontractors', 'Fuel & Transport',
       'Tools & Equipment', 'Insurance', 'Professional Fees', 'Other Expenses']
    end
  end

  private

  def set_default_status
    self.status ||= 'draft'
  end

  def transaction_date_not_in_future
    return unless transaction_date.present?

    if transaction_date > Date.current
      errors.add(:transaction_date, "cannot be in the future")
    end
  end

  def can_sync?
    status_posted? && !synced?
  end
end
