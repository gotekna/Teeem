namespace :pricebook do
  desc "Deploy price book data to production (uses db/import_data CSV files)"
  task deploy_to_production: :environment do
    puts "\n" + "="*60
    puts "DEPLOYING PRICE BOOK DATA TO PRODUCTION"
    puts "="*60

    # Use CSV files from db/import_data
    suppliers_file = Rails.root.join("db", "import_data", "suppliers.csv")
    items_file = Rails.root.join("db", "import_data", "pricebook_items.csv")
    history_file = Rails.root.join("db", "import_data", "price_history.csv")

    unless File.exist?(suppliers_file)
      puts "Error: Suppliers file not found at #{suppliers_file}"
      next
    end

    unless File.exist?(items_file)
      puts "Error: Items file not found at #{items_file}"
      next
    end

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

    unless File.exist?(history_file)
      puts "  ⚠ Price history file not found, skipping"
      puts "\n" + "="*60
      puts "DEPLOYMENT COMPLETE"
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
        next  # Skip if item doesn't exist
      end

      PriceHistory.create!(
        pricebook_item_id: item_id,
        old_price: row[:old_price].present? && !row[:old_price].strip.empty? ? row[:old_price].to_f : nil,
        new_price: row[:new_price].present? && !row[:new_price].strip.empty? ? row[:new_price].to_f : nil,
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
    puts "DEPLOYMENT COMPLETE"
    puts "="*60
    puts "Suppliers: #{Supplier.count}"
    puts "Price Book Items: #{PricebookItem.count}"
    puts "Price History: #{PriceHistory.count}"
    puts "\nData successfully deployed to production!"
  end
end
