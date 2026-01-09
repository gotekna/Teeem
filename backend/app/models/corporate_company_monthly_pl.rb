class CorporateCompanyMonthlyPl < ApplicationRecord
  belongs_to :corporate_company

  validates :month, presence: true, uniqueness: { scope: :corporate_company_id }

  scope :ordered, -> { order(month: :desc) }
  scope :for_year, ->(year) { where("EXTRACT(YEAR FROM month) = ?", year) }
  scope :recent, ->(count = 12) { ordered.limit(count) }

  # Format month for display (e.g., "Jan 2024")
  def month_label
    super.presence || month&.strftime("%b %Y")
  end

  # Upsert from Xero data
  def self.upsert_from_xero(corporate_company, month_date, data)
    record = find_or_initialize_by(
      corporate_company: corporate_company,
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
