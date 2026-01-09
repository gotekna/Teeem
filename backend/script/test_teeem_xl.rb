#!/usr/bin/env ruby
# frozen_string_literal: true

# Test script for TeeemXl library
# Run with: bundle exec ruby script/test_teeem_xl.rb

require_relative "../config/environment"
require_relative "../lib/teeem_xl/teeem_xl"

puts "=" * 60
puts "TeeemXl Test Script"
puts "=" * 60

# Test 1: Read a real Excel file
puts "\n[Test 1] Reading real Excel file..."
test_file = Rails.root.join("..", "Schedule Master Final.xlsx").to_s

if File.exist?(test_file)
  begin
    workbook = TeeemXl.read(test_file)
    puts "  ✓ Successfully read: #{test_file}"
    puts "  ✓ Sheets: #{workbook.sheet_names.join(', ')}"

    workbook.sheets.each do |sheet|
      puts "  ✓ Sheet '#{sheet.name}': #{sheet.cell_count} cells"

      # Show first 3 rows
      rows = sheet.rows.first(3)
      rows.each_with_index do |row, idx|
        values = row.map { |c| c.value.to_s[0..20] }.join(" | ")
        puts "    Row #{idx + 1}: #{values}"
      end
    end
  rescue => e
    puts "  ✗ Error: #{e.message}"
    puts e.backtrace.first(5).join("\n")
  end
else
  puts "  ⚠ Test file not found: #{test_file}"
end

# Test 2: Write and read back
puts "\n[Test 2] Write and read back..."
begin
  # Create workbook
  workbook = TeeemXl::Models::Workbook.new
  sheet = workbook.add_sheet("Test Data")

  # Add header
  sheet.add_row(["ID", "Name", "Value", "Active", "Date"])

  # Add data rows
  sheet.add_row([1, "Alice", 100.50, true, Date.today])
  sheet.add_row([2, "Bob", 200.75, false, Date.today - 7])
  sheet.add_row([3, "Charlie", 300.25, true, Date.today + 7])

  # Add formula row
  sheet.add_row(["Total", "", "=SUM(C2:C4)", "", ""])

  # Set column widths
  sheet.column_widths = [10, 20, 15, 10, 15]

  # Freeze header row
  sheet.freeze_panes(row: 1)

  # Write to temp file
  temp_file = Tempfile.new(["teeem_xl_test", ".xlsx"])
  TeeemXl.write(workbook, temp_file.path)
  puts "  ✓ Written to: #{temp_file.path}"
  puts "  ✓ File size: #{File.size(temp_file.path)} bytes"

  # Read it back
  read_back = TeeemXl.read(temp_file.path)
  puts "  ✓ Read back successfully"
  puts "  ✓ Sheets: #{read_back.sheet_names.join(', ')}"

  read_sheet = read_back.first_sheet
  puts "  ✓ Cells: #{read_sheet.cell_count}"

  # Verify data
  header = read_sheet.row(1).map(&:value)
  puts "  ✓ Header: #{header.join(', ')}"

  row2 = read_sheet.row(2).map(&:value)
  puts "  ✓ Row 2: #{row2.join(', ')}"

  # Check formula
  formula_cell = read_sheet.cell("C5")
  if formula_cell&.formula
    puts "  ✓ Formula in C5: =#{formula_cell.formula}"
  else
    puts "  ⚠ Formula not found in C5"
  end

  # Check frozen panes
  if read_sheet.frozen_panes
    puts "  ✓ Frozen panes: row=#{read_sheet.frozen_panes[:row]}, col=#{read_sheet.frozen_panes[:col]}"
  end

  # Cleanup
  temp_file.close
  temp_file.unlink

  puts "  ✓ Round-trip test passed!"

rescue => e
  puts "  ✗ Error: #{e.message}"
  puts e.backtrace.first(5).join("\n")
end

# Test 3: Test SpreadsheetAdapter (Roo-compatible API)
puts "\n[Test 3] Test SpreadsheetAdapter (Roo-compatible API)..."
if File.exist?(test_file)
  begin
    # Use SpreadsheetAdapter (Roo-compatible interface)
    adapter = TeeemXl::SpreadsheetAdapter.open(test_file)

    puts "  ✓ SpreadsheetAdapter opened file successfully"
    puts "  ✓ Sheets: #{adapter.sheets.join(', ')}"
    puts "  ✓ First row: #{adapter.row(1).first(5).join(', ')}..."
    puts "  ✓ Last row: #{adapter.last_row}"
    puts "  ✓ Last column: #{adapter.last_column}"

    # Test cell access
    cell_a1 = adapter.cell(1, 1)
    puts "  ✓ Cell(1,1): #{cell_a1}"

    # Compare with direct TeeemXl read
    teeem_workbook = TeeemXl.read(test_file)
    teeem_sheet = teeem_workbook.first_sheet

    if adapter.last_row == teeem_sheet.max_row
      puts "  ✓ Row count matches TeeemXl native: #{adapter.last_row}"
    else
      puts "  ⚠ Row count differs: Adapter=#{adapter.last_row}, Native=#{teeem_sheet.max_row}"
    end

  rescue => e
    puts "  ✗ Adapter error: #{e.message}"
    puts e.backtrace.first(3).join("\n")
  end
else
  puts "  ⚠ Test file not found"
end

puts "\n" + "=" * 60
puts "Tests completed"
puts "=" * 60
