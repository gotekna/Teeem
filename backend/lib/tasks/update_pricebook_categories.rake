require "csv"

namespace :pricebook do
  desc "Update pricebook items with categories and suppliers from CSV"
  task update_categories: :environment do
    csv_path = Rails.root.join("pricebook_import.csv")

    unless File.exist?(csv_path)
      puts "❌ CSV file not found at: #{csv_path}"
      exit 1
    end

    puts "📊 Starting pricebook category and supplier update..."
    puts "📁 Reading CSV from: #{csv_path}"
    puts ""

    stats = {
      total: 0,
      updated: 0,
      not_found: 0,
      errors: 0,
      suppliers_created: 0,
      suppliers_linked: 0
    }

    supplier_cache = {}

    CSV.foreach(csv_path, headers: true, encoding: "UTF-8") do |row|
      stats[:total] += 1

      code = row["code"]&.strip
      category = row["category"]&.strip
      supplier_name = row["default_supplier"]&.strip

      next if code.blank?

      # Find the pricebook item by code
      item = PricebookItem.find_by(item_code: code)

      if item.nil?
        stats[:not_found] += 1
        puts "⚠️  Item not found: #{code}" if stats[:not_found] <= 10
        next
      end

      begin
        changes_made = false

        # Update category if present
        if category.present? && item.category != category
          item.category = category
          changes_made = true
        end

        # Update supplier if present
        if supplier_name.present?
          # Use cached supplier or find/create it
          supplier = supplier_cache[supplier_name]

          if supplier.nil?
            supplier = Supplier.find_by(name: supplier_name)

            if supplier.nil?
              # Create new supplier
              supplier = Supplier.create!(
                name: supplier_name,
                is_active: true
              )
              stats[:suppliers_created] += 1
              puts "✨ Created supplier: #{supplier_name}"
            end

            supplier_cache[supplier_name] = supplier
          end

          # Update supplier_id if different
          if item.supplier_id != supplier.id
            item.supplier_id = supplier.id
            stats[:suppliers_linked] += 1
            changes_made = true
          end
        end

        # Save if any changes were made
        if changes_made
          item.save!
          stats[:updated] += 1

          # Progress indicator every 100 items
          if stats[:updated] % 100 == 0
            puts "✅ Updated #{stats[:updated]} items..."
          end
        end

      rescue => e
        stats[:errors] += 1
        puts "❌ Error updating #{code}: #{e.message}"
      end
    end

    puts ""
    puts "=" * 60
    puts "📈 Update Complete!"
    puts "=" * 60
    puts "Total rows processed:     #{stats[:total]}"
    puts "Items updated:            #{stats[:updated]}"
    puts "Items not found:          #{stats[:not_found]}"
    puts "Suppliers created:        #{stats[:suppliers_created]}"
    puts "Supplier links updated:   #{stats[:suppliers_linked]}"
    puts "Errors:                   #{stats[:errors]}"
    puts ""

    # Show category breakdown
    categories = PricebookItem.where.not(category: nil).group(:category).count
    puts "📊 Categories in database: #{categories.keys.count}"
    puts ""

    if stats[:errors] > 0
      puts "⚠️  There were #{stats[:errors]} errors. Check the output above for details."
    else
      puts "✅ All items processed successfully!"
    end
  end
end
