FactoryBot.define do
  factory :document_folder do
    name { "MyString" }
    description { "MyText" }
    order_position { 1 }
    entity_types { "" }
    active { false }
  end
end
