class PublicHoliday < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant
  acts_as_tenant :corporate_group, foreign_key: :company_group_id

  validates :name, presence: true
  validates :date, presence: true, uniqueness: { scope: [:company_group_id, :region] }
  validates :region, presence: true

  scope :for_region, ->(region) { where(region: region) }
  scope :for_year, ->(year) { where("EXTRACT(YEAR FROM date) = ?", year) }
  scope :upcoming, -> { where("date >= ?", CorporateCompanySetting.today).order(date: :asc) }

  # Seed QLD public holidays for 2025-2027
  def self.seed_qld_holidays
    holidays = [
      # 2025
      { name: "New Year's Day", date: "2025-01-01", region: "QLD" },
      { name: "Australia Day", date: "2025-01-27", region: "QLD" },
      { name: "Good Friday", date: "2025-04-18", region: "QLD" },
      { name: "Easter Saturday", date: "2025-04-19", region: "QLD" },
      { name: "Easter Monday", date: "2025-04-21", region: "QLD" },
      { name: "ANZAC Day", date: "2025-04-25", region: "QLD" },
      { name: "Labour Day", date: "2025-05-05", region: "QLD" },
      { name: "Queen's Birthday", date: "2025-10-06", region: "QLD" },
      { name: "Christmas Day", date: "2025-12-25", region: "QLD" },
      { name: "Boxing Day", date: "2025-12-26", region: "QLD" },

      # 2026
      { name: "New Year's Day", date: "2026-01-01", region: "QLD" },
      { name: "Australia Day", date: "2026-01-26", region: "QLD" },
      { name: "Good Friday", date: "2026-04-03", region: "QLD" },
      { name: "Easter Saturday", date: "2026-04-04", region: "QLD" },
      { name: "Easter Monday", date: "2026-04-06", region: "QLD" },
      { name: "ANZAC Day", date: "2026-04-25", region: "QLD" },
      { name: "Labour Day", date: "2026-05-04", region: "QLD" },
      { name: "Queen's Birthday", date: "2026-10-05", region: "QLD" },
      { name: "Christmas Day", date: "2026-12-25", region: "QLD" },
      { name: "Boxing Day", date: "2026-12-28", region: "QLD" },

      # 2027
      { name: "New Year's Day", date: "2027-01-01", region: "QLD" },
      { name: "Australia Day", date: "2027-01-26", region: "QLD" },
      { name: "Good Friday", date: "2027-03-26", region: "QLD" },
      { name: "Easter Saturday", date: "2027-03-27", region: "QLD" },
      { name: "Easter Monday", date: "2027-03-29", region: "QLD" },
      { name: "ANZAC Day", date: "2027-04-26", region: "QLD" },
      { name: "Labour Day", date: "2027-05-03", region: "QLD" },
      { name: "Queen's Birthday", date: "2027-10-04", region: "QLD" },
      { name: "Christmas Day", date: "2027-12-27", region: "QLD" },
      { name: "Boxing Day", date: "2027-12-28", region: "QLD" }
    ]

    holidays.each do |holiday|
      find_or_create_by(date: holiday[:date], region: holiday[:region]) do |h|
        h.name = holiday[:name]
      end
    end
  end
end
