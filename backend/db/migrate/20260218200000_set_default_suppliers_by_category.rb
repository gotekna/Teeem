class SetDefaultSuppliersByCategory < ActiveRecord::Migration[8.0]
  # Maps pricebook item categories to their default supplier contact IDs.
  # Using raw SQL to bypass acts_as_tenant scoping (affects ALL tenants correctly).
  #
  # Suppliers confirmed:
  #   Harvey Norman Commercial (ID=1552) - currently default for 211 plumbing items
  #   National Tiles Co Pty Ltd (ID=1496)
  #   Sunnycoast Concreting (ID=4264)
  #   Pre Hung Doors (ID=3751)
  #   Spot On Plumbing and Drainage (ID=1660)
  #   Bunnings Group Limited (ID=1581)
  #   Tekna Admin Pty Ltd (ID=3795)
  #   Joshua Braiden Carpentry & Construction Pty Ltd (ID=3667)
  #   Accounts Team - Wayke Waterproofing (ID=1549) - has price history
  #   Star Airconditioning (ID=1563)
  #   Accounts Team - Austral Bricks (ID=1576) - has price history
  #   Pre Hung Doors (ID=3751) - already used for INTERNAL DOORS
  CATEGORY_SUPPLIER_MAP = {
    "PLUMBING FITOFF GEAR" => 1552, # Harvey Norman Commercial
    "TILE"                 => 1496, # National Tiles Co Pty Ltd
    "DRIVEWAY"             => 4264, # Sunnycoast Concreting
    "INTERNAL DOORS"       => 3751, # Pre Hung Doors
    "PLUMBER"              => 1660, # Spot On Plumbing and Drainage
    "SOFFIT"               => 1581, # Bunnings Group Limited
    "CABINET MAKER"        => 3795, # Tekna Admin Pty Ltd
    "CARPENTER"            => 3667, # Joshua Braiden Carpentry & Construction Pty Ltd
    "WET SEAL"             => 1549, # Accounts Team - Wayke Waterproofing
    "AIR CONDITIONING"     => 1563, # Star Airconditioning
    "BRICKS"               => 1576, # Accounts Team - Austral Bricks
    "DOOR FURNITURE"       => 3751, # Pre Hung Doors
  }.freeze

  def up
    CATEGORY_SUPPLIER_MAP.each do |category, supplier_id|
      result = execute <<~SQL
        UPDATE pricebooks
        SET default_supplier_id = #{supplier_id}
        WHERE default_supplier_id IS NULL
          AND is_active = true
          AND category = '#{category.gsub("'", "''")}'
      SQL
      puts "  Set #{category} -> supplier #{supplier_id} (#{result.cmd_tuples} rows)"
    end
  end

  def down
    CATEGORY_SUPPLIER_MAP.each do |category, supplier_id|
      execute <<~SQL
        UPDATE pricebooks
        SET default_supplier_id = NULL
        WHERE default_supplier_id = #{supplier_id}
          AND category = '#{category.gsub("'", "''")}'
      SQL
    end
  end
end
