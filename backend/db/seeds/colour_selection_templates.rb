# frozen_string_literal: true

# Seed file for Colour Selection Templates
# Run with: rails runner 'load Rails.root.join("db/seeds/colour_selection_templates.rb")'

puts "Creating Colour Selection Templates..."

# Get job types
house_type = JobType.find_by(name: "House")
kitchen_type = JobType.find_by(name: "Kitchen")
ndis_house_type = JobType.find_by(name: "NDIS House")
ndis_units_type = JobType.find_by(name: "NDIS Units")

# ============================================
# HOUSE COLOUR SELECTION TEMPLATE
# ============================================
house_categories = [
  {
    key: "facade",
    name: "Façade",
    position: 1,
    items: [
      { key: "fine_texture_cladding", name: "Fine Texture Cladding" },
      { key: "horizontal_boarding", name: "Horizontal Boarding" },
      { key: "rendered_blade_walls", name: "Rendered Blade Walls" },
      { key: "feature_columns", name: "Feature Columns" },
      { key: "letterbox", name: "Letterbox" }
    ]
  },
  {
    key: "external_walls",
    name: "External Walls",
    position: 2,
    items: [
      { key: "face_brickwork", name: "Face Brickwork" },
      { key: "rendered_walls", name: "Rendered Walls" },
      { key: "cladding", name: "Cladding" }
    ]
  },
  {
    key: "garage",
    name: "Garage",
    position: 3,
    items: [
      { key: "garage_door", name: "Garage Door" },
      { key: "garage_door_colour", name: "Garage Door Colour" }
    ]
  },
  {
    key: "roof_gutter_fascia",
    name: "Roof / Gutter / Fascia",
    position: 4,
    items: [
      { key: "roof_tiles", name: "Roof Tiles" },
      { key: "roof_sheets", name: "Roof Sheets (if applicable)" },
      { key: "gutters", name: "Gutters" },
      { key: "fascia", name: "Fascia" },
      { key: "downpipes", name: "Downpipes" }
    ]
  },
  {
    key: "windows",
    name: "Windows",
    position: 5,
    items: [
      { key: "window_frames", name: "Window Frames" },
      { key: "window_glass", name: "Window Glass Type" }
    ]
  },
  {
    key: "driveway",
    name: "Driveway",
    position: 6,
    items: [
      { key: "driveway_concrete", name: "Driveway Concrete" },
      { key: "driveway_pavers", name: "Driveway Pavers (if applicable)" },
      { key: "pathway", name: "Pathway" }
    ]
  },
  {
    key: "entry_doors",
    name: "Entry Doors",
    position: 7,
    items: [
      { key: "front_door", name: "Front Entry Door" },
      { key: "front_door_hardware", name: "Front Door Hardware" },
      { key: "laundry_door", name: "Laundry External Door" },
      { key: "alfresco_doors", name: "Alfresco Doors" }
    ]
  },
  {
    key: "flooring",
    name: "Flooring",
    position: 8,
    items: [
      { key: "main_living_floor", name: "Main Living Areas" },
      { key: "bedroom_floor", name: "Bedrooms" },
      { key: "wet_area_floor", name: "Wet Areas" },
      { key: "garage_floor", name: "Garage Floor" },
      { key: "alfresco_floor", name: "Alfresco" }
    ]
  },
  {
    key: "paint",
    name: "Paint",
    position: 9,
    items: [
      { key: "internal_walls", name: "Internal Walls" },
      { key: "internal_ceiling", name: "Ceiling" },
      { key: "internal_trim", name: "Internal Trim / Skirting" },
      { key: "internal_doors", name: "Internal Doors" },
      { key: "feature_wall", name: "Feature Wall (if applicable)" }
    ]
  },
  {
    key: "blinds",
    name: "Blinds / Window Coverings",
    position: 10,
    items: [
      { key: "living_blinds", name: "Living Areas" },
      { key: "bedroom_blinds", name: "Bedrooms" },
      { key: "wet_area_blinds", name: "Wet Areas" }
    ]
  },
  {
    key: "kitchen",
    name: "Kitchen",
    position: 11,
    items: [
      { key: "kitchen_benchtop", name: "Benchtop" },
      { key: "kitchen_cabinetry_uppers", name: "Upper Cabinetry" },
      { key: "kitchen_cabinetry_lowers", name: "Lower Cabinetry" },
      { key: "kitchen_splashback", name: "Splashback" },
      { key: "kitchen_handles", name: "Handles" },
      { key: "kitchen_sink", name: "Sink" },
      { key: "kitchen_tapware", name: "Tapware" }
    ]
  },
  {
    key: "wet_areas",
    name: "Wet Areas",
    position: 12,
    items: [
      { key: "bathroom_vanity", name: "Bathroom Vanity" },
      { key: "bathroom_benchtop", name: "Vanity Benchtop" },
      { key: "bathroom_floor_tiles", name: "Floor Tiles" },
      { key: "bathroom_wall_tiles", name: "Wall Tiles" },
      { key: "bathroom_feature_tiles", name: "Feature Tiles" },
      { key: "bathroom_tapware", name: "Tapware" },
      { key: "bathroom_shower_screen", name: "Shower Screen" },
      { key: "bathroom_toilet", name: "Toilet Suite" },
      { key: "bathroom_bath", name: "Bath (if applicable)" },
      { key: "bathroom_accessories", name: "Accessories" }
    ]
  },
  {
    key: "ensuite",
    name: "Ensuite",
    position: 13,
    items: [
      { key: "ensuite_vanity", name: "Vanity" },
      { key: "ensuite_benchtop", name: "Vanity Benchtop" },
      { key: "ensuite_floor_tiles", name: "Floor Tiles" },
      { key: "ensuite_wall_tiles", name: "Wall Tiles" },
      { key: "ensuite_feature_tiles", name: "Feature Tiles" },
      { key: "ensuite_tapware", name: "Tapware" },
      { key: "ensuite_shower_screen", name: "Shower Screen" },
      { key: "ensuite_toilet", name: "Toilet Suite" }
    ]
  },
  {
    key: "laundry",
    name: "Laundry",
    position: 14,
    items: [
      { key: "laundry_tub", name: "Laundry Tub" },
      { key: "laundry_cabinetry", name: "Cabinetry" },
      { key: "laundry_benchtop", name: "Benchtop" },
      { key: "laundry_floor_tiles", name: "Floor Tiles" },
      { key: "laundry_tapware", name: "Tapware" }
    ]
  }
]

ColourSelectionTemplate.find_or_create_by!(name: "House Colour Selection") do |t|
  t.job_type = house_type
  t.categories = house_categories
  t.is_default = true
  t.is_active = true
end
puts "  Created: House Colour Selection"

# ============================================
# KITCHEN COLOUR SELECTION TEMPLATE
# ============================================
kitchen_categories = [
  {
    key: "kitchen",
    name: "Kitchen",
    position: 1,
    items: [
      { key: "kitchen_benchtop", name: "Benchtop" },
      { key: "kitchen_cabinetry_uppers", name: "Upper Cabinetry" },
      { key: "kitchen_cabinetry_lowers", name: "Lower Cabinetry" },
      { key: "kitchen_pantry", name: "Pantry Cabinetry" },
      { key: "kitchen_island", name: "Island Cabinetry (if applicable)" },
      { key: "kitchen_splashback", name: "Splashback" },
      { key: "kitchen_handles", name: "Handles / Knobs" },
      { key: "kitchen_sink", name: "Sink" },
      { key: "kitchen_tapware", name: "Tapware" },
      { key: "kitchen_rangehood", name: "Rangehood" }
    ]
  },
  {
    key: "appliances",
    name: "Appliances",
    position: 2,
    items: [
      { key: "oven", name: "Oven" },
      { key: "cooktop", name: "Cooktop" },
      { key: "dishwasher", name: "Dishwasher" },
      { key: "microwave", name: "Microwave (if built-in)" },
      { key: "fridge_space", name: "Fridge Space Finish" }
    ]
  },
  {
    key: "flooring",
    name: "Flooring",
    position: 3,
    items: [
      { key: "kitchen_floor", name: "Kitchen Floor" }
    ]
  },
  {
    key: "paint",
    name: "Paint",
    position: 4,
    items: [
      { key: "kitchen_walls", name: "Kitchen Walls" },
      { key: "kitchen_ceiling", name: "Kitchen Ceiling" }
    ]
  }
]

ColourSelectionTemplate.find_or_create_by!(name: "Kitchen Renovation Colours") do |t|
  t.job_type = kitchen_type
  t.categories = kitchen_categories
  t.is_default = true
  t.is_active = true
end
puts "  Created: Kitchen Renovation Colours"

# ============================================
# NDIS HOUSE COLOUR SELECTION TEMPLATE
# ============================================
ndis_categories = house_categories + [
  {
    key: "accessibility",
    name: "Accessibility Features",
    position: 15,
    items: [
      { key: "grab_rails", name: "Grab Rails" },
      { key: "door_handles", name: "Accessible Door Handles" },
      { key: "shower_seat", name: "Shower Seat" },
      { key: "non_slip_flooring", name: "Non-Slip Flooring" },
      { key: "contrasting_strips", name: "Contrasting Strips" }
    ]
  }
]

ColourSelectionTemplate.find_or_create_by!(name: "NDIS House Colours") do |t|
  t.job_type = ndis_house_type
  t.categories = ndis_categories
  t.is_default = true
  t.is_active = true
end
puts "  Created: NDIS House Colours"

# Also assign to NDIS Units if exists
if ndis_units_type
  ColourSelectionTemplate.find_or_create_by!(name: "NDIS Units Colours") do |t|
    t.job_type = ndis_units_type
    t.categories = ndis_categories
    t.is_default = true
    t.is_active = true
  end
  puts "  Created: NDIS Units Colours"
end

puts "Colour Selection Templates seeding complete!"
