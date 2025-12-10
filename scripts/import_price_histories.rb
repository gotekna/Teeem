#!/usr/bin/env ruby

file_path = File.expand_path('~/Downloads/Price Histories Edit.csv')
puts "Starting import from: #{file_path}"
puts "File exists: #{File.exist?(file_path)}"
puts ""

begin
  service = PriceHistoryImportService.new(file_path)
  result = service.import

  puts ""
  puts "=" * 60
  puts "IMPORT RESULTS"
  puts "=" * 60
  puts "Success: #{result[:success]}"
  puts ""

  if result[:stats]
    puts "Statistics:"
    puts "  Total rows: #{result[:stats][:total_rows]}"
    puts "  Processed: #{result[:stats][:processed]}"
    puts "  Created: #{result[:stats][:created]}"
    puts "  Updated: #{result[:stats][:updated]}"
    puts "  Skipped: #{result[:stats][:skipped]}"
    puts "  Errors: #{result[:stats][:errors]}"
    puts ""
  end

  if result[:warnings]&.any?
    puts "Warnings:"
    result[:warnings].first(10).each { |w| puts "  - #{w}" }
    puts "  ... and #{result[:warnings].count - 10} more" if result[:warnings].count > 10
    puts ""
  end

  if result[:errors]&.any?
    puts "Errors:"
    result[:errors].first(10).each { |e| puts "  - #{e}" }
    puts "  ... and #{result[:errors].count - 10} more" if result[:errors].count > 10
    puts ""
  end
rescue => e
  puts "Import failed with exception: #{e.message}"
  puts e.backtrace.first(5).join("\n")
end

puts "Final count in database: #{PriceHistory.count}"
puts "=" * 60
