class Dividend < ApplicationRecord
  # Associations
  belongs_to :corporate_company, foreign_key: "company_id"
  has_many :dividend_payments, dependent: :destroy

  # Validations
  validates :declaration_date, presence: true
  validates :total_amount, presence: true, numericality: { greater_than: 0 }
  validates :status, inclusion: { in: %w[declared paid cancelled] }
  validates :dividend_type, inclusion: { in: %w[interim final special], allow_blank: true }
  validates :franking_percentage, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Scopes
  scope :declared, -> { where(status: "declared") }
  scope :paid, -> { where(status: "paid") }
  scope :by_date, -> { order(declaration_date: :desc) }
  scope :for_financial_year, ->(year) {
    start_date = Date.new(year - 1, 7, 1)
    end_date = Date.new(year, 6, 30)
    where(declaration_date: start_date..end_date)
  }

  def fully_franked?
    franking_percentage.to_f >= 100
  end

  def unfranked?
    franking_percentage.to_f.zero?
  end

  def franking_credit
    return 0 if unfranked?
    (total_amount * franking_percentage / 100 * 30 / 70).round(2)
  end

  def gross_amount
    total_amount + franking_credit
  end

  # Calculate per-share dividend
  def dividend_per_share
    return 0 unless corporate_company.shares_on_issue.to_i > 0
    (total_amount / corporate_company.shares_on_issue).round(4)
  end
end
