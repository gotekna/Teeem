namespace :pricebook do
  desc "One-time task: Import categories from hardcoded CSV data"
  task import_categories_production: :environment do
    require "csv"
    require "open-uri"

    puts "\n" + "="*60
    puts "IMPORTING CATEGORIES TO PRODUCTION"
    puts "="*60

    # Check if we can access a URL or need to use hardcoded data
    csv_url = ENV["CSV_URL"]

    if csv_url.present?
      puts "\n📥 Downloading CSV from: #{csv_url}"
      begin
        csv_content = URI.open(csv_url).read
        puts "✅ Downloaded #{csv_content.size} bytes"
      rescue => e
        puts "❌ Error downloading CSV: #{e.message}"
        puts "Please run with CSV_URL= environment variable pointing to your CSV file"
        exit 1
      end
    else
      puts "⚠️  No CSV_URL provided"
      puts "Run this task with:"
      puts "  CSV_URL=<your-csv-url> heroku run bin/rails pricebook:import_categories_production"
      exit 1
    end

    # Statistics
    stats = {
      updated: 0,
      skipped: 0,
      errors: 0,
      categories_added: 0,
      categories: Set.new
    }

    # Process CSV
    puts "\nProcessing CSV rows..."

    CSV.parse(csv_content, headers: true) do |row|
      begin
        item_code = row["code"]&.strip
        category = row["category"]&.strip

        # Skip if no item code
        next if item_code.blank?

        # Find the item
        item = PricebookItem.find_by(item_code: item_code)

        unless item
          stats[:skipped] += 1
          next
        end

        # Update category if it's different
        if category.present? && item.category != category
          item.update_column(:category, category)
          stats[:updated] += 1
          stats[:categories_added] += 1 if item.category.nil?
          stats[:categories] << category
        elsif category.blank?
          stats[:skipped] += 1
        else
          stats[:skipped] += 1
        end

      rescue => e
        stats[:errors] += 1
        puts "  ❌ Error processing #{item_code}: #{e.message}"
      end
    end

    # Print summary
    puts "\n" + "="*60
    puts "CATEGORY IMPORT COMPLETE"
    puts "="*60
    puts "\n📊 Statistics:"
    puts "  🔄 Updated: #{stats[:updated]} items"
    puts "  ⏭️  Skipped: #{stats[:skipped]} items"
    puts "  ❌ Errors: #{stats[:errors]} items"
    puts "  ➕ Categories added to previously blank items: #{stats[:categories_added]}"

    puts "\n📋 Categories imported (#{stats[:categories].size} unique):"
    stats[:categories].to_a.sort.each do |cat|
      count = PricebookItem.where(category: cat).count
      puts "  • #{cat} (#{count} items)"
    end

    puts "\n📈 Final counts:"
    puts "  Total items: #{PricebookItem.count}"
    puts "  Items with categories: #{PricebookItem.where.not(category: nil).count}"
    puts "  Items without categories: #{PricebookItem.where(category: nil).count}"

    puts "\n✅ Import completed successfully!"
    puts "="*60 + "\n"
  end
end
