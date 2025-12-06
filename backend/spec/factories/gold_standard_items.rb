FactoryBot.define do
  factory :gold_standard_item do
    # Contact fields
    email { "user#{rand(1000)}@example.com" }
    phone { "555-#{rand(1000..9999)}" }
    mobile { "555-#{rand(1000..9999)}" }

    # Text fields
    single_line_text { "Sample text #{rand(100)}" }
    multiple_lines_text { "This is a longer text\nwith multiple lines\nfor testing purposes." }

    # Numeric fields
    whole_number { rand(1..1000) }
    number { rand(1.0..1000.0).round(2) }
    currency { rand(10.0..500.0).round(2) }
    percentage { rand(0.0..100.0).round(2) }

    # Date fields
    date { Date.today + rand(-365..365).days }
    date_and_time { Time.current + rand(-365..365).days }

    # Special fields
    url { "https://example.com/page#{rand(100)}" }
    gps_coordinates { "#{rand(-90.0..90.0).round(6)},#{rand(-180.0..180.0).round(6)}" }
    color_picker { "#%06x" % rand(0xffffff) }
    boolean { [ true, false ].sample }

    # Lookup and choice fields
    choice { [ "Option A", "Option B", "Option C" ].sample }
    lookup { "Lookup Value #{rand(100)}" }
    multiple_lookups { [ "Value1", "Value2", "Value3" ].sample(2).to_json }

    # Other fields
    user { rand(1..10) }
    computed { "Computed Value #{rand(100)}" }
    action_buttons { "button_#{rand(5)}" }
    file_upload { nil }  # Usually handled separately with attachments

    # Trait for minimal valid item (useful for quick tests)
    trait :minimal do
      email { "test@example.com" }
      phone { nil }
      mobile { nil }
      single_line_text { nil }
      multiple_lines_text { nil }
      whole_number { nil }
      number { nil }
      currency { nil }
      percentage { nil }
      date { nil }
      date_and_time { nil }
      url { nil }
      gps_coordinates { nil }
      color_picker { nil }
      boolean { nil }
      choice { nil }
      lookup { nil }
      multiple_lookups { nil }
      user { nil }
      computed { nil }
      action_buttons { nil }
      file_upload { nil }
    end

    # Trait for complete item (all fields populated)
    trait :complete do
      email { "complete@example.com" }
      phone { "555-1234" }
      mobile { "555-5678" }
      single_line_text { "Complete text" }
      multiple_lines_text { "Complete multi-line\ntext content" }
      whole_number { 100 }
      number { 123.45 }
      currency { 99.99 }
      percentage { 85.5 }
      date { Date.today }
      date_and_time { Time.current }
      url { "https://complete.example.com" }
      gps_coordinates { "37.7749,-122.4194" }
      color_picker { "#FF5733" }
      boolean { true }
      choice { "Complete Choice" }
      lookup { "Complete Lookup" }
      multiple_lookups { [ "Lookup1", "Lookup2" ].to_json }
      user { 1 }
      computed { "Complete Computed" }
      action_buttons { "complete_button" }
    end
  end
end
