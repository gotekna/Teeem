FactoryBot.define do
  factory :bank_statement_template do
    bank_code { "MyString" }
    bank_name { "MyString" }
    primary_color { "MyString" }
    secondary_color { "MyString" }
    text_on_primary { "MyString" }
    account_type { "MyString" }
    date_format { "MyString" }
    detection_patterns { "" }
    layout_style { "MyString" }
    is_active { false }
  end
end
