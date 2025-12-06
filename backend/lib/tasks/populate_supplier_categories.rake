namespace :suppliers do
  desc "Populate supplier categories from EasyBuild CSV data"
  task populate_categories: :environment do
    require "csv"

    csv_path = Rails.root.join("..", "easybuildapp development Price Books(in).csv")

    unless File.exist?(csv_path)
      puts "ERROR: CSV file not found at #{csv_path}"
      exit 1
    end

    puts "\n" + "=" * 80
    puts "Populating Supplier Categories from EasyBuild CSV"
    puts "=" * 80

    # Data structures for analysis
    supplier_categories = Hash.new { |h, k| h[k] = Hash.new(0) }
    supplier_totals = Hash.new(0)

    # Parse CSV
    puts "\n1. Analyzing CSV data..."
    CSV.foreach(csv_path, headers: true) do |row|
      supplier = row["default_supplier"]&.strip
      category = row["category"]&.strip

      next if supplier.nil? || supplier.empty? || category.nil? || category.empty?

      supplier_categories[supplier][category] += 1
      supplier_totals[supplier] += 1
    end

    puts "   Found #{supplier_totals.keys.size} unique suppliers"
    puts "   Found #{supplier_categories.values.flat_map(&:keys).uniq.size} unique categories"

    # Update suppliers
    puts "\n2. Updating suppliers in database..."

    updated_count = 0
    created_count = 0
    skipped_count = 0
    errors = []

    supplier_categories.each do |supplier_name, categories|
      begin
        # Find or create supplier
        supplier = Supplier.find_or_initialize_by(name: supplier_name)

        if supplier.new_record?
          supplier.original_name = supplier_name
          supplier.is_active = true
          supplier.is_verified = false
          created_count += 1
          puts "   Creating: #{supplier_name}"
        else
          updated_count += 1
          puts "   Updating: #{supplier_name}"
        end

        # Calculate primary category (most items)
        primary_category = categories.max_by { |_, count| count }
        total_items = supplier_totals[supplier_name]

        # Build categories array with percentages
        categories_data = categories.map do |category, count|
          {
            name: category,
            item_count: count,
            percentage: (count.to_f / total_items * 100).round(1),
            is_primary: category == primary_category[0]
          }
        end.sort_by { |c| -c[:item_count] }

        # Store as JSON in trade_categories field
        supplier.trade_categories = categories_data.to_json

        # Set is_default_for_trades to just the primary category
        supplier.is_default_for_trades = primary_category[0]

        supplier.save!

      rescue => e
        errors << { supplier: supplier_name, error: e.message }
        skipped_count += 1
        puts "   ERROR: #{supplier_name} - #{e.message}"
      end
    end

    puts "\n" + "=" * 80
    puts "Summary:"
    puts "  Created: #{created_count} suppliers"
    puts "  Updated: #{updated_count} suppliers"
    puts "  Skipped: #{skipped_count} suppliers (errors)"
    puts "  Total processed: #{created_count + updated_count}"
    puts "=" * 80

    if errors.any?
      puts "\nErrors:"
      errors.each do |err|
        puts "  - #{err[:supplier]}: #{err[:error]}"
      end
    end

    # Show some examples
    puts "\n" + "=" * 80
    puts "Examples of updated suppliers:"
    puts "=" * 80

    Supplier.where.not(trade_categories: nil).limit(10).each do |supplier|
      categories = JSON.parse(supplier.trade_categories)
      puts "\n#{supplier.name}"
      puts "  Primary: #{supplier.is_default_for_trades}"
      puts "  All categories:"
      categories.each do |cat|
        marker = cat["is_primary"] ? " (PRIMARY)" : ""
        puts "    - #{cat['name']}: #{cat['item_count']} items (#{cat['percentage']}%)#{marker}"
      end
    end

    puts "\n" + "=" * 80
    puts "Task completed successfully!"
    puts "=" * 80
  end

  desc "Show suppliers by category"
  task show_by_category: :environment do
    # Group suppliers by their primary category
    category_suppliers = {}

    Supplier.where.not(is_default_for_trades: nil).each do |supplier|
      category = supplier.is_default_for_trades
      category_suppliers[category] ||= []
      category_suppliers[category] << supplier
    end

    puts "\n" + "=" * 80
    puts "Suppliers by Primary Category"
    puts "=" * 80

    category_suppliers.sort.each do |category, suppliers|
      puts "\n#{category} (#{suppliers.size} suppliers):"
      suppliers.sort_by(&:name).each do |supplier|
        puts "  - #{supplier.name}"
      end
    end
  end

  desc "Show multi-category suppliers"
  task show_multi_category: :environment do
    puts "\n" + "=" * 80
    puts "Suppliers Working Across Multiple Categories"
    puts "=" * 80

    Supplier.where.not(trade_categories: nil).each do |supplier|
      categories = JSON.parse(supplier.trade_categories)
      next if categories.size < 2

      puts "\n#{supplier.name} (#{categories.size} categories):"
      categories.each do |cat|
        marker = cat["is_primary"] ? " ⭐ PRIMARY" : ""
        puts "  - #{cat['name']}: #{cat['item_count']} items (#{cat['percentage']}%)#{marker}"
      end
    end
  end

  desc "Export supplier-category mapping to JSON"
  task export_mapping: :environment do
    output = Supplier.where.not(trade_categories: nil).map do |supplier|
      {
        id: supplier.id,
        name: supplier.name,
        primary_category: supplier.is_default_for_trades,
        categories: JSON.parse(supplier.trade_categories),
        contact_person: supplier.contact_person,
        phone: supplier.phone,
        email: supplier.email,
        is_active: supplier.is_active
      }
    end

    output_path = Rails.root.join("..", "supplier_category_database_export.json")
    File.write(output_path, JSON.pretty_generate(output))

    puts "Exported #{output.size} suppliers to #{output_path}"
  end
end
