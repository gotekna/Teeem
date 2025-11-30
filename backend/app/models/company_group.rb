class CompanyGroup < ApplicationRecord
  # Associations
  has_many :companies, dependent: :nullify
  has_many :xero_chart_of_accounts, dependent: :destroy

  # Validations
  validates :name, presence: true, uniqueness: true

  # Scopes
  scope :active, -> { where(active: true) }

  def display_name
    name
  end

  def companies_count
    companies.count
  end
end
