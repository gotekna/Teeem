FactoryBot.define do
  factory :email_blacklist_item do
    pattern { "MyString" }
    pattern_type { "MyString" }
    description { "MyText" }
    active { false }
  end
end
