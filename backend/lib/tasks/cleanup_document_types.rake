namespace :document_types do
  # Helper to perform the cleanup logic
  def self.cleanup_file_name(file_name, clean_name, abbrev)
    return file_name if file_name.blank?

    result = file_name.dup

    # Strategy: Replace the EXACT full name as a complete segment
    # Only replace if it appears as a standalone segment (surrounded by spaces, braces, or string boundaries)
    if clean_name.present? && clean_name.length > 3
      escaped_name = Regexp.escape(clean_name)
      # Match the full name as a complete word/segment
      name_regex = /(?<=\s|^|\})#{escaped_name}(?=\s|$|\{)/i
      result = result.gsub(name_regex, "{DocTypeName}")
    end

    # Replace abbreviation only if it's a standalone word (2+ chars)
    # and NOT already inside braces
    if abbrev.present? && abbrev.length >= 2
      escaped_abbrev = Regexp.escape(abbrev)
      # Match abbreviation as standalone word, not inside curly braces
      abbrev_regex = /(?<!\{)(?<=\s|^)#{escaped_abbrev}(?=\s|$)(?!\})/i
      result = result.gsub(abbrev_regex, "{DocTypeCode}")
    end

    result
  end

  desc "Clean up legacy hardcoded text in file_name and display_name, replace with placeholders"
  task cleanup_legacy: :environment do
    puts "Cleaning up legacy document type naming patterns..."
    puts "=" * 60

    updated_count = 0
    skipped_count = 0

    DocumentType.find_each do |doc_type|
      name = doc_type.name || ""
      abbrev = doc_type.abbreviation || ""

      # Get clean name without prefix (e.g., "ASIC Form 484" from "484 - ASIC Form 484")
      clean_name = if name.include?(" - ")
                     name.split(" - ")[1..-1].join(" - ")
      else
                     name
      end

      original_file_name = doc_type.file_name || ""
      original_display_name = doc_type.ui_name || ""

      file_name = cleanup_file_name(original_file_name, clean_name, abbrev)
      display_name = cleanup_file_name(original_display_name, clean_name, abbrev)

      # Check if anything changed
      if file_name != original_file_name || display_name != original_display_name
        puts "\n#{doc_type.id}: #{doc_type.name}"

        if file_name != original_file_name
          puts "  file_name:"
          puts "    FROM: #{original_file_name}"
          puts "    TO:   #{file_name}"
        end

        if display_name != original_display_name
          puts "  display_name:"
          puts "    FROM: #{original_display_name}"
          puts "    TO:   #{display_name}"
        end

        doc_type.update!(
          file_name: file_name,
          ui_name: display_name
        )
        updated_count += 1
      else
        skipped_count += 1
      end
    end

    puts "\n" + "=" * 60
    puts "Done! Updated: #{updated_count}, Skipped (no changes): #{skipped_count}"
  end

  desc "Preview what cleanup_legacy would change (dry run)"
  task cleanup_legacy_preview: :environment do
    puts "PREVIEW MODE - No changes will be saved"
    puts "Checking legacy document type naming patterns..."
    puts "=" * 60

    would_update = 0
    no_changes = 0

    DocumentType.find_each do |doc_type|
      name = doc_type.name || ""
      abbrev = doc_type.abbreviation || ""

      clean_name = if name.include?(" - ")
                     name.split(" - ")[1..-1].join(" - ")
      else
                     name
      end

      original_file_name = doc_type.file_name || ""
      original_display_name = doc_type.ui_name || ""

      file_name = cleanup_file_name(original_file_name, clean_name, abbrev)
      display_name = cleanup_file_name(original_display_name, clean_name, abbrev)

      if file_name != original_file_name || display_name != original_display_name
        puts "\n#{doc_type.id}: #{doc_type.name} (abbrev: #{abbrev})"

        if file_name != original_file_name
          puts "  file_name:"
          puts "    FROM: #{original_file_name}"
          puts "    TO:   #{file_name}"
        end

        if display_name != original_display_name
          puts "  display_name:"
          puts "    FROM: #{original_display_name}"
          puts "    TO:   #{display_name}"
        end

        would_update += 1
      else
        no_changes += 1
      end
    end

    puts "\n" + "=" * 60
    puts "PREVIEW COMPLETE"
    puts "Would update: #{would_update}"
    puts "No changes needed: #{no_changes}"
    puts "\nRun 'rails document_types:cleanup_legacy' to apply changes"
  end
end
