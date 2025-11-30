FactoryBot.define do
  factory :insurance_policy do
    company { nil }
    cover_type { "MyString" }
    insured_party { "MyString" }
    start_date { "2025-11-29" }
    renewal_date { "2025-11-29" }
    annual_premium { "9.99" }
    monthly_premium { "9.99" }
    broker { "MyString" }
    notes { "MyText" }
  end
end
