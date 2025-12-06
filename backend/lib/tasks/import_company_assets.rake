namespace :corporate do
  desc "Import company assets from Corporate File.xlsx"
  task import_assets: :environment do
    puts "Importing Company Assets from Corporate File.xlsx"
    puts "=" * 80

    file_path = Rails.root.join("..", "Corporate File.xlsx").to_s
    spreadsheet = Roo::Spreadsheet.open(file_path)

    stats = {
      created: 0,
      updated: 0,
      errors: []
    }

    # Iterate through company sheets
    company_sheets = [ "Co Invest Homes", "Co Invest Capital", "Team Harder", "Tekna", "Tekna Drafting", "Tekna Homes" ]

    company_sheets.each do |sheet_name|
      next unless spreadsheet.sheets.include?(sheet_name)

      puts "\n📊 Processing sheet: #{sheet_name}"
      puts "-" * 40

      sheet = spreadsheet.sheet(sheet_name)

      # Find company in database
      company = Company.find_by("name ILIKE ?", "%#{sheet_name}%")
      unless company
        puts "  ⚠️  Company not found in database: #{sheet_name}"
        next
      end

      # Find the "Register of Assets" section
      assets_row = nil
      (1..sheet.last_row).each do |row_num|
        row = sheet.row(row_num)
        if row.any? { |cell| cell.to_s =~ /register.*asset/i }
          assets_row = row_num
          break
        end
      end

      unless assets_row
        puts "  ℹ️  No 'Register of Assets' section found"
        next
      end

      puts "  Found 'Register of Assets' at row #{assets_row}"

      # Find header row (should be next row after the section title)
      header_row = assets_row + 1
      headers = sheet.row(header_row)

      # Find column indices
      item_col = headers.index { |h| h.to_s.downcase.include?("item") }
      purchase_date_col = headers.index { |h| h.to_s.downcase =~ /purchase.*date/i }
      purchase_price_col = headers.index { |h| h.to_s.downcase =~ /purchase.*price/i }
      sale_date_col = headers.index { |h| h.to_s.downcase =~ /sale.*date/i }

      unless item_col && purchase_date_col && purchase_price_col
        puts "  ⚠️  Could not find required columns"
        next
      end

      # Process assets rows
      asset_count = 0
      ((header_row + 1)..sheet.last_row).each do |row_num|
        row = sheet.row(row_num)
        break if row.compact.empty?

        item_name = row[item_col].to_s.strip
        next if item_name.blank?
        break if item_name =~ /^register/i # Stop at next section

        # Parse purchase date
        purchase_date_raw = row[purchase_date_col]
        purchase_date = case purchase_date_raw
        when Date, DateTime, Time then purchase_date_raw.to_date
        when String then Date.parse(purchase_date_raw) rescue nil
        when Numeric then Date.new(1899, 12, 30) + purchase_date_raw.to_i
        else nil
        end

        # Parse purchase price
        purchase_price_raw = row[purchase_price_col]
        purchase_price = case purchase_price_raw
        when Numeric then purchase_price_raw.to_f
        when String
                           cleaned = purchase_price_raw.to_s.gsub(/[$,]/, "").strip
                           cleaned.to_f if cleaned.present?
        else nil
        end

        # Parse sale date
        sale_date_raw = sale_date_col ? row[sale_date_col] : nil
        sale_date = case sale_date_raw
        when Date, DateTime, Time then sale_date_raw.to_date
        when String then Date.parse(sale_date_raw) rescue nil
        when Numeric then Date.new(1899, 12, 30) + sale_date_raw.to_i
        else nil
        end

        # Determine asset type
        asset_type = if item_name =~ /building|property|unit|house|land/i
                       "property"
        elsif item_name =~ /loan|equity|debt|finance/i
                       "other"
        elsif item_name =~ /vehicle|car|truck|van/i
                       "vehicle"
        else
                       "other"
        end

        # Determine status
        status = sale_date.present? ? "disposed" : "active"

        begin
          # Check if asset already exists
          asset = Asset.find_by(company: company, name: item_name)

          asset_data = {
            name: item_name,
            asset_type: asset_type,
            status: status,
            purchase_date: purchase_date,
            purchase_price: purchase_price,
            sale_date: sale_date,
            current_book_value: (sale_date.present? ? 0 : purchase_price),
            description: "Imported from Corporate File.xlsx"
          }

          if asset
            asset.update!(asset_data)
            stats[:updated] += 1
            puts "    ✅ Updated: #{item_name}"
          else
            Asset.create!(asset_data.merge(company: company))
            stats[:created] += 1
            puts "    ➕ Created: #{item_name}"
          end

          asset_count += 1
        rescue => e
          stats[:errors] << "#{sheet_name} row #{row_num}: #{e.message}"
          puts "    ❌ Error: #{e.message}"
        end
      end

      puts "  Total assets processed: #{asset_count}"
    end

    puts "\n" + "=" * 80
    puts "IMPORT COMPLETE - SUMMARY"
    puts "=" * 80
    puts "Assets created: #{stats[:created]}"
    puts "Assets updated: #{stats[:updated]}"
    puts "Total assets in system: #{Asset.count}"

    if stats[:errors].any?
      puts "\n=== Errors (#{stats[:errors].count}) ==="
      stats[:errors].each { |e| puts "  - #{e}" }
    end

    puts "\n✅ Done!"
  end
end
