#!/usr/bin/env ruby
require 'csv'

file_path = File.expand_path('~/Downloads/Price Histories Edit.csv')
puts "Starting import from: #{file_path}"
puts "File exists: #{File.exist?(file_path)}"
puts ""

stats = {
  total_rows: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0
}

errors = []
warnings = []

begin
  # Clear existing price histories first
  puts "Clearing existing price histories..."
  PriceHistory.delete_all
  puts "Cleared."
  puts ""

  CSV.foreach(file_path, headers: true) do |row|
    stats[:total_rows] += 1

    begin
      # Extract data from CSV
      price_history_id = row['id']&.to_i
      price = row['price']&.to_f
      effective_date_str = row['effective_date']
      pricebook_item_id = row['pricebook_id']&.to_i
      supplier_trade_name = row['supplier_trade']&.strip

      # Skip if no price or item
      if price.nil? || price.zero? || pricebook_item_id.nil?
        stats[:skipped] += 1
        next
      end

      # Find the pricebook item
      item = PricebookItem.find_by(id: pricebook_item_id)
      unless item
        warnings << "Row #{stats[:total_rows]}: Item ID #{pricebook_item_id} not found - skipping"
        stats[:skipped] += 1
        next
      end

      # Parse effective date
      effective_date = if effective_date_str.present?
        begin
          Date.parse(effective_date_str)
        rescue
          CorporateCompanySetting.today
        end
      else
        CorporateCompanySetting.today
      end

      # Find or create supplier
      supplier = nil
      if supplier_trade_name.present?
        supplier = Contact.find_by("LOWER(display_name) = ?", supplier_trade_name.downcase)
        unless supplier
          supplier = Contact.create!(
            display_name: supplier_trade_name,
            entity_type: "company",
            is_active: true
          )
          warnings << "Created new supplier: #{supplier_trade_name}"
        end
      end

      # Create price history
      history = PriceHistory.create!(
        pricebook_item: item,
        new_price: price,
        date_effective: effective_date,
        supplier_id: supplier&.id,
        change_reason: "imported_from_export"
      )

      stats[:created] += 1

      if stats[:created] % 100 == 0
        puts "Processed #{stats[:created]} records..."
      end

    rescue => e
      stats[:errors] += 1
      errors << "Row #{stats[:total_rows]}: #{e.message}"
    end
  end

  puts ""
  puts "=" * 60
  puts "IMPORT RESULTS"
  puts "=" * 60
  puts "Success: true"
  puts ""
  puts "Statistics:"
  puts "  Total rows: #{stats[:total_rows]}"
  puts "  Created: #{stats[:created]}"
  puts "  Updated: #{stats[:updated]}"
  puts "  Skipped: #{stats[:skipped]}"
  puts "  Errors: #{stats[:errors]}"
  puts ""

  if warnings.any?
    puts "Warnings (first 10):"
    warnings.first(10).each { |w| puts "  - #{w}" }
    puts "  ... and #{warnings.count - 10} more" if warnings.count > 10
    puts ""
  end

  if errors.any?
    puts "Errors (first 10):"
    errors.first(10).each { |e| puts "  - #{e}" }
    puts "  ... and #{errors.count - 10} more" if errors.count > 10
    puts ""
  end

  puts "Final count in database: #{PriceHistory.count}"
  puts "=" * 60

rescue => e
  puts "Import failed with exception: #{e.message}"
  puts e.backtrace.first(10).join("\n")
end
