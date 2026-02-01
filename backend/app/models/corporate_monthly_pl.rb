class CorporateMonthlyPl < ApplicationRecord
  acts_as_tenant :tenant  # Multi-tenancy: Auto-scope queries to current tenant

  # Explicit table name since we renamed from corporate_company_monthly_pls
  self.table_name = "corporate_monthly_pls"

  # Associations
  belongs_to :tenant
  belongs_to :corporate, foreign_key: "corporate_id"
  alias_method :company, :corporate

  validates :month, presence: true, uniqueness: { scope: :corporate_id }

  scope :ordered, -> { order(month: :desc) }
  scope :for_year, ->(year) { where("EXTRACT(YEAR FROM month) = ?", year) }
  scope :recent, ->(count = 12) { ordered.limit(count) }

  # Format month for display (e.g., "Jan 2024")
  def month_label
    super.presence || month&.strftime("%b %Y")
  end

  # Upsert from Xero data
  def self.upsert_from_xero(corporate, month_date, data)
    record = find_or_initialize_by(
      corporate: corporate,
      month: month_date.beginning_of_month
    )
    record.assign_attributes(
      month_label: month_date.strftime("%b %Y"),
      revenue: data[:revenue] || 0,
      expenses: data[:expenses] || 0,
      net_profit: data[:net_profit] || 0,
      synced_at: Time.current
    )
    record.save!
    record
  end
end
