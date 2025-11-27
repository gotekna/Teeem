class CompanyXeroAccount < ApplicationRecord
  # Associations
  belongs_to :company_xero_connection

  # Validations
  validates :xero_account_id, presence: true, uniqueness: true
  validates :account_name, presence: true
  validates :status, inclusion: { in: %w[ACTIVE ARCHIVED DELETED] }, allow_blank: true

  # Scopes
  scope :active, -> { where(status: 'ACTIVE') }
  scope :archived, -> { where(status: 'ARCHIVED') }
  scope :by_type, ->(type) { where(account_type: type) }
  scope :revenue, -> { where(account_type: 'REVENUE') }
  scope :expense, -> { where(account_type: 'EXPENSE') }
  scope :asset, -> { where(account_type: 'ASSET') }
  scope :liability, -> { where(account_type: 'LIABILITY') }
  scope :equity, -> { where(account_type: 'EQUITY') }
  scope :mapped, -> { where.not(consolidated_account_code: nil) }
  scope :unmapped, -> { where(consolidated_account_code: nil) }

  # Instance methods
  def display_name
    if account_code.present?
      "#{account_code} - #{account_name}"
    else
      account_name
    end
  end

  def active?
    status == 'ACTIVE'
  end

  def mapped?
    consolidated_account_code.present?
  end

  def company
    company_xero_connection.company
  end
end
