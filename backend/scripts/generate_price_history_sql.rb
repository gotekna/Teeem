#!/usr/bin/env ruby
# frozen_string_literal: true

# Generate SQL INSERT statements for price histories from CSV
# Usage: ruby scripts/generate_price_history_sql.rb /path/to/file.csv

require 'csv'
require 'date'

csv_path = ARGV[0]

unless csv_path && File.exist?(csv_path)
  puts "ERROR: CSV file not found: #{csv_path}"
  exit 1
end

def parse_price(price_str)
  return 'NULL' if price_str.nil? || price_str.to_s.strip.empty?
  cleaned = price_str.to_s.gsub(/[$,\s]/, '')
  cleaned.to_f
end

def parse_date(date_str)
  return 'NULL' if date_str.nil? || date_str.to_s.strip.empty?

  formats = [ '%d/%m/%Y %H:%M', '%d/%m/%Y', '%Y-%m-%d' ]
  formats.each do |format|
    begin
      return "'#{DateTime.strptime(date_str.strip, format).to_date}'"
    rescue ArgumentError
      next
    end
  end

  begin
    "'#{Date.parse(date_str)}'"
  rescue ArgumentError
    'NULL'
  end
end

# Read CSV
csv_data = CSV.read(csv_path, headers: true, encoding: 'UTF-8')

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

# Generate SQL
puts "BEGIN;"
puts "DELETE FROM price_histories;"

item_price_cache = {}

sorted_data.each do |row|
  pricebook_id = row['pricebook_id']&.to_i
  next if pricebook_id.nil? || pricebook_id == 0

  price = parse_price(row['price'])
  effective_date = parse_date(row['effective_date'])
  old_price = item_price_cache[pricebook_id] || 'NULL'

  puts "INSERT INTO price_histories (pricebook_item_id, old_price, new_price, date_effective, change_reason, created_at, updated_at) VALUES (#{pricebook_id}, #{old_price}, #{price}, #{effective_date}, 'imported_from_csv', #{effective_date}, NOW());"

  item_price_cache[pricebook_id] = price
end

puts "COMMIT;"
