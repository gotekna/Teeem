namespace :document_types do
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

      file_name = doc_type.file_name || ""
      display_name = doc_type.display_name || ""

      original_file_name = file_name.dup
      original_display_name = display_name.dup

      # Replace hardcoded document type name with placeholder (case insensitive)
      if clean_name.present? && clean_name.length > 2
        # Escape special regex characters
        escaped_name = Regexp.escape(clean_name)
        name_regex = /#{escaped_name}/i

        file_name = file_name.gsub(name_regex, '{DocTypeName}')
        display_name = display_name.gsub(name_regex, '{DocTypeName}')
      end

      # Replace hardcoded abbreviation with placeholder
      # Only if it's a standalone word (not inside braces)
      if abbrev.present? && abbrev.length >= 2
        escaped_abbrev = Regexp.escape(abbrev)
        # Match abbreviation as a word boundary, not inside curly braces
        abbrev_regex = /(?<!\{)\b#{escaped_abbrev}\b(?!\})/i

        file_name = file_name.gsub(abbrev_regex, '{DocTypeCode}')
        display_name = display_name.gsub(abbrev_regex, '{DocTypeCode}')
      end

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
          display_name: display_name
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

      file_name = doc_type.file_name || ""
      display_name = doc_type.display_name || ""

      original_file_name = file_name.dup
      original_display_name = display_name.dup

      if clean_name.present? && clean_name.length > 2
        escaped_name = Regexp.escape(clean_name)
        name_regex = /#{escaped_name}/i
        file_name = file_name.gsub(name_regex, '{DocTypeName}')
        display_name = display_name.gsub(name_regex, '{DocTypeName}')
      end

      if abbrev.present? && abbrev.length >= 2
        escaped_abbrev = Regexp.escape(abbrev)
        abbrev_regex = /(?<!\{)\b#{escaped_abbrev}\b(?!\})/i
        file_name = file_name.gsub(abbrev_regex, '{DocTypeCode}')
        display_name = display_name.gsub(abbrev_regex, '{DocTypeCode}')
      end

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
