class UpdateDocumentTypeDisplayNamesToIncludePlaceholders < ActiveRecord::Migration[8.0]
  # Mapping of short placeholders to long versions for display
  LONG_PLACEHOLDER_MAP = {
    '{Period}' => '{PeriodLong}',
    '{Year}' => '{YearLong}',
    '{MonthYear}' => '{MonthYearLong}',
    '{Day}' => '{DayLong}',
    '{YYYYMMDD}' => '{DateISO}',
    '{DDMMYYYY}' => '{DateAU}',
    '{CompanyCode}' => '{CompanyName}',
    '{LoanID}' => '{LoanName}',
    '{AssetCode}' => '{AssetName}',
    '{LenderCode}' => '{LenderName}'
  }.freeze

  def up
    puts "\n" + "=" * 80
    puts "UPDATING DISPLAY_NAME TO MATCH FILE_NAME (WITHOUT {CompanyCode})"
    puts "=" * 80
    puts ""

    count = 0
    DocumentType.find_each do |doc_type|
      next if doc_type.file_name.blank?

      # Generate display_name from file_name:
      # 1. Remove {CompanyCode} (Hide Company rule)
      # 2. Replace short placeholders with long versions
      display_name = doc_type.file_name
        .gsub(/\{CompanyCode\}\s*/, '')  # Remove {CompanyCode} and trailing space
        .gsub(/^\s+/, '')                # Remove leading whitespace

      # Replace short placeholders with long versions
      LONG_PLACEHOLDER_MAP.each do |short, long|
        next if short == '{CompanyCode}' # Already removed above
        display_name = display_name.gsub(short, long)
      end

      display_name = display_name.strip

      # Only update if display_name changed
      if display_name != doc_type.display_name
        old_value = doc_type.display_name
        doc_type.update_column(:display_name, display_name)
        puts "✅ #{doc_type.name}"
        puts "   File Name:    #{doc_type.file_name}"
        puts "   Old Display:  #{old_value}"
        puts "   New Display:  #{display_name}"
        puts ""
        count += 1
      end
    end

    puts "=" * 80
    puts "✅ Updated #{count} document types"
    puts "=" * 80
    puts ""
  end

  def down
    # Run the previous migration logic (extract from name)
    DocumentType.find_each do |doc_type|
      display_value = if doc_type.name.include?(" - ")
        doc_type.name.split(" - ", 2).last.strip
      else
        doc_type.name
      end
      doc_type.update_column(:display_name, display_value)
    end
    puts "⏪ Reverted display_name values to name-based format"
  end
end
