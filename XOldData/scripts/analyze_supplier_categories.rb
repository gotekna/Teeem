#!/usr/bin/env ruby
require 'csv'
require 'json'

# Read CSV and analyze supplier-category relationships
csv_path = File.join(__dir__, 'easybuildapp development Price Books(in).csv')

# Data structures for analysis
supplier_categories = Hash.new { |h, k| h[k] = Hash.new(0) }
category_suppliers = Hash.new { |h, k| h[k] = Hash.new(0) }
supplier_totals = Hash.new(0)
category_totals = Hash.new(0)

# Parse CSV
puts "Analyzing CSV data from: #{csv_path}"
puts "=" * 80

CSV.foreach(csv_path, headers: true) do |row|
  supplier = row['default_supplier']&.strip
  category = row['category']&.strip

  # Skip if either is missing
  next if supplier.nil? || supplier.empty? || category.nil? || category.empty?

  # Track relationships
  supplier_categories[supplier][category] += 1
  category_suppliers[category][supplier] += 1
  supplier_totals[supplier] += 1
  category_totals[category] += 1
end

# Sort suppliers by total items
sorted_suppliers = supplier_totals.sort_by { |_, count| -count }

puts "\n1. TOP 30 SUPPLIERS BY ITEM COUNT"
puts "=" * 80
sorted_suppliers.first(30).each_with_index do |(supplier, count), index|
  categories = supplier_categories[supplier]
  primary_category = categories.max_by { |_, c| c }

  puts "\n#{index + 1}. #{supplier}"
  puts "   Total Items: #{count}"
  puts "   Categories: #{categories.keys.size}"
  puts "   Primary Category: #{primary_category[0]} (#{primary_category[1]} items)"

  if categories.keys.size > 1
    puts "   Other Categories:"
    categories.sort_by { |_, c| -c }.drop(1).first(5).each do |cat, cnt|
      puts "     - #{cat}: #{cnt} items"
    end
  end
end

puts "\n\n2. ALL SUPPLIERS WITH CATEGORY BREAKDOWN"
puts "=" * 80
sorted_suppliers.each_with_index do |(supplier, count), index|
  categories = supplier_categories[supplier]

  puts "\n#{index + 1}. #{supplier} (#{count} items, #{categories.keys.size} categories)"
  categories.sort_by { |_, c| -c }.each do |cat, cnt|
    percentage = (cnt.to_f / count * 100).round(1)
    puts "   - #{cat}: #{cnt} items (#{percentage}%)"
  end
end

puts "\n\n3. TOP CATEGORIES BY ITEM COUNT"
puts "=" * 80
sorted_categories = category_totals.sort_by { |_, count| -count }
sorted_categories.first(20).each_with_index do |(category, count), index|
  suppliers = category_suppliers[category]
  top_supplier = suppliers.max_by { |_, c| c }

  puts "\n#{index + 1}. #{category}"
  puts "   Total Items: #{count}"
  puts "   Suppliers: #{suppliers.keys.size}"
  puts "   Top Supplier: #{top_supplier[0]} (#{top_supplier[1]} items)"
end

puts "\n\n4. SUPPLIER SPECIALIZATION ANALYSIS"
puts "=" * 80
puts "\nHighly Specialized Suppliers (95%+ in one category):"
sorted_suppliers.each do |(supplier, count)|
  categories = supplier_categories[supplier]
  next if categories.keys.size < 1

  primary = categories.max_by { |_, c| c }
  percentage = (primary[1].to_f / count * 100).round(1)

  if percentage >= 95
    puts "  #{supplier}: #{percentage}% in #{primary[0]} (#{count} items)"
  end
end

puts "\nMulti-Category Suppliers (5+ categories):"
sorted_suppliers.each do |(supplier, count)|
  categories = supplier_categories[supplier]
  if categories.keys.size >= 5
    puts "  #{supplier}: #{categories.keys.size} categories (#{count} items)"
  end
end

# Generate JSON output for database import
puts "\n\n5. GENERATING JSON OUTPUT FILES"
puts "=" * 80

# Supplier-to-categories mapping
supplier_mapping = sorted_suppliers.map do |supplier, count|
  categories = supplier_categories[supplier]
  primary = categories.max_by { |_, c| c }

  {
    supplier_name: supplier,
    total_items: count,
    primary_category: primary[0],
    primary_category_count: primary[1],
    categories: categories.map do |cat, cnt|
      {
        category: cat,
        item_count: cnt,
        percentage: (cnt.to_f / count * 100).round(1)
      }
    end.sort_by { |c| -c[:item_count] }
  }
end

File.write('supplier_categories_mapping.json', JSON.pretty_generate(supplier_mapping))
puts "✓ Created: supplier_categories_mapping.json (#{supplier_mapping.size} suppliers)"

# Category-to-suppliers mapping
category_mapping = sorted_categories.map do |category, count|
  suppliers = category_suppliers[category]
  top_supplier = suppliers.max_by { |_, c| c }

  {
    category_name: category,
    total_items: count,
    total_suppliers: suppliers.keys.size,
    top_supplier: top_supplier[0],
    top_supplier_count: top_supplier[1],
    suppliers: suppliers.map do |sup, cnt|
      {
        supplier: sup,
        item_count: cnt,
        percentage: (cnt.to_f / count * 100).round(1)
      }
    end.sort_by { |s| -s[:item_count] }
  }
end

File.write('category_suppliers_mapping.json', JSON.pretty_generate(category_mapping))
puts "✓ Created: category_suppliers_mapping.json (#{category_mapping.size} categories)"

# Simple lookup for database import
simple_mapping = []
sorted_suppliers.each do |supplier, _|
  supplier_categories[supplier].each do |category, count|
    simple_mapping << {
      supplier: supplier,
      category: category,
      item_count: count
    }
  end
end

File.write('supplier_category_relationships.json', JSON.pretty_generate(simple_mapping))
puts "✓ Created: supplier_category_relationships.json (#{simple_mapping.size} relationships)"

puts "\n\n6. SUMMARY STATISTICS"
puts "=" * 80
puts "Total Suppliers: #{supplier_totals.keys.size}"
puts "Total Categories: #{category_totals.keys.size}"
puts "Total Supplier-Category Relationships: #{simple_mapping.size}"
puts "Total Items: #{supplier_totals.values.sum}"
puts "Average Items per Supplier: #{(supplier_totals.values.sum.to_f / supplier_totals.keys.size).round(1)}"
puts "Average Categories per Supplier: #{(simple_mapping.size.to_f / supplier_totals.keys.size).round(1)}"

puts "\n" + "=" * 80
puts "Analysis complete!"
puts "=" * 80
