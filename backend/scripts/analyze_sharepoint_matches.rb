require 'csv'

puts "=" * 80
puts "SHAREPOINT FILE MATCHING ANALYSIS"
puts "=" * 80

# Read the existing inventory CSV
csv_path = ARGV[0] || "/tmp/sharepoint_corporate_inventory.csv"
inventory = CSV.read(csv_path, headers: true)

puts "\n📊 Loading inventory: #{inventory.count} files"
puts "📚 Loading document types: #{DocumentType.active.count} types"

# Build keyword extraction helper
def extract_keywords(filename)
  # Remove company codes, file extensions, dates, common words
  cleaned = filename.gsub(/\b[A-Z]{2,4}\b/, '') # Remove codes like "TH", "TA", "CIC"
                    .gsub(/FY\d{2}/, '') # Remove FY25, FY24
                    .gsub(/\d{1,2}-\d{1,2}-\d{4}/, '') # Remove dates
                    .gsub(/\.(pdf|docx|xlsx)$/i, '') # Remove extensions

  # Extract meaningful words (3+ chars)
  keywords = cleaned.scan(/\b[a-z]{3,}\b/i).uniq
  keywords
end

# Match file against document types
def match_document_type(filename, folder_name)
  # Return nil if filename is blank
  return { doc_type: nil, method: 'unmatched', confidence: 'none' } if filename.blank?

  # Strategy 1: Try abbreviation match (BAS, CTR, TTR, etc.)
  DocumentType.active.find_each do |dt|
    if dt.abbreviation.present? && filename.upcase.include?(dt.abbreviation.upcase)
      return { doc_type: dt, method: 'abbreviation', confidence: 'high' }
    end
  end

  # Strategy 2: Try keyword match using find_by_name_or_alias
  keywords = extract_keywords(filename)
  keywords.each do |keyword|
    doc_type = DocumentType.find_by_name_or_alias(keyword)
    if doc_type
      return { doc_type: doc_type, method: 'keyword_alias', confidence: 'medium' }
    end
  end

  # Strategy 3: Check DEFAULT_ALIASES terms
  DocumentType::DEFAULT_ALIASES.each do |canonical_name, aliases|
    aliases.each do |alias_term|
      if filename.downcase.include?(alias_term.downcase)
        doc_type = DocumentType.find_by_name_or_alias(alias_term)
        if doc_type
          return { doc_type: doc_type, method: 'default_alias', confidence: 'medium' }
        end
      end
    end
  end

  # Strategy 4: Folder-based inference
  if folder_name.present?
    folder_types = DocumentType.active.by_folder(folder_name)
    if folder_types.count == 1
      return { doc_type: folder_types.first, method: 'folder_inference', confidence: 'low' }
    end
  end

  # No match
  { doc_type: nil, method: 'unmatched', confidence: 'none' }
end

# Analyze each file
results = []
inventory.each_with_index do |row, idx|
  filename = row['file_name']
  folder = row['current_folder']

  match = match_document_type(filename, folder)

  results << {
    filename: filename,
    folder: folder,
    matched_type: match[:doc_type]&.name,
    matched_type_id: match[:doc_type]&.id,
    match_method: match[:method],
    confidence: match[:confidence]
  }

  # Progress indicator
  if (idx + 1) % 500 == 0
    puts "  Processed #{idx + 1} / #{inventory.count} files..."
  end
end

# Generate summary statistics
puts "\n" + "=" * 80
puts "SUMMARY STATISTICS"
puts "=" * 80

total = results.count
matched = results.count { |r| r[:matched_type_id].present? }
unmatched = total - matched

puts "\nTotal files: #{total}"
puts "Matched: #{matched} (#{(matched * 100.0 / total).round(1)}%)"
puts "Unmatched: #{unmatched} (#{(unmatched * 100.0 / total).round(1)}%)"

puts "\nBy confidence:"
%w[high medium low none].each do |conf|
  count = results.count { |r| r[:confidence] == conf }
  pct = (count * 100.0 / total).round(1)
  puts "  #{conf.capitalize}: #{count} (#{pct}%)"
end

puts "\nBy match method:"
results.group_by { |r| r[:match_method] }.each do |method, group|
  count = group.count
  pct = (count * 100.0 / total).round(1)
  puts "  #{method}: #{count} (#{pct}%)"
end

puts "\nTop 20 matched document types:"
matched_results = results.select { |r| r[:matched_type].present? }
matched_results.group_by { |r| r[:matched_type] }
               .sort_by { |type, group| -group.count }
               .first(20)
               .each do |type, group|
  puts "  #{type}: #{group.count} files"
end

puts "\nTop 20 unmatched filename patterns:"
unmatched_results = results.select { |r| r[:matched_type].nil? }
unmatched_results.group_by { |r| r[:filename].split.first(3).join(' ') } # Group by first 3 words
               .sort_by { |pattern, group| -group.count }
               .first(20)
               .each do |pattern, group|
  puts "  #{pattern}...: #{group.count} files"
end

# Export detailed results
output_path = "/tmp/sharepoint_match_analysis.csv"
CSV.open(output_path, "w") do |csv|
  csv << %w[filename folder matched_type matched_type_id match_method confidence]
  results.each do |r|
    csv << [ r[:filename], r[:folder], r[:matched_type], r[:matched_type_id],
            r[:match_method], r[:confidence] ]
  end
end

puts "\n✅ Detailed results exported to: #{output_path}"
puts "\n" + "=" * 80
