class XeroChartOfAccount < ApplicationRecord
  acts_as_tenant :tenant

  # Validations
  validates :account_code, presence: true
  validates :account_name, presence: true
  validates :account_code, uniqueness: { scope: :tenant_id, message: "already exists for this tenant" }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :global, -> { where(tenant_id: nil) }
  scope :for_tenant, ->(tenant_id) { where(tenant_id: tenant_id) }
  scope :by_code, -> { order(:account_code) }
  scope :banks, -> { where(account_type: "Bank") }
  scope :assets, -> { where("account_type LIKE '%Asset%'") }
  scope :liabilities, -> { where("account_type LIKE '%Liability%'") }
  scope :revenue, -> { where(account_type: "Revenue") }
  scope :expenses, -> { where("account_type LIKE '%Expense%'") }

  def display_name
    "#{account_code} - #{account_name}"
  end

  # Get the effective COA for a company (tenant-specific or global)
  # With acts_as_tenant, this returns tenant-scoped accounts automatically
  def self.for_company(company)
    tenant_accounts = active
    return tenant_accounts if tenant_accounts.any?
    global.active
  end
end
