FactoryBot.define do
  factory :feature_tracker do
    chapter { "MyString" }
    feature_name { "MyString" }
    detail_point_1 { "MyText" }
    detail_point_2 { "MyText" }
    detail_point_3 { "MyText" }
    system_complete { false }
    dev_checked { false }
    tester_checked { false }
    user_checked { false }
    sort_order { 1 }
  end
end
