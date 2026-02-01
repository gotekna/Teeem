class CorporateXeroAccount < ApplicationRecord
  acts_as_tenant :tenant  # Multi-tenancy: Auto-scope queries to current tenant

  # Explicit table name since we renamed from corporate_company_xero_accounts
  self.table_name = "corporate_xero_accounts"

  # Associations
  belongs_to :tenant
  belongs_to :corporate_xero_connection, foreign_key: "corporate_xero_connection_id"

  # Validations
  validates :xero_account_id, presence: true, uniqueness: true
  validates :account_name, presence: true
  validates :status, inclusion: { in: %w[ACTIVE ARCHIVED DELETED] }, allow_blank: true

  # Scopes
  scope :active, -> { where(status: "ACTIVE") }
  scope :archived, -> { where(status: "ARCHIVED") }
  scope :by_type, ->(type) { where(account_type: type) }
  scope :revenue, -> { where(account_type: "REVENUE") }
  scope :expense, -> { where(account_type: "EXPENSE") }
  scope :asset, -> { where(account_type: "ASSET") }
  scope :liability, -> { where(account_type: "LIABILITY") }
  scope :equity, -> { where(account_type: "EQUITY") }
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
    status == "ACTIVE"
  end

  def mapped?
    consolidated_account_code.present?
  end

  def company
    corporate_xero_connection.corporate
  end
end

# Backwards compatibility alias (deprecated - use CorporateXeroAccount directly)
CorporateCompanyXeroAccount = CorporateXeroAccount
