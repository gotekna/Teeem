# frozen_string_literal: true

# One-time task: Assign default_supplier_id to pricebook items that are missing one.
# Uses pricebook.csv from the original import to match supplier names to Contact records.
# Run on production via: heroku run rails pricebook:assign_default_suppliers -a teeem-staging
# Or dry-run first:      heroku run rails pricebook:assign_default_suppliers[dry_run] -a teeem-staging

namespace :pricebook do
  desc "Assign default suppliers to pricebook items missing one (from CSV data)"
  task :assign_default_suppliers, [:mode] => :environment do |_t, args|
    dry_run = args[:mode] == "dry_run"
    puts dry_run ? "=== DRY RUN ===" : "=== LIVE RUN ==="

    # CSV supplier name -> Contact ID mapping
    # Built from fuzzy matching CSV names to existing Contact.display_name values
    SUPPLIER_MAP = {
      "Fletchers Transport Pty Ltd" => 2649,
      "NATIONAL TILES CO PTY LTD" => 1496,
      "Tekna Admin" => 3795,                              # Tekna Admin Pty Ltd
      "PLUMBER" => 1775,
      "Hafele" => 3869,
      "Civic Shower Screens & Wardrobes" => 3870,
      "Pre Hung Doors (PHD)" => 3751,                     # Pre Hung Doors
      "ReadyMix Concrete (Was Excel Concrete Pty Ltd)" => 1351, # Excel Concrete
      "Bunnings" => 1581,                                 # Bunnings Group Limited
      "JND Concrete" => 3865,
      "TWS TRADE" => 4294,                                # TWS Trade
      "Unique Windows Services" => 3616,                  # Unique Window Services
      "Harvey Norman Commercial QLD" => 1552,             # Harvey Norman Commercial
      "Harvey's Mechanical & Welding Services Pty Ltd" => 1537,
      "Tekna Finishing Touches" => 3661,                  # Tekna Homes (internal)
      "Tekna Kitchen Labour" => 3661,                     # Tekna Homes (internal)
      "Tekna Carpentry" => 3661,                          # Tekna Homes (internal)
      "AW GEOTECHNICS" => 2302,                           # AW Geotechnics Pty Ltd
      "Envirotech Treatment Systems" => 1649,
      "Tekna Sales" => 3661,                              # Tekna Homes (internal)
      "TL Electrical" => 2289,                            # TL Electrical Pty Ltd
      "Open Electrical" => 4286,
      "Tekna Kitchen Material" => 3661,                   # Tekna Homes (internal)
      "Spot On Plumbing and Drainage" => 1660,
      "AusCoast Fire" => 3868,                            # Auscoast Fire
      "Trade Tilers Centre" => 1654,                      # Trade Tilers Centre Pty Ltd
      "Wayke Waterproofing. Ware" => 3867,                # Wayke Waterproofing
      "Keeler Hardware" => 3872,
      "GMA Certification Group" => 1582,                  # GMA Certification Pty Ltd
      "CBMA" => 1475,                                     # Compliant Building Materials Australasia
      "Access Allways Consultants" => 1509,               # Accounts Team - Access All Ways Consultants
      "Star Airconditioning" => 1563,
      "Survey Mark" => 2252,                              # Survey Mark Pty Ltd
      "Accelerate Sustainability Assessments" => 2301,    # Accelerate Sustainability Assessments Pty Ltd
      "Austral - Rochedale" => 3873,                      # Austral Bricks
      "La Rocca QLD Marble and Granite Pty Ltd" => 1556,  # Accounts Team - La Rocca Marble
      "Lovering Installations QLD" => 1806,               # Lovering Installations
      "Gold Coast Gappng" => 4282,
      "Tekna Site" => 3661,                               # Tekna Homes (internal)
      "A1 Builders Finals Services Group" => nil,         # No match found - skip
      "Tekna Franchise" => 3661,                          # Tekna Homes (internal)
      "Tekna Homes" => 3661,
      "Tekna Insurance" => 3661,                          # Tekna Homes (internal)
      "Tekna Coach" => 3661,                              # Tekna Homes (internal)
      "Tekna Marketing" => 3661,                          # Tekna Homes (internal)
      "Tekna Supervisor" => 3661,                         # Tekna Homes (internal)
    }.freeze

    # Load CSV
    require "csv"
    csv_path = Rails.root.join("tmp", "pricebook.csv")
    unless File.exist?(csv_path)
      # Try Downloads folder (local dev)
      alt_path = File.expand_path("~/Downloads/pricebook.csv")
      if File.exist?(alt_path)
        csv_path = alt_path
      else
        puts "ERROR: pricebook.csv not found at #{csv_path} or #{alt_path}"
        puts "Copy the CSV to backend/tmp/pricebook.csv first."
        next
      end
    end

    csv_data = {}
    CSV.foreach(csv_path, headers: true, encoding: "bom|utf-8:utf-8", liberal_parsing: true) do |row|
      code = row["code"].to_s.strip
      next if code.empty?
      csv_data[code] = {
        supplier: row["default_supplier"].to_s.strip,
        price: row["price"].to_s.gsub(/[$,\s]/, "")
      }
    end
    puts "Loaded #{csv_data.size} rows from CSV"

    # Get items missing default_supplier_id using raw SQL (bypasses acts_as_tenant)
    missing_items = ActiveRecord::Base.connection.execute(
      "SELECT id, item_code FROM pricebooks WHERE default_supplier_id IS NULL AND is_active = true ORDER BY id"
    ).to_a
    puts "Items missing default supplier: #{missing_items.size}"

    updated = 0
    skipped_no_csv = 0
    skipped_no_supplier_in_csv = 0
    skipped_no_contact_match = 0
    skipped_nil_mapping = 0
    errors = []

    missing_items.each do |row|
      item_id = row["id"]
      item_code = row["item_code"]
      csv_row = csv_data[item_code]

      unless csv_row
        skipped_no_csv += 1
        next
      end

      supplier_name = csv_row[:supplier]
      if supplier_name.empty?
        skipped_no_supplier_in_csv += 1
        next
      end

      contact_id = SUPPLIER_MAP[supplier_name]
      if contact_id.nil?
        # Check if key exists (explicit nil = known no match) vs not in map
        if SUPPLIER_MAP.key?(supplier_name)
          skipped_nil_mapping += 1
        else
          skipped_no_contact_match += 1
          puts "  UNMAPPED: #{item_code} - supplier '#{supplier_name}' not in SUPPLIER_MAP"
        end
        next
      end

      # Parse price from CSV
      price = csv_row[:price].to_f if csv_row[:price].present? && csv_row[:price] != ""

      if dry_run
        puts "  WOULD UPDATE: item #{item_id} (#{item_code}) -> supplier #{contact_id}, price #{price || 'unchanged'}"
      else
        # Update using raw SQL to bypass acts_as_tenant
        if price && price > 0
          ActiveRecord::Base.connection.execute(
            "UPDATE pricebooks SET default_supplier_id = #{contact_id.to_i}, current_price = #{price.to_f} WHERE id = #{item_id.to_i}"
          )
        else
          ActiveRecord::Base.connection.execute(
            "UPDATE pricebooks SET default_supplier_id = #{contact_id.to_i} WHERE id = #{item_id.to_i}"
          )
        end
      end
      updated += 1
    rescue => e
      errors << "Item #{item_id} (#{item_code}): #{e.message}"
    end

    puts ""
    puts "=== Results ==="
    puts "#{dry_run ? 'Would update' : 'Updated'}: #{updated}"
    puts "Skipped (not in CSV): #{skipped_no_csv}"
    puts "Skipped (no supplier in CSV): #{skipped_no_supplier_in_csv}"
    puts "Skipped (no Contact match): #{skipped_no_contact_match}"
    puts "Skipped (known no match): #{skipped_nil_mapping}"
    puts "Errors: #{errors.size}"
    errors.each { |e| puts "  ERROR: #{e}" }

    # Show remaining
    remaining = ActiveRecord::Base.connection.execute(
      "SELECT COUNT(*) as cnt FROM pricebooks WHERE default_supplier_id IS NULL AND is_active = true"
    ).first["cnt"]
    puts ""
    puts "Remaining items without default supplier: #{remaining}"
  end
end
