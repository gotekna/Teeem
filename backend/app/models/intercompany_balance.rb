class IntercompanyBalance < ApplicationRecord
  # Associations
  belongs_to :corporate, foreign_key: "company_id"
  belongs_to :related_company, class_name: "Corporate"

  # Constants
  BALANCE_TYPES = %w[loan receivable payable investment].freeze
  SOURCES = %w[manual xero loan_register bank_sync].freeze

  # Validations
  validates :balance_type, presence: true, inclusion: { in: BALANCE_TYPES }
  validates :source, presence: true, inclusion: { in: SOURCES }
  validates :amount, presence: true, numericality: true
  validates :as_of_date, presence: true
  validate :different_companies

  # Scopes
  scope :as_of, ->(date) { where(as_of_date: date) }
  scope :by_type, ->(type) { where(balance_type: type) }
  scope :by_source, ->(source) { where(source: source) }
  scope :loans, -> { where(balance_type: "loan") }
  scope :receivables, -> { where(balance_type: "receivable") }
  scope :payables, -> { where(balance_type: "payable") }
  scope :investments, -> { where(balance_type: "investment") }
  scope :between_companies, ->(company_id, related_company_id) {
    where(company_id: company_id, related_company_id: related_company_id)
      .or(where(company_id: related_company_id, related_company_id: company_id))
  }

  # Class methods
  def self.latest_as_of_date
    maximum(:as_of_date) || Date.today
  end

  def self.for_company_pair(company_a_id, company_b_id, as_of_date: Date.today)
    between_companies(company_a_id, company_b_id).as_of(as_of_date)
  end

  # Sync balances from loan register for a company group
  def self.sync_from_loans(company_group, as_of_date: Date.today)
    company_ids = company_group.corporate_companies.pluck(:id)

    # Find all active loans between companies in the group
    loans = CorporateLoan.active
      .where(lender_company_id: company_ids, borrower_company_id: company_ids)

    synced_count = 0

    loans.each do |loan|
      # Lender's view: receivable from borrower
      find_or_initialize_by(
        company_id: loan.lender_company_id,
        related_company_id: loan.borrower_company_id,
        balance_type: "loan",
        as_of_date: as_of_date
      ).tap do |balance|
        balance.amount = loan.current_balance || loan.principal_amount
        balance.source = "loan_register"
        balance.source_reference = "loan_#{loan.id}"
        balance.description = "Loan to #{loan.borrower_name}"
        balance.metadata = {
          loan_id: loan.id,
          principal_amount: loan.principal_amount,
          interest_rate: loan.interest_rate,
          maturity_date: loan.maturity_date
        }
        balance.save!
        synced_count += 1
      end

      # Borrower's view: payable to lender (negative from their perspective)
      find_or_initialize_by(
        company_id: loan.borrower_company_id,
        related_company_id: loan.lender_company_id,
        balance_type: "loan",
        as_of_date: as_of_date
      ).tap do |balance|
        balance.amount = -(loan.current_balance || loan.principal_amount)
        balance.source = "loan_register"
        balance.source_reference = "loan_#{loan.id}"
        balance.description = "Loan from #{loan.lender_name}"
        balance.metadata = {
          loan_id: loan.id,
          principal_amount: loan.principal_amount,
          interest_rate: loan.interest_rate,
          maturity_date: loan.maturity_date
        }
        balance.save!
        synced_count += 1
      end
    end

    synced_count
  end

  # Instance methods
  def counterparty_balance
    IntercompanyBalance.find_by(
      company_id: related_company_id,
      related_company_id: company_id,
      balance_type: balance_type,
      as_of_date: as_of_date
    )
  end

  def reconciled?
    counter = counterparty_balance
    return false unless counter

    # Balances should be inverse of each other
    (amount + counter.amount).abs < 0.01
  end

  def discrepancy
    counter = counterparty_balance
    return amount unless counter

    # The discrepancy is when balances don't net to zero
    amount + counter.amount
  end

  def company_name
    corporate&.name
  end

  def related_company_name
    related_company&.name
  end

  private

  def different_companies
    if company_id == related_company_id
      errors.add(:related_company_id, "must be different from company")
    end
  end
end
