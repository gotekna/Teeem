# NDIS SDA Price Guide 2025-26
# Source: NDIS SDA Price Guide (approximate rates per day)
# Idempotent: uses find_or_create_by! so safe to re-run.

puts "Seeding NDIS SDA Price Guide 2025-26..."

EFFECTIVE_FROM = Date.new(2025, 7, 1)
FINANCIAL_YEAR = "2025-26"

rates = [
  # High Physical Support - the highest funded category
  { design_category: "high_physical_support", building_type: "house",     resident_count: 1, daily_rate: 105.56, support_item_number: "01_802_0118_1_1" },
  { design_category: "high_physical_support", building_type: "house",     resident_count: 2, daily_rate:  73.66, support_item_number: "01_803_0118_1_1" },
  { design_category: "high_physical_support", building_type: "house",     resident_count: 3, daily_rate:  58.51, support_item_number: "01_804_0118_1_1" },
  { design_category: "high_physical_support", building_type: "apartment", resident_count: 1, daily_rate:  92.09, support_item_number: "01_811_0118_1_1" },
  { design_category: "high_physical_support", building_type: "apartment", resident_count: 2, daily_rate:  64.27, support_item_number: "01_812_0118_1_1" },

  # Fully Accessible
  { design_category: "fully_accessible", building_type: "house",     resident_count: 1, daily_rate: 69.77, support_item_number: "01_820_0118_1_1" },
  { design_category: "fully_accessible", building_type: "house",     resident_count: 2, daily_rate: 48.71, support_item_number: "01_821_0118_1_1" },
  { design_category: "fully_accessible", building_type: "house",     resident_count: 3, daily_rate: 38.69, support_item_number: "01_822_0118_1_1" },
  { design_category: "fully_accessible", building_type: "apartment", resident_count: 1, daily_rate: 60.87, support_item_number: "01_830_0118_1_1" },
  { design_category: "fully_accessible", building_type: "apartment", resident_count: 2, daily_rate: 42.49, support_item_number: "01_831_0118_1_1" },

  # Improved Liveability
  { design_category: "improved_liveability", building_type: "house",     resident_count: 1, daily_rate: 42.43, support_item_number: "01_840_0118_1_1" },
  { design_category: "improved_liveability", building_type: "house",     resident_count: 2, daily_rate: 29.62, support_item_number: "01_841_0118_1_1" },
  { design_category: "improved_liveability", building_type: "house",     resident_count: 3, daily_rate: 23.53, support_item_number: "01_842_0118_1_1" },
  { design_category: "improved_liveability", building_type: "apartment", resident_count: 1, daily_rate: 37.02, support_item_number: "01_850_0118_1_1" },
  { design_category: "improved_liveability", building_type: "apartment", resident_count: 2, daily_rate: 25.84, support_item_number: "01_851_0118_1_1" },

  # Robust - designed for participants with high support needs and challenging behaviours
  { design_category: "robust", building_type: "house",     resident_count: 1, daily_rate: 47.33, support_item_number: "01_860_0118_1_1" },
  { design_category: "robust", building_type: "house",     resident_count: 2, daily_rate: 33.04, support_item_number: "01_861_0118_1_1" },
  { design_category: "robust", building_type: "house",     resident_count: 3, daily_rate: 26.25, support_item_number: "01_862_0118_1_1" },
  { design_category: "robust", building_type: "apartment", resident_count: 1, daily_rate: 41.29, support_item_number: "01_870_0118_1_1" },
  { design_category: "robust", building_type: "apartment", resident_count: 2, daily_rate: 28.82, support_item_number: "01_871_0118_1_1" },
]

created = 0
skipped = 0

rates.each do |rate|
  record = NdisPriceGuide.find_or_initialize_by(
    design_category: rate[:design_category],
    building_type:   rate[:building_type],
    resident_count:  rate[:resident_count],
    effective_from:  EFFECTIVE_FROM
  )

  if record.new_record?
    record.assign_attributes(
      daily_rate:           rate[:daily_rate],
      support_item_number:  rate[:support_item_number],
      financial_year:       FINANCIAL_YEAR
    )
    record.save!
    created += 1
    print "."
  else
    skipped += 1
  end
end

puts ""
puts "NDIS Price Guide seeded: #{created} created, #{skipped} already existed"
puts "Financial year: #{FINANCIAL_YEAR} (effective #{EFFECTIVE_FROM})"
