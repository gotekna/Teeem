#!/usr/bin/env ruby
# frozen_string_literal: true

# Import Price Histories from embedded CSV data
# Usage: rails runner scripts/import_price_histories_from_data.rb

require 'csv'

# The CSV data will be injected here by sed
CSV_DATA = <<~CSV_END
__CSV_DATA_PLACEHOLDER__
CSV_END

puts "\n" + "="*80
puts "PRICE HISTORIES IMPORT FROM EMBEDDED DATA"
puts "="*80

# Parse CSV from embedded data
csv_data = CSV.parse(CSV_DATA, headers: true, encoding: 'UTF-8')

puts "\nFound #{csv_data.length} rows in CSV"
puts "Deleting existing price histories..."

current_count = PriceHistory.count
PriceHistory.delete_all
puts "Deleted #{current_count} existing records"

puts "\nProcessing CSV rows..."

stats = {
  total: csv_data.length,
  created: 0,
  skipped_invalid_item: 0,
  skipped_duplicate: 0,
  supplier_not_found: 0,
  errors: []
}

# Sort by pricebook_id and date
sorted_data = csv_data.sort_by do |row|
  [
    row['pricebook_id'].to_i,
    begin
      Date.parse(row['effective_date'])
    rescue
      Date.new(1900, 1, 1)
    end
  ]
end

item_price_cache = {}

sorted_data.each_with_index do |row, i|
  pricebook_id = row['pricebook_id']&.to_i

  unless pricebook_id && PricebookItem.exists?(pricebook_id)
    stats[:skipped_invalid_item] += 1
    next
  end

  price = row['price'].to_f

  # Parse date
  date = begin
    Date.parse(row['effective_date'])
  rescue
    nil
  end

  # Lookup supplier
  supplier_id = nil
  supplier_name = row['supplier_trade']&.strip
  if supplier_name.present?
    supplier = Contact.find_by(name: supplier_name)
    supplier_id = supplier.id if supplier
    stats[:supplier_not_found] += 1 unless supplier
  end

  old_price = item_price_cache[pricebook_id]

  begin
    PriceHistory.create!({
      pricebook_item_id: pricebook_id,
      old_price: old_price,
      new_price: price,
      date_effective: date,
      supplier_id: supplier_id,
      change_reason: 'imported_from_csv',
      created_at: date || Time.current,
      updated_at: Time.current
    })

    stats[:created] += 1
    item_price_cache[pricebook_id] = price

    puts "Processed #{i + 1}/#{csv_data.length}" if (i + 1) % 1000 == 0
  rescue ActiveRecord::RecordNotUnique
    stats[:skipped_duplicate] += 1
  rescue => e
    stats[:errors] << "Row #{i + 1}: #{e.message}"
  end
end

puts "\n" + "="*80
puts "IMPORT COMPLETE"
puts "="*80
puts "Total rows: #{stats[:total]}"
puts "Created: #{stats[:created]}"
puts "Skipped (invalid item): #{stats[:skipped_invalid_item]}"
puts "Skipped (duplicate): #{stats[:skipped_duplicate]}"
puts "Supplier not found: #{stats[:supplier_not_found]}"
puts "Errors: #{stats[:errors].length}"

if stats[:errors].any?
  puts "\nFirst 10 errors:"
  stats[:errors].first(10).each { |e| puts "  #{e}" }
end

puts "\nFinal count: #{PriceHistory.count}"
puts "="*80
