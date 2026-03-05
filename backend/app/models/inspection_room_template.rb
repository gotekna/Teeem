class InspectionRoomTemplate < ApplicationRecord
  acts_as_tenant :tenant

  PROPERTY_TYPES = %w[house apartment townhouse commercial unit villa other].freeze

  validates :name, presence: true, uniqueness: { scope: :tenant_id }
  validates :property_type_name, presence: true, inclusion: { in: PROPERTY_TYPES }
  validates :rooms, presence: true

  scope :active, -> { where(active: true) }
  scope :defaults, -> { where(is_default: true) }
  scope :by_property_type, ->(type) { where(property_type_name: type) }

  def room_count
    rooms.size
  end

  def item_count
    rooms.sum { |r| (r["items"] || []).size }
  end

  def self.seed_defaults!(tenant_id)
    defaults = [
      {
        name: "Standard House",
        property_type_name: "house",
        is_default: true,
        rooms: [
          { name: "Front Exterior", room_type: "outdoor", items: [
            { name: "Front yard/garden" }, { name: "Driveway" }, { name: "Fencing/gates" },
            { name: "Letterbox" }, { name: "External walls" }, { name: "Gutters/downpipes" }
          ]},
          { name: "Entry/Hallway", room_type: "hallway", items: [
            { name: "Front door/lock" }, { name: "Walls" }, { name: "Ceiling" },
            { name: "Floor/carpet" }, { name: "Light fittings" }, { name: "Smoke detector" }
          ]},
          { name: "Living Room", room_type: "living", items: [
            { name: "Walls" }, { name: "Ceiling" }, { name: "Floor/carpet" },
            { name: "Windows/blinds" }, { name: "Light fittings" }, { name: "Power points" },
            { name: "Air conditioning" }
          ]},
          { name: "Kitchen", room_type: "kitchen", items: [
            { name: "Walls/splashback" }, { name: "Ceiling" }, { name: "Floor" },
            { name: "Benchtops" }, { name: "Cupboards/drawers" }, { name: "Sink/tapware" },
            { name: "Oven/cooktop" }, { name: "Rangehood" }, { name: "Dishwasher" },
            { name: "Pantry" }
          ]},
          { name: "Dining Room", room_type: "dining", items: [
            { name: "Walls" }, { name: "Ceiling" }, { name: "Floor/carpet" },
            { name: "Windows/blinds" }, { name: "Light fittings" }
          ]},
          { name: "Master Bedroom", room_type: "bedroom", items: [
            { name: "Walls" }, { name: "Ceiling" }, { name: "Floor/carpet" },
            { name: "Windows/blinds" }, { name: "Built-in wardrobe" }, { name: "Light fittings" },
            { name: "Power points" }, { name: "Door/lock" }
          ]},
          { name: "Ensuite", room_type: "ensuite", items: [
            { name: "Walls/tiles" }, { name: "Ceiling" }, { name: "Floor" },
            { name: "Vanity/basin" }, { name: "Toilet" }, { name: "Shower/bath" },
            { name: "Tapware" }, { name: "Mirror/cabinet" }, { name: "Exhaust fan" },
            { name: "Towel rails" }
          ]},
          { name: "Bedroom 2", room_type: "bedroom", items: [
            { name: "Walls" }, { name: "Ceiling" }, { name: "Floor/carpet" },
            { name: "Windows/blinds" }, { name: "Built-in wardrobe" }, { name: "Light fittings" },
            { name: "Door" }
          ]},
          { name: "Bedroom 3", room_type: "bedroom", items: [
            { name: "Walls" }, { name: "Ceiling" }, { name: "Floor/carpet" },
            { name: "Windows/blinds" }, { name: "Built-in wardrobe" }, { name: "Light fittings" },
            { name: "Door" }
          ]},
          { name: "Main Bathroom", room_type: "bathroom", items: [
            { name: "Walls/tiles" }, { name: "Ceiling" }, { name: "Floor" },
            { name: "Vanity/basin" }, { name: "Toilet" }, { name: "Shower/bath" },
            { name: "Tapware" }, { name: "Mirror/cabinet" }, { name: "Exhaust fan" },
            { name: "Towel rails" }
          ]},
          { name: "Laundry", room_type: "laundry", items: [
            { name: "Walls" }, { name: "Floor" }, { name: "Tub/tapware" },
            { name: "Cupboards" }, { name: "Dryer vent" }, { name: "Door" }
          ]},
          { name: "Garage", room_type: "garage", items: [
            { name: "Garage door/remote" }, { name: "Walls" }, { name: "Floor" },
            { name: "Light fittings" }, { name: "Power points" }, { name: "Internal access door" }
          ]},
          { name: "Rear Exterior", room_type: "outdoor", items: [
            { name: "Rear yard/garden" }, { name: "Patio/deck" }, { name: "Clothesline" },
            { name: "Fencing" }, { name: "Garden shed" }, { name: "Pool/spa" }
          ]}
        ]
      },
      {
        name: "Standard Apartment",
        property_type_name: "apartment",
        is_default: true,
        rooms: [
          { name: "Entry/Hallway", room_type: "hallway", items: [
            { name: "Front door/lock" }, { name: "Intercom" }, { name: "Walls" },
            { name: "Floor" }, { name: "Light fittings" }
          ]},
          { name: "Living/Dining", room_type: "living", items: [
            { name: "Walls" }, { name: "Ceiling" }, { name: "Floor" },
            { name: "Windows/blinds" }, { name: "Light fittings" }, { name: "Air conditioning" },
            { name: "Power points" }
          ]},
          { name: "Kitchen", room_type: "kitchen", items: [
            { name: "Walls/splashback" }, { name: "Benchtops" }, { name: "Cupboards/drawers" },
            { name: "Sink/tapware" }, { name: "Oven/cooktop" }, { name: "Rangehood" },
            { name: "Dishwasher" }
          ]},
          { name: "Master Bedroom", room_type: "bedroom", items: [
            { name: "Walls" }, { name: "Ceiling" }, { name: "Floor" },
            { name: "Windows/blinds" }, { name: "Built-in wardrobe" }, { name: "Light fittings" }
          ]},
          { name: "Bedroom 2", room_type: "bedroom", items: [
            { name: "Walls" }, { name: "Ceiling" }, { name: "Floor" },
            { name: "Windows/blinds" }, { name: "Built-in wardrobe" }, { name: "Light fittings" }
          ]},
          { name: "Bathroom", room_type: "bathroom", items: [
            { name: "Walls/tiles" }, { name: "Floor" }, { name: "Vanity/basin" },
            { name: "Toilet" }, { name: "Shower/bath" }, { name: "Tapware" },
            { name: "Mirror/cabinet" }, { name: "Exhaust fan" }
          ]},
          { name: "Laundry", room_type: "laundry", items: [
            { name: "Tub/tapware" }, { name: "Cupboards" }, { name: "Dryer vent" }
          ]},
          { name: "Balcony", room_type: "balcony", items: [
            { name: "Floor" }, { name: "Balustrade" }, { name: "Ceiling" },
            { name: "Light fittings" }
          ]},
          { name: "Car Space", room_type: "car_space", items: [
            { name: "Allocated space" }, { name: "Condition of bay" }
          ]},
          { name: "Storage Cage", room_type: "storage", items: [
            { name: "Lock" }, { name: "Condition" }
          ]}
        ]
      },
      {
        name: "Commercial Premises",
        property_type_name: "commercial",
        is_default: true,
        rooms: [
          { name: "Reception/Entry", room_type: "hallway", items: [
            { name: "Front door/lock" }, { name: "Security system" }, { name: "Walls" },
            { name: "Floor" }, { name: "Signage" }, { name: "Reception desk" }
          ]},
          { name: "Main Office Area", room_type: "office", items: [
            { name: "Walls" }, { name: "Ceiling/ceiling tiles" }, { name: "Floor/carpet" },
            { name: "Windows/blinds" }, { name: "Light fittings" }, { name: "Air conditioning" },
            { name: "Power/data points" }, { name: "Fire extinguisher" }
          ]},
          { name: "Kitchen/Break Room", room_type: "kitchen", items: [
            { name: "Walls" }, { name: "Floor" }, { name: "Benchtops" },
            { name: "Sink/tapware" }, { name: "Appliances" }, { name: "Cupboards" }
          ]},
          { name: "Bathroom/Amenities", room_type: "bathroom", items: [
            { name: "Walls/tiles" }, { name: "Floor" }, { name: "Toilet" },
            { name: "Basin/tapware" }, { name: "Mirror" }, { name: "Exhaust fan" },
            { name: "Hand dryer/dispenser" }
          ]},
          { name: "Storage/Server Room", room_type: "storage", items: [
            { name: "Door/lock" }, { name: "Walls" }, { name: "Floor" },
            { name: "Shelving" }, { name: "Power points" }, { name: "Climate control" }
          ]},
          { name: "Car Park", room_type: "car_space", items: [
            { name: "Allocated spaces" }, { name: "Line markings" }, { name: "Lighting" },
            { name: "Signage" }
          ]},
          { name: "Exterior", room_type: "outdoor", items: [
            { name: "External walls" }, { name: "Signage" }, { name: "Landscaping" },
            { name: "Lighting" }, { name: "Accessibility" }
          ]}
        ]
      }
    ]

    defaults.each do |template_attrs|
      template = InspectionRoomTemplate.find_or_initialize_by(
        tenant_id: tenant_id,
        name: template_attrs[:name]
      )
      template.assign_attributes(template_attrs)
      template.tenant_id = tenant_id
      template.save!
    end
  end
end
