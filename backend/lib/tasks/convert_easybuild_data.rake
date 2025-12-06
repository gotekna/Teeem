require "csv"

namespace :pricebook do
  desc "Convert EasyBuild CSV exports to import format"
  task convert_easybuild: :environment do
    puts "\n" + "="*60
    puts "CONVERTING EASYBUILD DATA"
    puts "="*60

    # Input files (from EasyBuild export)
    pricebooks_file = Rails.root.join("..", "easybuildapp development Price Books.csv")
    histories_file = Rails.root.join("..", "easybuildapp development Price Histories.csv")

    unless File.exist?(pricebooks_file)
      puts "Error: Price Books file not found at #{pricebooks_file}"
      next
    end

    unless File.exist?(histories_file)
      puts "Error: Price Histories file not found at #{histories_file}"
      next
    end

    # Output files
    suppliers_output = Rails.root.join("tmp", "suppliers.csv")
    items_output = Rails.root.join("tmp", "pricebook_items.csv")
    history_output = Rails.root.join("tmp", "price_history.csv")

    # Step 1: Extract suppliers from both files
    puts "\nStep 1: Extracting unique suppliers..."
    suppliers = {}

    # From Price Books
    CSV.foreach(pricebooks_file, headers: true) do |row|
      supplier_name = row["default_supplier"]&.strip
      next if supplier_name.nil? || supplier_name.empty?

      suppliers[supplier_name] ||= {
        name: supplier_name,
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        rating: 3,
        response_rate: 75.0,
        avg_response_time: 24,
        notes: "Imported from EasyBuild",
        is_active: true
      }
    end

    # From Price Histories
    CSV.foreach(histories_file, headers: true) do |row|
      supplier_name = row["supplier_trade"]&.strip
      next if supplier_name.nil? || supplier_name.empty?

      suppliers[supplier_name] ||= {
        name: supplier_name,
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        rating: 3,
        response_rate: 75.0,
        avg_response_time: 24,
        notes: "Imported from EasyBuild",
        is_active: true
      }
    end

    puts "  Found #{suppliers.count} unique suppliers"

    # Write suppliers CSV
    CSV.open(suppliers_output, "w") do |csv|
      csv << %w[name contact_person email phone address rating response_rate avg_response_time notes is_active]
      suppliers.each do |name, data|
        csv << [
          data[:name],
          data[:contact_person],
          data[:email],
          data[:phone],
          data[:address],
          data[:rating],
          data[:response_rate],
          data[:avg_response_time],
          data[:notes],
          data[:is_active]
        ]
      end
    end
    puts "  ✓ Created #{suppliers_output}"

    # Step 2: Convert Price Books
    puts "\nStep 2: Converting price book items..."
    items_count = 0
    item_codes = Set.new

    CSV.open(items_output, "w") do |csv|
      csv << %w[item_code item_name category unit_of_measure current_price supplier_name brand notes is_active needs_pricing_review price_last_updated_at]

      CSV.foreach(pricebooks_file, headers: true) do |row|
        item_code = row["code"]&.strip
        next if item_code.nil? || item_code.empty?

        # Skip duplicates
        next if item_codes.include?(item_code)
        item_codes.add(item_code)

        price_str = row["price"]&.strip
        price = price_str.present? && !price_str.empty? ? price_str.to_f : nil

        supplier_name = row["default_supplier"]&.strip

        csv << [
          item_code,                              # item_code
          row["description"]&.strip,              # item_name
          "",                                      # category (empty, could be derived from budget_zone)
          row["unit"]&.strip || "Each",           # unit_of_measure
          price,                                   # current_price
          supplier_name,                           # supplier_name
          "",                                      # brand
          "",                                      # notes
          true,                                    # is_active
          price.nil? || price.zero?,              # needs_pricing_review
          price.present? ? Time.current : nil     # price_last_updated_at
        ]
        items_count += 1
      end
    end
    puts "  ✓ Created #{items_output} with #{items_count} items"

    # Step 3: Convert Price Histories
    puts "\nStep 3: Converting price histories..."
    histories_count = 0

    # Group price histories by item code and sort by date to get chronological changes
    item_price_history = {}

    CSV.foreach(histories_file, headers: true) do |row|
      item_code = row["pricebook"]&.strip
      next if item_code.nil? || item_code.empty?

      # Skip if item doesn't exist in our items list
      next unless item_codes.include?(item_code)

      # Parse price (format: " $67.00 ") - field may have leading space
      price_str = (row[" price "] || row["price"])&.strip
      next if price_str.nil? || price_str.empty?

      price = price_str.gsub(/[$,\s]/, "").to_f

      # Parse date (format: "2/09/2023" or "30/12/2024")
      date_str = row["effective_date"]&.strip
      begin
        created_at = Date.strptime(date_str, "%d/%m/%Y")
      rescue
        created_at = Time.current
      end

      supplier_name = row["supplier_trade"]&.strip

      item_price_history[item_code] ||= []
      item_price_history[item_code] << {
        price: price,
        date: created_at,
        supplier: supplier_name
      }
    end

    CSV.open(history_output, "w") do |csv|
      csv << %w[item_code old_price new_price change_reason supplier_name quote_reference created_at]

      # For each item, sort price history by date and create change records
      item_price_history.each do |item_code, histories|
        # Sort by date
        sorted_histories = histories.sort_by { |h| h[:date] }

        # Create price change records
        sorted_histories.each_with_index do |history, index|
          old_price = index > 0 ? sorted_histories[index - 1][:price] : nil

          csv << [
            item_code,                      # item_code
            old_price,                      # old_price
            history[:price],                # new_price
            "supplier_quote",               # change_reason
            history[:supplier],             # supplier_name
            "",                             # quote_reference
            history[:date].to_s             # created_at
          ]
          histories_count += 1
        end
      end
    end
    puts "  ✓ Created #{history_output} with #{histories_count} history records"

    puts "\n" + "="*60
    puts "CONVERSION COMPLETE"
    puts "="*60
    puts "Suppliers: #{suppliers.count}"
    puts "Price Book Items: #{items_count}"
    puts "Price Histories: #{histories_count}"
    puts "\nFiles created in backend/tmp/:"
    puts "  - suppliers.csv"
    puts "  - pricebook_items.csv"
    puts "  - price_history.csv"
    puts "\nRun 'bundle exec rails pricebook:import_clean' to import"
  end
end
