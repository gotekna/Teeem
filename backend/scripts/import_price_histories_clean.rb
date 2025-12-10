#!/usr/bin/env ruby
# frozen_string_literal: true

# Import Price Histories from CSV - Full Replacement
# Usage: rails runner scripts/import_price_histories_clean.rb /path/to/file.csv

require 'csv'

class PriceHistoriesImporter
  attr_reader :stats

  def initialize(csv_path = nil)
    # Default to backend root if no path provided (for Heroku deployment)
    @csv_path = csv_path || Rails.root.join('price_histories_import.csv')
    @stats = {
      total_rows: 0,
      created: 0,
      skipped_invalid_item: 0,
      skipped_duplicate: 0,
      supplier_not_found: 0,
      failed: 0,
      errors: []
    }
    @item_price_cache = {} # Cache to track previous prices for each item
  end

  def run
    puts "\n" + "="*80
    puts "PRICE HISTORIES IMPORT - FULL REPLACEMENT"
    puts "="*80

    # Check file exists
    unless File.exist?(@csv_path)
      puts "❌ ERROR: File not found: #{@csv_path}"
      return false
    end

    # Display current state
    current_count = PriceHistory.count
    puts "\n📊 Current State:"
    puts "   Existing price histories: #{current_count}"
    puts "   Target file: #{@csv_path}"

    # Delete existing records
    puts "\n🗑️  Deleting all existing price histories..."
    PriceHistory.delete_all
    puts "   ✓ Deleted #{current_count} records"

    # Parse and import CSV
    puts "\n📥 Importing CSV data..."
    import_csv

    # Display results
    display_stats

    @stats[:failed] == 0
  end

  private

  def import_csv
    # Read and parse CSV
    csv_data = CSV.read(@csv_path, headers: true, encoding: 'UTF-8')
    @stats[:total_rows] = csv_data.length

    puts "   Found #{@stats[:total_rows]} rows in CSV"

    # Sort by pricebook_id and effective_date to ensure chronological order
    sorted_data = csv_data.sort_by do |row|
      [
        row['pricebook_id'].to_i,
        parse_date(row['effective_date']) || Date.new(1900, 1, 1)
      ]
    end

    # Process each row
    sorted_data.each_with_index do |row, index|
      process_row(row, index + 1)

      # Progress indicator every 1000 rows
      if (index + 1) % 1000 == 0
        puts "   Processed #{index + 1}/#{@stats[:total_rows]} rows..."
      end
    end
  end

  def process_row(row, row_num)
    # Extract data from CSV
    item_code = row['pricebook']&.strip  # CSV 'pricebook' column has the item_code (DPP, SPP, etc.)
    price = parse_price(row['price'])
    effective_date = parse_date(row['effective_date'])
    supplier_name = row['supplier_trade']&.strip

    # Lookup pricebook item by code
    pricebook_item = PricebookItem.find_by(item_code: item_code) if item_code.present?
    unless pricebook_item
      @stats[:skipped_invalid_item] += 1
      return
    end

    pricebook_id = pricebook_item.id

    # Lookup supplier (allow nil)
    supplier_id = nil
    if supplier_name.present?
      supplier = Contact.find_by(display_name: supplier_name)
      if supplier
        supplier_id = supplier.id
      else
        @stats[:supplier_not_found] += 1 unless @stats[:supplier_not_found] > 100 # Cap logging
      end
    end

    # Calculate old_price from cache (try but don't fail)
    old_price = @item_price_cache[pricebook_id]

    # Create price history record
    begin
      PriceHistory.create!(
        pricebook_item_id: pricebook_id,
        old_price: old_price,
        new_price: price,
        date_effective: effective_date,
        supplier_id: supplier_id,
        change_reason: 'imported_from_csv',
        created_at: effective_date || Time.current,
        updated_at: Time.current
      )

      @stats[:created] += 1

      # Update cache with this price for future old_price calculations
      @item_price_cache[pricebook_id] = price

    rescue ActiveRecord::RecordNotUnique => e
      # Duplicate constraint violation - skip
      @stats[:skipped_duplicate] += 1

    rescue StandardError => e
      @stats[:failed] += 1
      if @stats[:errors].length < 10 # Only store first 10 errors
        @stats[:errors] << {
          row: row_num,
          error: e.message,
          data: row.to_h.slice('pricebook_id', 'price', 'effective_date', 'supplier_trade')
        }
      end
    end
  end

  def parse_price(price_str)
    return nil if price_str.blank?

    # Remove currency symbols and commas
    cleaned = price_str.to_s.gsub(/[$,\s]/, '')

    # Convert to decimal
    cleaned.to_f
  end

  def parse_date(date_str)
    return nil if date_str.blank?

    # Try various date formats
    formats = [
      '%d/%m/%Y %H:%M',  # "2/09/2023 7:59"
      '%d/%m/%Y',        # "2/09/2023"
      '%Y-%m-%d'         # "2023-09-02" (fallback)
    ]

    formats.each do |format|
      begin
        return DateTime.strptime(date_str.strip, format).to_date
      rescue ArgumentError
        next
      end
    end

    # Final fallback: try Date.parse
    begin
      Date.parse(date_str)
    rescue ArgumentError
      nil
    end
  end

  def display_stats
    puts "\n" + "="*80
    puts "IMPORT COMPLETE"
    puts "="*80

    puts "\n✅ Results:"
    puts "   Total rows in CSV:      #{@stats[:total_rows]}"
    puts "   Successfully created:   #{@stats[:created]}"
    puts "   Skipped (invalid item): #{@stats[:skipped_invalid_item]}"
    puts "   Skipped (duplicate):    #{@stats[:skipped_duplicate]}"
    puts "   Failed:                 #{@stats[:failed]}"

    if @stats[:supplier_not_found] > 0
      puts "\n⚠️  Supplier Lookups:"
      puts "   Records with missing suppliers: #{@stats[:supplier_not_found]}"
      puts "   (These were imported with supplier_id: nil)"
    end

    if @stats[:errors].any?
      puts "\n❌ Errors (first 10):"
      @stats[:errors].each do |error|
        puts "   Row #{error[:row]}: #{error[:error]}"
        puts "   Data: #{error[:data].inspect}"
      end
    end

    puts "\n📊 Final Count:"
    puts "   Total price histories in database: #{PriceHistory.count}"
    puts "\n" + "="*80
  end
end

# Main execution
# Accept optional CSV path, or use default (backend root)
csv_path = ARGV[0] # nil is OK, will use default in initializer
importer = PriceHistoriesImporter.new(csv_path)
success = importer.run

exit(success ? 0 : 1)
