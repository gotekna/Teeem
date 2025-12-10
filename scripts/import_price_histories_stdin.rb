#!/usr/bin/env ruby
# frozen_string_literal: true

# Import Price Histories from STDIN CSV
# Usage: cat file.csv | rails runner scripts/import_price_histories_stdin.rb

require 'csv'

puts "\n" + "="*80
puts "PRICE HISTORIES IMPORT FROM STDIN"
puts "="*80

# Read CSV from STDIN
csv_content = STDIN.read
csv_data = CSV.parse(csv_content, headers: true, encoding: 'UTF-8')

puts "\nFound #{csv_data.length} rows in CSV"
puts "Deleting existing price histories..."

PriceHistory.delete_all
puts "Deleted all existing records"

puts "\nProcessing CSV rows..."

stats = {
  total: csv_data.length,
  created: 0,
  skipped: 0,
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
    stats[:skipped] += 1
    next
  end

  price = row['price'].to_f

  # Parse date
  date = begin
    Date.parse(row['effective_date'])
  rescue
    nil
  end

  old_price = item_price_cache[pricebook_id]

  begin
    PriceHistory.create!(
      pricebook_item_id: pricebook_id,
      old_price: old_price,
      new_price: price,
      date_effective: date,
      change_reason: 'imported_from_csv',
      created_at: date || Time.current,
      updated_at: Time.current
    )

    stats[:created] += 1
    item_price_cache[pricebook_id] = price

    puts "Processed #{i + 1}/#{csv_data.length}" if (i + 1) % 1000 == 0
  rescue => e
    stats[:errors] << "Row #{i + 1}: #{e.message}"
  end
end

puts "\n" + "="*80
puts "IMPORT COMPLETE"
puts "="*80
puts "Total rows: #{stats[:total]}"
puts "Created: #{stats[:created]}"
puts "Skipped: #{stats[:skipped]}"
puts "Errors: #{stats[:errors].length}"
puts "\nFinal count: #{PriceHistory.count}"
puts "="*80
