# Preview v2 - Use Document Type aliases for classification
job = Job.find(69)
puts "=== PREVIEW v2: LEGACY FILES FOR JOB 69 ==="
puts "Job: #{job.title}"
puts ""

# Load document types with aliases
doc_types = DocumentType.where(scope: [ "job", "both" ]).where.not(aliases: nil)
puts "Loaded #{doc_types.count} document types with aliases"
puts ""

# Build classification function from document types
def classify_with_doc_types(filename, doc_types)
  name = filename.downcase

  # First check by file extension
  ext = File.extname(filename).downcase

  # Extension-based matching
  doc_types.each do |dt|
    next unless dt.file_extensions.present?
    if dt.file_extensions.include?(ext)
      # For common extensions like .pdf, check aliases too
      if [ ".pdf", ".xlsx", ".docx" ].include?(ext)
        # Need alias match for common extensions
        next unless dt.aliases.present?
        if dt.aliases.any? { |a| name.include?(a.downcase) }
          return { folder: dt.target_folder, type: dt.abbreviation, reason: "Alias match: #{dt.name}" }
        end
      else
        # Unique extensions (like .rvt, .dwg) - match directly
        return { folder: dt.target_folder, type: dt.abbreviation, reason: "Extension: #{ext}" }
      end
    end
  end

  # Alias-based matching (for files without extension match)
  doc_types.each do |dt|
    next unless dt.aliases.present?
    if dt.aliases.any? { |a| name.include?(a.downcase) }
      return { folder: dt.target_folder, type: dt.abbreviation, reason: "Alias match: #{dt.name}" }
    end
  end

  # Fallback patterns for common file types
  return { folder: "06 Photo/01 SITE", type: "PHOTO", reason: "Image file" } if name.match?(/\.(jpg|jpeg|png|heic)$/i)
  return { folder: "06 Photo/01 SITE", type: "VIDEO", reason: "Video file" } if name.match?(/\.(mp4|mov|lrf|srt)$/i)

  # Default - unclassified
  { folder: "01 Sales", type: "REVIEW", reason: "** NEEDS MANUAL REVIEW **", needs_review: true }
end

# Get legacy files
service = JobDocumentMigrationService.new
files = service.list_legacy_files_for_job(job)
puts "Found #{files.length} legacy files"
puts ""

# Group files by suggested folder
by_folder = Hash.new { |h, k| h[k] = [] }
needs_review = []

files.each do |file|
  classification = classify_with_doc_types(file[:name], doc_types)
  size_mb = (file[:size].to_f / 1024 / 1024).round(2)

  entry = {
    name: file[:name],
    size: size_mb,
    type: classification[:type],
    reason: classification[:reason]
  }

  if classification[:needs_review]
    needs_review << entry
  else
    by_folder[classification[:folder]] << entry
  end
end

# Print summary first
puts "=" * 60
puts "SUMMARY"
puts "=" * 60
puts "Total files: #{files.length}"
puts "Auto-classified: #{files.length - needs_review.length}"
puts "Needs review: #{needs_review.length}"
puts ""
puts "By folder:"
by_folder.keys.sort.each do |folder|
  puts "  #{folder}: #{by_folder[folder].length}"
end
if needs_review.any?
  puts "  01 Sales (needs review): #{needs_review.length}"
end
puts ""

# Print needs review files (what we care about)
if needs_review.any?
  puts "=" * 60
  puts "** NEEDS MANUAL REVIEW ** (#{needs_review.length} files)"
  puts "=" * 60
  needs_review.each do |f|
    puts "  #{f[:name]} (#{f[:size]} MB)"
  end
  puts ""
end
