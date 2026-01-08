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

  desc "Sync pricebook photos from SharePoint to pricebook items"
  task sync_photos: :environment do
    require_relative "../../app/services/pricebook_photo_sync_service"

    dry_run = ENV["DRY_RUN"] != "false"

    puts "\n" + "="*80
    puts "PRICEBOOK PHOTO SYNC FROM SHAREPOINT"
    puts "="*80
    puts "Mode: #{dry_run ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE (will update database)'}"
    puts "="*80 + "\n"

    begin
      service = PricebookPhotoSyncService.new
      stats = service.sync_photos(dry_run: dry_run)

      # Display detailed results
      puts "\n" + "="*80
      puts "SYNC RESULTS"
      puts "="*80

      puts "\n📊 Overall Statistics:"
      puts "  Total photos found: #{stats[:total_photos]}"
      puts "  ✅ Matched: #{stats[:matched]} (#{(stats[:matched].to_f / stats[:total_photos] * 100).round(1)}%)"
      puts "  ❌ Unmatched: #{stats[:unmatched]}"
      puts "  ❗ Errors: #{stats[:errors]}"
      puts "  🔄 Items updated: #{stats[:updated]}" unless dry_run

      # Show match breakdown by strategy
      if stats[:matches].any?
        puts "\n🎯 Match Strategies:"
        strategies = stats[:matches].group_by { |m| m[:match_strategy] }
        strategies.each do |strategy, matches|
          puts "  #{strategy}: #{matches.size}"
        end

        # Show confidence breakdown
        puts "\n🎲 Confidence Levels:"
        confidences = stats[:matches].group_by { |m| m[:confidence] }
        confidences.each do |confidence, matches|
          puts "  #{confidence}: #{matches.size}"
        end

        # Show sample matches
        puts "\n📝 Sample Matches (first 10):"
        stats[:matches].first(10).each do |match|
          puts "  #{match[:photo][:name]}"
          puts "    → #{match[:item].item_code}: #{match[:item].item_name}"
          puts "    Strategy: #{match[:match_strategy]}, Confidence: #{match[:confidence]}"
          puts "    URL: #{match[:photo][:web_url]}"
          puts ""
        end
      end

      if dry_run
        puts "\n" + "="*80
        puts "⚠️  DRY RUN COMPLETE - No changes were made"
        puts "Run with DRY_RUN=false to apply changes:"
        puts "  rake pricebook:sync_photos DRY_RUN=false"
        puts "="*80
      else
        puts "\n" + "="*80
        puts "✅ SYNC COMPLETE - Database updated"
        puts "="*80
      end

    rescue StandardError => e
      puts "\n" + "="*80
      puts "❌ ERROR: #{e.message}"
      puts "="*80
      puts e.backtrace.first(5).join("\n")
      exit 1
    end
  end

  desc "Show pricebook photo sync stats (no changes)"
  task photo_stats: :environment do
    require_relative "../../app/services/pricebook_photo_sync_service"

    puts "\n" + "="*80
    puts "PRICEBOOK PHOTO STATISTICS"
    puts "="*80 + "\n"

    # Current image stats
    total_items = PricebookItem.active.count
    items_with_images = PricebookItem.active.where.not(image_url: nil).count
    items_without_images = total_items - items_with_images

    puts "📊 Current Database State:"
    puts "  Total active items: #{total_items}"
    puts "  Items with images: #{items_with_images} (#{(items_with_images.to_f / total_items * 100).round(1)}%)"
    puts "  Items without images: #{items_without_images} (#{(items_without_images.to_f / total_items * 100).round(1)}%)"

    # Image sources
    puts "\n🖼️  Image Sources:"
    sources = PricebookItem.active.where.not(image_url: nil).group(:image_source).count
    sources.each do |source, count|
      puts "  #{source || 'unknown'}: #{count}"
    end

    # Run dry run sync to see potential matches
    puts "\n🔍 Running match analysis..."
    service = PricebookPhotoSyncService.new
    stats = service.sync_photos(dry_run: true)

    puts "\n📈 Potential Improvements:"
    potential_new_images = stats[:matched] - items_with_images
    puts "  New images that could be added: #{[ potential_new_images, 0 ].max}"
    puts "  Match rate: #{(stats[:matched].to_f / stats[:total_photos] * 100).round(1)}%"

    puts "\n" + "="*80
  end

  desc "Fetch images from internet for PLUMBING FITOFF GEAR items without photos (saves to SharePoint test folder)"
  task fetch_plumbing_fitoff_images: :environment do
    require_relative "../../app/services/pricebook_image_fetcher_service"

    puts "=" * 80
    puts "Fetching images for PLUMBING FITOFF GEAR items without photos"
    puts "Uses Google Images + Claude AI to find and select best product photos"
    puts "Images will be uploaded to SharePoint: Warehousing/Photo Test"
    puts "=" * 80
    puts ""

    # Find all PLUMBING FITOFF GEAR items without photos
    items = PricebookItem
            .where(category: "PLUMBING FITOFF GEAR")
            .where(image_url: nil)
            .order(:item_code)

    total_count = items.count
    puts "Found #{total_count} PLUMBING FITOFF GEAR items without photos"
    puts ""

    if total_count.zero?
      puts "✓ All PLUMBING FITOFF GEAR items already have photos!"
      next
    end

    # Check API configuration
    puts "API Configuration:"
    puts "  Google Search API: #{ENV['GOOGLE_SEARCH_API_KEY'].present? ? '✓ Configured' : '✗ NOT CONFIGURED (required!)'}"
    puts "  Google CX: #{ENV['GOOGLE_CX'].present? ? '✓ Configured' : '✗ NOT CONFIGURED (required!)'}"
    puts "  Anthropic API: #{ENV['ANTHROPIC_API_KEY'].present? ? '✓ Configured' : '✗ Not configured (optional)'}"
    puts "  SharePoint: ✓ Configured (via Organization Microsoft App)"
    puts ""

    unless ENV["GOOGLE_SEARCH_API_KEY"].present? && ENV["GOOGLE_CX"].present?
      puts "⚠️  WARNING: Google Search API is not configured!"
      puts "Without Google API, no images will be found."
      puts ""
      puts "To configure:"
      puts "  heroku config:set GOOGLE_SEARCH_API_KEY=your_key --app teeem-sam-dev"
      puts "  heroku config:set GOOGLE_CX=your_cx_id --app teeem-sam-dev"
      puts ""
      puts "Get API key from: https://console.developers.google.com/"
      puts "Get CX from: https://programmablesearchengine.google.com/"
      puts ""
      print "Continue anyway? (y/n): "
      confirmation = STDIN.gets.chomp.downcase
      next unless confirmation == "y"
    end

    # Use new SharePoint-based fetcher service
    service = PricebookImageFetcherService.new
    results = service.fetch_images_for_items(items)

    # Print summary
    puts ""
    puts "=" * 80
    puts "SUMMARY"
    puts "=" * 80
    puts "Total items:     #{results[:total]}"
    puts "✓ Success:       #{results[:success]}"
    puts "✗ Failed:        #{results[:failed]}"
    puts ""

    if results[:test_folder_url]
      puts "📁 Test images uploaded to:"
      puts "   #{results[:test_folder_url]}"
      puts ""
    end

    if results[:errors].any?
      puts "ERRORS (first 20):"
      results[:errors].first(20).each do |error|
        puts "  #{error[:item_code]}: #{error[:error]}"
      end
      if results[:errors].length > 20
        puts "  ... and #{results[:errors].length - 20} more errors"
      end
    end

    puts "=" * 80
  end

  desc "Auto-set default_supplier_id from most recent price history for items without a default supplier"
  task set_default_suppliers: :environment do
    puts "\n" + "=" * 80
    puts "AUTO-SET DEFAULT SUPPLIERS FROM PRICE HISTORY"
    puts "=" * 80

    dry_run = ENV["DRY_RUN"] != "false"
    puts "Mode: #{dry_run ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE (will update database)'}"
    puts "=" * 80 + "\n"

    # Find items without default_supplier but with price history
    items_to_update = PricebookItem
      .where(default_supplier_id: nil)
      .where(is_active: true)
      .joins(:price_histories)
      .distinct

    total_candidates = items_to_update.count
    puts "📊 Found #{total_candidates} active items without default_supplier that have price history\n\n"

    if total_candidates.zero?
      puts "✅ All items with price history already have a default supplier set!"
      next
    end

    stats = {
      updated: 0,
      skipped_no_supplier: 0,
      errors: 0
    }

    items_to_update.find_each.with_index do |item, index|
      # Find the most recent price history entry with a supplier
      # Prioritize by date_effective (if set), then by created_at
      latest_history = item.price_histories
        .where.not(supplier_id: nil)
        .order(Arel.sql("COALESCE(date_effective, DATE('1900-01-01')) DESC, created_at DESC"))
        .first

      if latest_history.nil? || latest_history.supplier_id.nil?
        stats[:skipped_no_supplier] += 1
        next
      end

      supplier = Contact.find_by(id: latest_history.supplier_id)
      unless supplier
        stats[:skipped_no_supplier] += 1
        next
      end

      if dry_run
        puts "  [DRY RUN] #{item.item_code}: Would set default_supplier to #{supplier.display_name} (ID: #{supplier.id})"
        stats[:updated] += 1
      else
        begin
          item.update!(default_supplier_id: latest_history.supplier_id)
          stats[:updated] += 1

          # Progress indicator every 100 items
          if (index + 1) % 100 == 0
            puts "  Processed #{index + 1}/#{total_candidates}..."
          end
        rescue => e
          stats[:errors] += 1
          puts "  ❌ Error updating #{item.item_code}: #{e.message}"
        end
      end
    end

    # Summary
    puts "\n" + "=" * 80
    puts "SUMMARY"
    puts "=" * 80
    puts "  ✅ Updated: #{stats[:updated]} items"
    puts "  ⏭️  Skipped (no supplier in history): #{stats[:skipped_no_supplier]} items"
    puts "  ❌ Errors: #{stats[:errors]} items"

    if dry_run
      puts "\n⚠️  DRY RUN COMPLETE - No changes were made"
      puts "Run with DRY_RUN=false to apply changes:"
      puts "  rails pricebook:set_default_suppliers DRY_RUN=false"
    else
      puts "\n✅ Default suppliers have been set!"
    end

    puts "=" * 80 + "\n"
  end

  desc "Show items that have no price history and no default supplier (need manual attention)"
  task show_items_without_history: :environment do
    puts "\n" + "=" * 80
    puts "ITEMS WITHOUT PRICE HISTORY (need manual supplier assignment)"
    puts "=" * 80 + "\n"

    items = PricebookItem
      .where(default_supplier_id: nil)
      .where(is_active: true)
      .where.not(id: PriceHistory.select(:pricebook_item_id))

    count = items.count
    puts "Found #{count} items without any price history:\n\n"

    items.order(:category, :item_code).each do |item|
      puts "  #{item.item_code.ljust(20)} | #{item.category&.ljust(25) || 'No Category'.ljust(25)} | $#{item.current_price&.round(2) || 'N/A'} | #{item.item_name.truncate(40)}"
    end

    puts "\n" + "=" * 80
    puts "These #{count} items need manual supplier assignment."
    puts "=" * 80 + "\n"
  end

  desc "Fetch images from internet for all pricebook items without photos (batch mode)"
  task fetch_missing_images: :environment do
    puts "=" * 80
    puts "Fetching images for all pricebook items without photos"
    puts "Uses Google Images + Claude AI to find and select best product photos"
    puts "=" * 80
    puts ""

    # Find all items without photos
    items = PricebookItem
            .where(image_url: nil)
            .where("image_fetch_status IS NULL OR image_fetch_status != ?", "fetching")
            .order(:category, :item_code)

    total_count = items.count
    puts "Found #{total_count} pricebook items without photos"
    puts ""

    if total_count.zero?
      puts "✓ All pricebook items already have photos!"
      next
    end

    # Show breakdown by category
    by_category = items.group(:category).count
    puts "Breakdown by category:"
    by_category.sort_by { |_, count| -count }.each do |category, count|
      puts "  #{category}: #{count} items"
    end
    puts ""

    # Check API configuration
    puts "API Configuration:"
    puts "  Google Search API: #{ENV['GOOGLE_SEARCH_API_KEY'].present? ? '✓ Configured' : '✗ Not configured (will use fallback)'}"
    puts "  Anthropic API: #{ENV['ANTHROPIC_API_KEY'].present? ? '✓ Configured' : '✗ Not configured (will use fallback)'}"
    puts ""

    # Process using existing batch method
    puts "Processing #{total_count} items..."
    puts ""

    results = ProductImageScraper.fetch_images_for_all_items(limit: total_count)

    # Print summary
    puts ""
    puts "=" * 80
    puts "SUMMARY"
    puts "=" * 80
    puts "Total items:     #{results[:total]}"
    puts "✓ Success:       #{results[:success]}"
    puts "✗ Failed:        #{results[:failed]}"
    puts ""

    if results[:errors].any?
      puts "ERRORS (first 20):"
      results[:errors].first(20).each do |error|
        puts "  #{error[:item_name]}: #{error[:error]}"
      end
      if results[:errors].length > 20
        puts "  ... and #{results[:errors].length - 20} more errors"
      end
    end

    puts "=" * 80
  end
end
