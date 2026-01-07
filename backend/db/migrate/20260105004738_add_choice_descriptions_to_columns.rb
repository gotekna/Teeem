class AddChoiceDescriptionsToColumns < ActiveRecord::Migration[8.0]
  def up
    add_column :columns, :choice_descriptions, :jsonb, default: {}

    # Populate NCC building class descriptions for dwelling_type column (SSoT)
    dwelling_column = Column.joins(:foundation)
                            .where(foundations: { slug: 'jobs' })
                            .where(column_name: 'dwelling_type')
                            .first

    if dwelling_column
      dwelling_column.update!(choice_descriptions: {
        "Class 1A" => "House (single dwelling)",
        "Class 1B" => "Boarding house (small)",
        "Class 2" => "Apartment building",
        "Class 3" => "Hotel, motel, backpackers",
        "Class 4" => "Dwelling in Class 5-9 building",
        "Class 5" => "Office building",
        "Class 6" => "Shop, retail, cafe",
        "Class 7A" => "Car park",
        "Class 7B" => "Warehouse, storage",
        "Class 8" => "Factory, laboratory",
        "Class 9A" => "Health care (hospital)",
        "Class 9B" => "Assembly (school, church)",
        "Class 9C" => "Aged care, residential care",
        "Class 10A" => "Garage, carport, shed",
        "Class 10B" => "Fence, retaining wall",
        "Class 10C" => "Swimming pool, spa"
      })
    end
  end

  def down
    remove_column :columns, :choice_descriptions
  end
end
