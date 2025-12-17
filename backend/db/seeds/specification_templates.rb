# Specification Templates Seed Data
# Run with: rails runner db/seeds/specification_templates.rb

puts "Creating Specification Templates..."

# House Specification Template (Full 39 sections)
house_template = SpecificationTemplate.find_or_create_by(name: "House Full Specification") do |t|
  t.job_type = JobType.find_by(name: "House")
  t.is_default = true
  t.is_active = true
  t.sections = [
    {
      key: "general",
      name: "General",
      position: 1,
      items: [
        { key: "site_preparation", name: "Site Preparation", type: "pricebook_select" },
        { key: "temporary_services", name: "Temporary Services", type: "pricebook_select" },
        { key: "permits_approvals", name: "Permits & Approvals", type: "text" }
      ]
    },
    {
      key: "site_works",
      name: "Site Works",
      position: 2,
      items: [
        { key: "earthworks", name: "Earthworks", type: "pricebook_select" },
        { key: "retaining_walls", name: "Retaining Walls", type: "pricebook_select" },
        { key: "soil_treatment", name: "Soil Treatment", type: "pricebook_select" }
      ]
    },
    {
      key: "termite_management",
      name: "Termite Management",
      position: 3,
      items: [
        { key: "termite_system", name: "Termite Management System", type: "pricebook_select" },
        { key: "termite_provider", name: "Termite Provider", type: "text" }
      ]
    },
    {
      key: "concrete",
      name: "Concrete",
      position: 4,
      items: [
        { key: "slab_type", name: "Slab Type", type: "pricebook_select" },
        { key: "concrete_mix", name: "Concrete Mix", type: "pricebook_select" },
        { key: "mesh_reinforcement", name: "Mesh & Reinforcement", type: "pricebook_select" }
      ]
    },
    {
      key: "brickwork",
      name: "Brickwork",
      position: 5,
      items: [
        { key: "external_bricks", name: "External Bricks", type: "pricebook_select" },
        { key: "brick_mortar", name: "Brick Mortar Colour", type: "pricebook_select" },
        { key: "feature_bricks", name: "Feature Bricks", type: "pricebook_select" }
      ]
    },
    {
      key: "external_cladding",
      name: "External Cladding",
      position: 6,
      items: [
        { key: "cladding_type", name: "Cladding Type", type: "pricebook_select" },
        { key: "cladding_colour", name: "Cladding Colour", type: "pricebook_select" }
      ]
    },
    {
      key: "render",
      name: "Render",
      position: 7,
      items: [
        { key: "render_type", name: "Render Type", type: "pricebook_select" },
        { key: "render_colour", name: "Render Colour", type: "pricebook_select" }
      ]
    },
    {
      key: "frame",
      name: "Frame",
      position: 8,
      items: [
        { key: "frame_type", name: "Frame Type", type: "pricebook_select" },
        { key: "frame_fixing", name: "Frame Fixing", type: "pricebook_select" }
      ]
    },
    {
      key: "roof_frame",
      name: "Roof Frame",
      position: 9,
      items: [
        { key: "roof_trusses", name: "Roof Trusses", type: "pricebook_select" },
        { key: "roof_pitch", name: "Roof Pitch", type: "text" }
      ]
    },
    {
      key: "roof_cover",
      name: "Roof Cover",
      position: 10,
      items: [
        { key: "roof_tiles", name: "Roof Tiles/Sheets", type: "pricebook_select" },
        { key: "roof_colour", name: "Roof Colour", type: "pricebook_select" },
        { key: "roof_insulation", name: "Roof Insulation", type: "pricebook_select" }
      ]
    },
    {
      key: "plumbing",
      name: "Plumbing",
      position: 11,
      items: [
        { key: "hot_water_system", name: "Hot Water System", type: "pricebook_select" },
        { key: "water_pipes", name: "Water Pipes", type: "pricebook_select" },
        { key: "drainage", name: "Drainage", type: "pricebook_select" }
      ]
    },
    {
      key: "electrical",
      name: "Electrical",
      position: 12,
      items: [
        { key: "power_points", name: "Power Points", type: "pricebook_select" },
        { key: "light_points", name: "Light Points", type: "text" },
        { key: "switchboard", name: "Switchboard", type: "pricebook_select" }
      ]
    },
    {
      key: "insulation",
      name: "Insulation",
      position: 13,
      items: [
        { key: "wall_insulation", name: "Wall Insulation", type: "pricebook_select" },
        { key: "ceiling_insulation", name: "Ceiling Insulation", type: "pricebook_select" }
      ]
    },
    {
      key: "internal_linings",
      name: "Internal Linings",
      position: 14,
      items: [
        { key: "plasterboard", name: "Plasterboard", type: "pricebook_select" },
        { key: "cornice", name: "Cornice", type: "pricebook_select" }
      ]
    },
    {
      key: "windows",
      name: "Windows",
      position: 15,
      items: [
        { key: "window_type", name: "Window Type", type: "pricebook_select" },
        { key: "window_frames", name: "Window Frames", type: "pricebook_select" },
        { key: "window_glass", name: "Window Glass", type: "pricebook_select" }
      ]
    },
    {
      key: "external_doors",
      name: "External Doors",
      position: 16,
      items: [
        { key: "entry_door", name: "Entry Door", type: "pricebook_select" },
        { key: "sliding_doors", name: "Sliding Doors", type: "pricebook_select" },
        { key: "garage_door", name: "Garage Door", type: "pricebook_select" }
      ]
    },
    {
      key: "internal_doors",
      name: "Internal Doors",
      position: 17,
      items: [
        { key: "internal_door_type", name: "Internal Door Type", type: "pricebook_select" },
        { key: "door_hardware", name: "Door Hardware", type: "pricebook_select" }
      ]
    },
    {
      key: "kitchen",
      name: "Kitchen",
      position: 18,
      items: [
        { key: "kitchen_cabinets_upper", name: "Kitchen Cabinets - Upper", type: "pricebook_select" },
        { key: "kitchen_cabinets_lower", name: "Kitchen Cabinets - Lower", type: "pricebook_select" },
        { key: "kitchen_benchtop", name: "Kitchen Benchtop", type: "pricebook_select" },
        { key: "kitchen_splashback", name: "Kitchen Splashback", type: "pricebook_select" },
        { key: "kitchen_sink", name: "Kitchen Sink", type: "pricebook_select" },
        { key: "kitchen_tapware", name: "Kitchen Tapware", type: "pricebook_select" }
      ]
    },
    {
      key: "kitchen_appliances",
      name: "Kitchen Appliances",
      position: 19,
      items: [
        { key: "cooktop", name: "Cooktop", type: "pricebook_select" },
        { key: "oven", name: "Oven", type: "pricebook_select" },
        { key: "rangehood", name: "Rangehood", type: "pricebook_select" },
        { key: "dishwasher", name: "Dishwasher", type: "pricebook_select" }
      ]
    },
    {
      key: "laundry",
      name: "Laundry",
      position: 20,
      items: [
        { key: "laundry_cabinets", name: "Laundry Cabinets", type: "pricebook_select" },
        { key: "laundry_tub", name: "Laundry Tub", type: "pricebook_select" },
        { key: "laundry_tapware", name: "Laundry Tapware", type: "pricebook_select" }
      ]
    },
    {
      key: "bathroom",
      name: "Bathroom",
      position: 21,
      items: [
        { key: "bathroom_vanity", name: "Bathroom Vanity", type: "pricebook_select" },
        { key: "bathroom_mirror", name: "Bathroom Mirror", type: "pricebook_select" },
        { key: "bathroom_tapware", name: "Bathroom Tapware", type: "pricebook_select" },
        { key: "toilet", name: "Toilet", type: "pricebook_select" },
        { key: "shower_screen", name: "Shower Screen", type: "pricebook_select" },
        { key: "bath", name: "Bath", type: "pricebook_select" }
      ]
    },
    {
      key: "ensuite",
      name: "Ensuite",
      position: 22,
      items: [
        { key: "ensuite_vanity", name: "Ensuite Vanity", type: "pricebook_select" },
        { key: "ensuite_tapware", name: "Ensuite Tapware", type: "pricebook_select" },
        { key: "ensuite_toilet", name: "Ensuite Toilet", type: "pricebook_select" },
        { key: "ensuite_shower", name: "Ensuite Shower Screen", type: "pricebook_select" }
      ]
    },
    {
      key: "tiling",
      name: "Tiling",
      position: 23,
      items: [
        { key: "floor_tiles", name: "Floor Tiles", type: "pricebook_select" },
        { key: "wall_tiles", name: "Wall Tiles", type: "pricebook_select" },
        { key: "tile_grout", name: "Tile Grout Colour", type: "pricebook_select" }
      ]
    },
    {
      key: "flooring",
      name: "Flooring",
      position: 24,
      items: [
        { key: "timber_flooring", name: "Timber/Laminate Flooring", type: "pricebook_select" },
        { key: "carpet", name: "Carpet", type: "pricebook_select" },
        { key: "vinyl", name: "Vinyl", type: "pricebook_select" }
      ]
    },
    {
      key: "painting",
      name: "Painting",
      position: 25,
      items: [
        { key: "internal_walls", name: "Internal Walls", type: "pricebook_select" },
        { key: "internal_trim", name: "Internal Trim", type: "pricebook_select" },
        { key: "ceilings", name: "Ceilings", type: "pricebook_select" },
        { key: "external_paint", name: "External Paint", type: "pricebook_select" }
      ]
    },
    {
      key: "wardrobes",
      name: "Wardrobes",
      position: 26,
      items: [
        { key: "wardrobe_type", name: "Wardrobe Type", type: "pricebook_select" },
        { key: "wardrobe_internals", name: "Wardrobe Internals", type: "pricebook_select" }
      ]
    },
    {
      key: "blinds",
      name: "Blinds",
      position: 27,
      items: [
        { key: "blind_type", name: "Blind Type", type: "pricebook_select" },
        { key: "blind_colour", name: "Blind Colour", type: "pricebook_select" }
      ]
    },
    {
      key: "lighting",
      name: "Lighting",
      position: 28,
      items: [
        { key: "downlights", name: "Downlights", type: "pricebook_select" },
        { key: "pendants", name: "Pendants", type: "pricebook_select" },
        { key: "external_lights", name: "External Lights", type: "pricebook_select" }
      ]
    },
    {
      key: "air_conditioning",
      name: "Air Conditioning",
      position: 29,
      items: [
        { key: "ac_type", name: "Air Conditioning Type", type: "pricebook_select" },
        { key: "ac_zones", name: "AC Zones", type: "text" }
      ]
    },
    {
      key: "gutters_downpipes",
      name: "Gutters & Downpipes",
      position: 30,
      items: [
        { key: "gutters", name: "Gutters", type: "pricebook_select" },
        { key: "downpipes", name: "Downpipes", type: "pricebook_select" },
        { key: "fascia", name: "Fascia", type: "pricebook_select" }
      ]
    },
    {
      key: "driveway",
      name: "Driveway",
      position: 31,
      items: [
        { key: "driveway_type", name: "Driveway Type", type: "pricebook_select" },
        { key: "driveway_colour", name: "Driveway Colour", type: "pricebook_select" }
      ]
    },
    {
      key: "paths_paving",
      name: "Paths & Paving",
      position: 32,
      items: [
        { key: "paths", name: "Paths", type: "pricebook_select" },
        { key: "patio", name: "Patio/Alfresco", type: "pricebook_select" }
      ]
    },
    {
      key: "fencing",
      name: "Fencing",
      position: 33,
      items: [
        { key: "fence_type", name: "Fence Type", type: "pricebook_select" },
        { key: "fence_colour", name: "Fence Colour", type: "pricebook_select" },
        { key: "gate", name: "Gate", type: "pricebook_select" }
      ]
    },
    {
      key: "landscaping",
      name: "Landscaping",
      position: 34,
      items: [
        { key: "turf", name: "Turf", type: "pricebook_select" },
        { key: "garden_beds", name: "Garden Beds", type: "text" },
        { key: "trees_plants", name: "Trees & Plants", type: "text" }
      ]
    },
    {
      key: "letterbox",
      name: "Letterbox",
      position: 35,
      items: [
        { key: "letterbox_type", name: "Letterbox Type", type: "pricebook_select" }
      ]
    },
    {
      key: "clothesline",
      name: "Clothesline",
      position: 36,
      items: [
        { key: "clothesline_type", name: "Clothesline Type", type: "pricebook_select" }
      ]
    },
    {
      key: "garage",
      name: "Garage",
      position: 37,
      items: [
        { key: "garage_door_motor", name: "Garage Door Motor", type: "pricebook_select" },
        { key: "garage_internal", name: "Garage Internal Finish", type: "pricebook_select" }
      ]
    },
    {
      key: "smoke_alarms",
      name: "Smoke Alarms",
      position: 38,
      items: [
        { key: "smoke_alarm_type", name: "Smoke Alarm Type", type: "pricebook_select" }
      ]
    },
    {
      key: "security",
      name: "Security",
      position: 39,
      items: [
        { key: "security_screens", name: "Security Screens", type: "pricebook_select" },
        { key: "security_alarm", name: "Security Alarm", type: "pricebook_select" }
      ]
    }
  ]
end
puts "  Created: #{house_template.name}"

# Kitchen Renovation Template (Simplified)
kitchen_template = SpecificationTemplate.find_or_create_by(name: "Kitchen Renovation") do |t|
  t.job_type = JobType.find_by(name: "Kitchen")
  t.is_default = false
  t.is_active = true
  t.sections = [
    {
      key: "demolition",
      name: "Demolition",
      position: 1,
      items: [
        { key: "existing_removal", name: "Existing Kitchen Removal", type: "text" }
      ]
    },
    {
      key: "kitchen_cabinets",
      name: "Kitchen Cabinets",
      position: 2,
      items: [
        { key: "cabinets_upper", name: "Upper Cabinets", type: "pricebook_select" },
        { key: "cabinets_lower", name: "Lower Cabinets", type: "pricebook_select" },
        { key: "pantry", name: "Pantry", type: "pricebook_select" }
      ]
    },
    {
      key: "benchtops",
      name: "Benchtops",
      position: 3,
      items: [
        { key: "benchtop_material", name: "Benchtop Material", type: "pricebook_select" },
        { key: "benchtop_colour", name: "Benchtop Colour", type: "pricebook_select" }
      ]
    },
    {
      key: "splashback",
      name: "Splashback",
      position: 4,
      items: [
        { key: "splashback_type", name: "Splashback Type", type: "pricebook_select" },
        { key: "splashback_colour", name: "Splashback Colour", type: "pricebook_select" }
      ]
    },
    {
      key: "sink_tapware",
      name: "Sink & Tapware",
      position: 5,
      items: [
        { key: "sink", name: "Sink", type: "pricebook_select" },
        { key: "tapware", name: "Tapware", type: "pricebook_select" }
      ]
    },
    {
      key: "appliances",
      name: "Appliances",
      position: 6,
      items: [
        { key: "cooktop", name: "Cooktop", type: "pricebook_select" },
        { key: "oven", name: "Oven", type: "pricebook_select" },
        { key: "rangehood", name: "Rangehood", type: "pricebook_select" },
        { key: "dishwasher", name: "Dishwasher", type: "pricebook_select" },
        { key: "microwave", name: "Microwave", type: "pricebook_select" }
      ]
    },
    {
      key: "flooring",
      name: "Flooring",
      position: 7,
      items: [
        { key: "floor_type", name: "Floor Type", type: "pricebook_select" },
        { key: "floor_colour", name: "Floor Colour", type: "pricebook_select" }
      ]
    },
    {
      key: "lighting",
      name: "Lighting",
      position: 8,
      items: [
        { key: "task_lighting", name: "Task Lighting", type: "pricebook_select" },
        { key: "ambient_lighting", name: "Ambient Lighting", type: "pricebook_select" }
      ]
    }
  ]
end
puts "  Created: #{kitchen_template.name}"

# NDIS House Template (House + NDIS additions)
ndis_template = SpecificationTemplate.find_or_create_by(name: "NDIS House Specification") do |t|
  t.job_type = JobType.find_by(name: "NDIS House")
  t.is_default = false
  t.is_active = true
  # Copy house sections and add NDIS-specific ones
  house_sections = house_template.sections.deep_dup
  ndis_sections = [
    {
      key: "ndis_accessibility",
      name: "NDIS Accessibility Requirements",
      position: 40,
      items: [
        { key: "sda_level", name: "SDA Design Level", type: "text" },
        { key: "wheelchair_access", name: "Wheelchair Access", type: "text" },
        { key: "door_widths", name: "Door Widths", type: "text" },
        { key: "corridor_widths", name: "Corridor Widths", type: "text" },
        { key: "ramp_requirements", name: "Ramp Requirements", type: "text" }
      ]
    },
    {
      key: "ndis_bathroom",
      name: "NDIS Bathroom Modifications",
      position: 41,
      items: [
        { key: "grab_rails", name: "Grab Rails", type: "pricebook_select" },
        { key: "shower_seat", name: "Shower Seat", type: "pricebook_select" },
        { key: "accessible_toilet", name: "Accessible Toilet", type: "pricebook_select" },
        { key: "non_slip_flooring", name: "Non-Slip Flooring", type: "pricebook_select" }
      ]
    },
    {
      key: "ndis_kitchen",
      name: "NDIS Kitchen Modifications",
      position: 42,
      items: [
        { key: "lowered_benchtops", name: "Lowered Benchtops", type: "text" },
        { key: "pull_out_drawers", name: "Pull-Out Drawers", type: "pricebook_select" },
        { key: "accessible_appliances", name: "Accessible Appliance Placement", type: "text" }
      ]
    },
    {
      key: "ndis_assistive_tech",
      name: "NDIS Assistive Technology",
      position: 43,
      items: [
        { key: "ceiling_hoists", name: "Ceiling Hoists", type: "pricebook_select" },
        { key: "automation", name: "Home Automation", type: "pricebook_select" },
        { key: "emergency_call", name: "Emergency Call System", type: "pricebook_select" }
      ]
    }
  ]
  t.sections = house_sections + ndis_sections
end
puts "  Created: #{ndis_template.name}"

puts "Specification Templates created: #{SpecificationTemplate.count}"
