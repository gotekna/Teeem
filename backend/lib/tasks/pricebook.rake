namespace :pricebook do
  desc "Import clean price book data from CSV files"
  task import_clean: :environment do
    puts "\n" + "="*60
    puts "PRICE BOOK CLEAN IMPORT"
    puts "="*60

    # Step 1: Clear existing data
    puts "\nStep 1: Clearing existing data..."

    deleted_histories = PriceHistory.count
    PriceHistory.delete_all
    puts "  ✓ Deleted #{deleted_histories} price history records"

    deleted_items = PricebookItem.count
    PricebookItem.delete_all
    puts "  ✓ Deleted #{deleted_items} pricebook items"

    deleted_suppliers = Supplier.count
    Supplier.delete_all
    puts "  ✓ Deleted #{deleted_suppliers} suppliers"

    # Step 2: Import Suppliers
    puts "\nStep 2: Importing suppliers..."
    suppliers_file = ENV["SUPPLIERS_CSV"] || Rails.root.join("tmp", "suppliers.csv")

    unless File.exist?(suppliers_file)
      puts "  ⚠ Suppliers file not found at: #{suppliers_file}"
      puts "  Set SUPPLIERS_CSV environment variable or place file at tmp/suppliers.csv"
      next
    end

    supplier_map = {}
    supplier_count = 0

    CSV.foreach(suppliers_file, headers: true, header_converters: :symbol) do |row|
      supplier = Supplier.create!(
        name: row[:name],
        contact_person: row[:contact_person],
        email: row[:email],
        phone: row[:phone],
        address: row[:address],
        rating: row[:rating]&.to_i || 0,
        response_rate: row[:response_rate]&.to_f || 0,
        avg_response_time: row[:avg_response_time]&.to_i,
        notes: row[:notes],
        is_active: row[:is_active] == "false" ? false : true
      )

      # Map supplier name to ID for linking
      supplier_map[row[:name]] = supplier.id
      supplier_count += 1
    end

    puts "  ✓ Imported #{supplier_count} suppliers"

    # Step 3: Import Price Book Items
    puts "\nStep 3: Importing price book items..."
    items_file = ENV["ITEMS_CSV"] || Rails.root.join("tmp", "pricebook_items.csv")

    unless File.exist?(items_file)
      puts "  ⚠ Items file not found at: #{items_file}"
      puts "  Set ITEMS_CSV environment variable or place file at tmp/pricebook_items.csv"
      next
    end

    item_map = {}
    item_count = 0

    CSV.foreach(items_file, headers: true, header_converters: :symbol) do |row|
      # Find supplier by name
      supplier_id = row[:supplier_name].present? ? supplier_map[row[:supplier_name]] : nil

      # Parse price, handling empty strings
      current_price = row[:current_price].present? && !row[:current_price].strip.empty? ? row[:current_price].to_f : nil

      item = PricebookItem.create!(
        item_code: row[:item_code],
        item_name: row[:item_name],
        category: row[:category].present? && !row[:category].strip.empty? ? row[:category] : nil,
        unit_of_measure: row[:unit_of_measure].present? ? row[:unit_of_measure] : "Each",
        current_price: current_price,
        supplier_id: supplier_id,
        brand: row[:brand].present? && !row[:brand].strip.empty? ? row[:brand] : nil,
        notes: row[:notes].present? && !row[:notes].strip.empty? ? row[:notes] : nil,
        is_active: row[:is_active] == "false" ? false : true,
        needs_pricing_review: row[:needs_pricing_review] == "true" ? true : false,
        price_last_updated_at: row[:price_last_updated_at].present? ? Time.parse(row[:price_last_updated_at]) : nil
      )

      # Map item code to ID for linking price history
      item_map[row[:item_code]] = item.id
      item_count += 1
    end

    puts "  ✓ Imported #{item_count} price book items"

    # Step 4: Import Price History
    puts "\nStep 4: Importing price history..."
    history_file = ENV["HISTORY_CSV"] || Rails.root.join("tmp", "price_history.csv")

    unless File.exist?(history_file)
      puts "  ⚠ Price history file not found at: #{history_file}"
      puts "  Skipping price history import (optional)"
      puts "\n" + "="*60
      puts "IMPORT COMPLETE"
      puts "="*60
      puts "Suppliers: #{Supplier.count}"
      puts "Price Book Items: #{PricebookItem.count}"
      puts "Price History: #{PriceHistory.count}"
      next
    end

    history_count = 0

    CSV.foreach(history_file, headers: true, header_converters: :symbol) do |row|
      item_id = item_map[row[:item_code]]
      supplier_id = row[:supplier_name].present? ? supplier_map[row[:supplier_name]] : nil

      unless item_id
        puts "  ⚠ Skipping history for unknown item: #{row[:item_code]}"
        next
      end

      PriceHistory.create!(
        pricebook_item_id: item_id,
        old_price: row[:old_price]&.to_f,
        new_price: row[:new_price]&.to_f,
        change_reason: row[:change_reason] || "import",
        supplier_id: supplier_id,
        quote_reference: row[:quote_reference],
        created_at: row[:created_at].present? ? Time.parse(row[:created_at]) : Time.current
      )

      history_count += 1
    end

    puts "  ✓ Imported #{history_count} price history records"

    # Summary
    puts "\n" + "="*60
    puts "IMPORT COMPLETE"
    puts "="*60
    puts "Suppliers: #{Supplier.count}"
    puts "Price Book Items: #{PricebookItem.count}"
    puts "Price History: #{PriceHistory.count}"
    puts "\nData successfully imported and linked!"
  end

  desc "Import EasyBuild CSV with categories"
  task import_easybuild: :environment do
    require "csv"

    puts "\n" + "="*60
    puts "EASYBUILD PRICE BOOK IMPORT WITH CATEGORIES"
    puts "="*60

    # Path to the CSV file
    csv_file = ENV["CSV_FILE"] || Rails.root.join("..", "easybuildapp development Price Books(in).csv")

    unless File.exist?(csv_file)
      puts "\n❌ ERROR: CSV file not found at: #{csv_file}"
      puts "Set CSV_FILE environment variable to specify a different path"
      exit 1
    end

    puts "\n📁 Importing from: #{csv_file}"
    puts "\n" + "-"*60

    # Statistics
    stats = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      categories: Set.new,
      suppliers_created: Set.new,
      price_changes: 0
    }

    # Process CSV
    puts "\nProcessing CSV rows..."

    CSV.foreach(csv_file, headers: true) do |row|
      begin
        # Skip if no item code
        item_code = row["code"]&.strip
        if item_code.blank?
          stats[:skipped] += 1
          next
        end

        # Map CSV columns to model fields
        item_name = row["description"]&.strip
        unit_of_measure = row["unit"]&.strip || "Each"
        price = row["price"]&.strip
        current_price = price.present? && !price.empty? ? price.to_f : nil
        supplier_name = row["default_supplier"]&.strip
        category = row["category"]&.strip
        status = row["status"]&.strip
        is_active = status == "Active"

        # Track category if present
        stats[:categories] << category if category.present?

        # Find or create supplier if specified
        supplier = nil
        default_supplier = nil
        if supplier_name.present?
          supplier = Supplier.find_or_create_by(name: supplier_name) do |s|
            s.is_active = true
            stats[:suppliers_created] << supplier_name
          end
          default_supplier = supplier
        end

        # Find or initialize the pricebook item
        item = PricebookItem.find_or_initialize_by(item_code: item_code)

        # Check if this is an update with price change
        is_new = item.new_record?
        old_price = item.current_price
        price_changed = !is_new && old_price != current_price && current_price.present?

        # Update attributes
        item.assign_attributes(
          item_name: item_name,
          unit_of_measure: unit_of_measure,
          current_price: current_price,
          supplier_id: supplier&.id,
          default_supplier_id: default_supplier&.id,
          category: category,
          is_active: is_active
        )

        # Set price_last_updated_at if price is present and it's a new record
        if is_new && current_price.present?
          item.price_last_updated_at = Time.current
        end

        # Save the item
        if item.save
          if is_new
            stats[:created] += 1
          else
            stats[:updated] += 1

            # Track price change
            if price_changed
              stats[:price_changes] += 1
              puts "  💰 Price changed for #{item_code}: $#{old_price} → $#{current_price}"
            end
          end
        else
          stats[:errors] += 1
          puts "  ❌ Error saving #{item_code}: #{item.errors.full_messages.join(', ')}"
        end

      rescue => e
        stats[:errors] += 1
        puts "  ❌ Error processing row #{item_code || 'unknown'}: #{e.message}"
      end
    end

    # Print summary
    puts "\n" + "="*60
    puts "IMPORT COMPLETE"
    puts "="*60
    puts "\n📊 Statistics:"
    puts "  ✅ Created: #{stats[:created]} items"
    puts "  🔄 Updated: #{stats[:updated]} items"
    puts "  ⏭️  Skipped: #{stats[:skipped]} items (no item code)"
    puts "  ❌ Errors: #{stats[:errors]} items"
    puts "  💰 Price changes tracked: #{stats[:price_changes]}"

    if stats[:suppliers_created].any?
      puts "\n👥 New suppliers created: #{stats[:suppliers_created].size}"
      stats[:suppliers_created].each do |name|
        puts "  • #{name}"
      end
    end

    puts "\n📋 Categories found (#{stats[:categories].size} unique):"
    stats[:categories].to_a.sort.each do |cat|
      count = PricebookItem.where(category: cat).count
      puts "  • #{cat} (#{count} items)"
    end

    puts "\n📈 Final counts:"
    puts "  Total pricebook items: #{PricebookItem.count}"
    puts "  Active items: #{PricebookItem.active.count}"
    puts "  Items with prices: #{PricebookItem.where.not(current_price: nil).count}"
    puts "  Items needing pricing: #{PricebookItem.needs_pricing.count}"
    puts "  Total suppliers: #{Supplier.count}"

    puts "\n✅ Import completed successfully!"
    puts "="*60 + "\n"
  end

  desc "Generate sample CSV templates"
  task generate_templates: :environment do
    puts "Generating CSV templates..."

    # Suppliers template
    CSV.open(Rails.root.join("tmp", "suppliers_template.csv"), "w") do |csv|
      csv << %w[name contact_person email phone address rating response_rate avg_response_time notes is_active]
      csv << [ "TL Supply", "John Smith", "john@tlsupply.com.au", "1300 123 456", "123 Trade St", 4, 85.5, 24, "Reliable supplier", true ]
    end
    puts "  ✓ Created tmp/suppliers_template.csv"

    # Price book items template
    CSV.open(Rails.root.join("tmp", "pricebook_items_template.csv"), "w") do |csv|
      csv << %w[item_code item_name category unit_of_measure current_price supplier_name brand notes is_active needs_pricing_review price_last_updated_at]
      csv << [ "DPP", "Wiring Double Power Point", "Electrical", "Each", 51.00, "TL Supply", "Clipsal", "", true, false, "2024-01-15" ]
    end
    puts "  ✓ Created tmp/pricebook_items_template.csv"

    # Price history template
    CSV.open(Rails.root.join("tmp", "price_history_template.csv"), "w") do |csv|
      csv << %w[item_code old_price new_price change_reason supplier_name quote_reference created_at]
      csv << [ "DPP", 48.00, 51.00, "price_increase", "TL Supply", "Q-2024-001", "2024-01-15" ]
    end
    puts "  ✓ Created tmp/price_history_template.csv"

    puts "\nTemplates created in tmp/ directory"
  end
end
