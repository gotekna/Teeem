FactoryBot.define do
  factory :contact do
    sequence(:email) { |n| "contact#{n}@example.com" }
    sequence(:first_name) { |n| "FirstName#{n}" }
    sequence(:last_name) { |n| "LastName#{n}" }
    entity_type { "person" }
    is_active { true }

    # Person (individual) contact
    trait :person do
      entity_type { "person" }
      first_name { "John" }
      last_name { "Doe" }
    end

    # Company contact
    trait :company do
      entity_type { "company" }
      company_name_or_trust { "Acme Corporation Pty Ltd" }
      first_name { nil }
      last_name { nil }
    end

    # Trust contact
    trait :trust do
      entity_type { "trust" }
      company_name_or_trust { "Smith Family Trust" }
      first_name { nil }
      last_name { nil }
    end

    # Supplier contact (company that can be used as supplier)
    trait :supplier do
      entity_type { "company" }
      company_name_or_trust { "Supplier Co Pty Ltd" }
      # Note: Supplier status is determined by having pricebook_items
      # or purchase_orders, not a boolean flag
    end

    # Contact with ABN
    trait :with_abn do
      abn { "12345678901" }
    end

    # Contact with quality issues (for quality review tests)
    trait :with_quality_issues do
      # Missing required fields to trigger quality checks
      email { nil }
      mobile_phone { nil }
    end

    # Inactive contact
    trait :inactive do
      is_active { false }
    end
  end
end
