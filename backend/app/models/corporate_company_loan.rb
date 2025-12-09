class CorporateCompanyLoan < ApplicationRecord
  # Associations
  belongs_to :lender_company, class_name: "CorporateCompany"
  belongs_to :borrower_company, class_name: "CorporateCompany"
  has_many :corporate_company_documents, foreign_key: "loan_id", dependent: :nullify

  # Validations
  validates :principal_amount, presence: true, numericality: { greater_than: 0 }
  validates :status, inclusion: { in: %w[active repaid written_off] }
  validates :interest_type, inclusion: { in: %w[fixed variable interest-free], allow_blank: true }
  validates :security_type, inclusion: { in: %w[unsecured mortgage ppsr], allow_blank: true }
  validate :different_companies

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :repaid, -> { where(status: "repaid") }
  scope :documented, -> { where(loan_documents_in_place: true) }
  scope :undocumented, -> { where(loan_documents_in_place: false) }
  scope :by_lender, ->(company_id) { where(lender_company_id: company_id) }
  scope :by_borrower, ->(company_id) { where(borrower_company_id: company_id) }

  # Callbacks
  before_save :set_current_balance

  def lender_name
    lender_company&.name
  end

  def borrower_name
    borrower_company&.name
  end

  def interest_free?
    interest_type == "interest-free" || interest_rate.to_f.zero?
  end

  def overdue?
    maturity_date.present? && maturity_date < Date.today && status == "active"
  end

  private

  def different_companies
    if lender_company_id == borrower_company_id
      errors.add(:borrower_company_id, "can't be the same as lender")
    end
  end

  def set_current_balance
    self.current_balance ||= principal_amount
  end
end
