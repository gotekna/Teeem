class CompanyShareholding < ApplicationRecord
  # Associations
  belongs_to :company
  belongs_to :shareholder, class_name: 'Contact'

  # Validations
  validates :number_of_shares, presence: true, numericality: { greater_than: 0 }
  validates :share_class, presence: true
  validates :shareholder_id, uniqueness: { scope: [:company_id, :share_class], message: 'already holds this class of shares' }

  # Scopes
  scope :ordinary, -> { where(share_class: 'ordinary') }
  scope :preference, -> { where(share_class: 'preference') }
  scope :beneficially_held, -> { where(beneficially_held: true) }

  # Calculate percentage of total shares
  def percentage_of_total
    return 0 unless company.shares_on_issue.to_i > 0
    (number_of_shares.to_f / company.shares_on_issue * 100).round(2)
  end

  def shareholder_name
    shareholder&.full_name || shareholder&.first_name
  end
end
