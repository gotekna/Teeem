class XeroChartOfAccount < ApplicationRecord
  # Associations
  belongs_to :corporate_group, optional: true  # nil = global/default COA

  # Validations
  validates :account_code, presence: true
  validates :account_name, presence: true
  validates :account_code, uniqueness: { scope: :company_group_id, message: "already exists for this group" }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :global, -> { where(company_group_id: nil) }
  scope :for_group, ->(group_id) { where(company_group_id: group_id) }
  scope :by_code, -> { order(:account_code) }
  scope :banks, -> { where(account_type: "Bank") }
  scope :assets, -> { where("account_type LIKE '%Asset%'") }
  scope :liabilities, -> { where("account_type LIKE '%Liability%'") }
  scope :revenue, -> { where(account_type: "Revenue") }
  scope :expenses, -> { where("account_type LIKE '%Expense%'") }

  def display_name
    "#{account_code} - #{account_name}"
  end

  # Get the effective COA for a company (group-specific or global)
  def self.for_company(company)
    if company.company_group_id.present?
      group_accounts = for_group(company.company_group_id).active
      return group_accounts if group_accounts.any?
    end
    global.active
  end
end
