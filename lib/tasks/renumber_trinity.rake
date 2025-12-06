namespace :trinity do
  desc "Renumber ALL Trinity entries to 3-digit format (B01.001, L01.001, T01.001)"
  task renumber_all: :environment do
    puts "🔄 Renumbering ALL Trinity entries to 3-digit format..."
    puts ""

    [ "bible", "lexicon", "teacher" ].each do |category|
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      puts "Processing #{category.upcase} entries..."
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      puts ""

      entries = Trinity.where(category: category).order(:chapter_number, :id)

      if entries.empty?
        puts "  No #{category} entries found"
        puts ""
        next
      end

      puts "  Found #{entries.count} entries"
      puts ""

      # Phase 1: Temporary numbers
      puts "  Phase 1: Assigning temporary numbers..."
      entries.each_with_index do |entry, index|
        temp_number = "TEMP-#{category[0].upcase}-#{index.to_s.rjust(5, '0')}"
        entry.update_column(:section_number, temp_number)
      end
      puts "  ✓ Assigned #{entries.count} temporary numbers"
      puts ""

      # Phase 2: Final 3-digit numbers
      prefix = case category
      when "bible" then "B"
      when "lexicon" then "L"
      when "teacher" then "T"
      end

      puts "  Phase 2: Assigning final 3-digit numbers..."
      entries.reload.group_by(&:chapter_number).each do |chapter_num, chapter_entries|
        chapter_entries.each_with_index do |entry, index|
          section_num = index + 1
          new_section_number = "#{prefix}#{chapter_num.to_s.rjust(2, '0')}.#{section_num.to_s.rjust(3, '0')}"
          entry.update_column(:section_number, new_section_number)
        end
        puts "    Chapter #{chapter_num}: #{chapter_entries.length} entries"
      end

      puts ""
      puts "  ✅ #{category.capitalize} renumbering complete!"
      puts ""
    end

    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts "✅ ALL CATEGORIES RENUMBERED TO 3-DIGIT FORMAT!"
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts ""

    # Show summary
    puts "Summary:"
    [ "bible", "lexicon", "teacher" ].each do |category|
      count = Trinity.where(category: category).count
      first = Trinity.where(category: category).order(:section_number).first
      last = Trinity.where(category: category).order(:section_number).last

      if first && last
        puts "  #{category.upcase}: #{count} entries (#{first.section_number} to #{last.section_number})"
      else
        puts "  #{category.upcase}: #{count} entries"
      end
    end
  end
  desc "Renumber all Trinity Bible entries sequentially as B01.01, B01.02, etc."
  task renumber_bible: :environment do
    puts "🔄 Renumbering Trinity Bible entries..."
    puts ""

    # Get all Bible entries, sorted by chapter_number, then by ID to maintain order
    bible_entries = Trinity.bible_entries.order(:chapter_number, :id)

    puts "Found #{bible_entries.count} Bible entries"
    puts ""

    if bible_entries.empty?
      puts "❌ No Bible entries found!"
      exit 1
    end

    # Show first 10 current entries
    puts "Current numbering (first 10):"
    bible_entries.limit(10).each do |entry|
      puts "  #{(entry.section_number || '(blank)').ljust(10)} - #{entry.title[0...50]}"
    end
    puts ""

    print "Do you want to renumber all #{bible_entries.count} entries sequentially? (yes/no): "
    response = STDIN.gets.chomp.downcase

    unless response == "yes"
      puts "❌ Cancelled"
      exit 0
    end

    puts ""
    puts "🚀 Starting renumbering..."
    puts ""

    # Renumber sequentially: B01.01, B01.02, B01.03, ...
    # Use a two-phase approach to avoid uniqueness constraint violations:
    # Phase 1: Assign temporary numbers (TEMP-XX.YY)
    # Phase 2: Assign final numbers (BXX.YY)

    puts "Phase 1: Assigning temporary numbers..."
    bible_entries.each_with_index do |entry, global_index|
      temp_number = "TEMP-#{global_index.to_s.rjust(5, '0')}"
      entry.update_column(:section_number, temp_number)
    end
    puts "  ✓ Assigned #{bible_entries.count} temporary numbers"
    puts ""

    puts "Phase 2: Assigning final numbers..."
    # Group by chapter and renumber within each chapter
    bible_entries.reload.group_by(&:chapter_number).each do |chapter_num, chapter_entries|
      chapter_entries.each_with_index do |entry, index|
        section_num = index + 1
        # Use 3-digit format to support 100+ sections per chapter
        new_section_number = "B#{chapter_num.to_s.rjust(2, '0')}.#{section_num.to_s.rjust(3, '0')}"

        entry.update_column(:section_number, new_section_number)
      end
      puts "  Chapter #{chapter_num}: Renumbered #{chapter_entries.length} entries"
    end

    puts ""
    puts "✅ Renumbering complete!"
    puts ""

    # Reload and show results
    bible_entries.reload

    # Show first 10 new entries
    puts "New numbering (first 10):"
    bible_entries.limit(10).each do |entry|
      puts "  #{entry.section_number.ljust(10)} - #{entry.title[0...50]}"
    end
    puts ""
    puts "Last 3 entries:"
    bible_entries.last(3).each do |entry|
      puts "  #{entry.section_number.ljust(10)} - #{entry.title[0...50]}"
    end
  end

  desc "Assign section numbers to entries that are missing them"
  task assign_missing_sections: :environment do
    puts "🔍 Looking for entries missing section numbers..."
    puts ""

    # Find entries with blank/nil section_number but valid titles
    missing_sections = Trinity.where("section_number IS NULL OR section_number = ''").where.not("title IS NULL OR title = ''")

    puts "Found #{missing_sections.count} entries missing section numbers"
    puts ""

    if missing_sections.empty?
      puts "✅ All entries have section numbers!"
      next
    end

    # Group by category
    by_category = missing_sections.group_by(&:category)

    by_category.each do |category, entries|
      puts "#{category.upcase}: #{entries.count} entries"
    end
    puts ""

    # Assign section numbers to each category
    by_category.each do |category, entries|
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      puts "Processing #{category.upcase} entries..."
      puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      puts ""

      # Get the highest existing section number for this category
      prefix = case category
      when "bible" then "B"
      when "lexicon" then "L"
      when "teacher" then "T"
      else "X"
      end

      # Find max section in this category
      max_section = Trinity.where(category: category)
                           .where.not("section_number IS NULL OR section_number = ''")
                           .pluck(:section_number)
                           .map { |sn| sn.match(/(\d+)\.(\d+)$/) }
                           .compact
                           .map { |m| m[2].to_i }
                           .max || 0

      puts "Current max section for #{category}: #{max_section}"
      puts "Will assign sections starting from #{prefix}01.#{(max_section + 1).to_s.rjust(2, '0')}"
      puts ""

      # Assign sequential numbers
      entries.each_with_index do |entry, index|
        section_num = max_section + index + 1
        new_section_number = "#{prefix}01.#{section_num.to_s.rjust(2, '0')}"

        entry.update_column(:section_number, new_section_number)
        puts "  #{new_section_number} - #{entry.title[0...60]}"
      end

      puts ""
    end

    puts "✅ Section number assignment complete!"
  end

  desc "Remove blank Trinity entries (entries with no title and no section)"
  task remove_blanks: :environment do
    puts "🔍 Looking for completely blank Trinity entries..."

    blank_entries = Trinity.where("(title IS NULL OR title = '') AND (section_number IS NULL OR section_number = '')")

    puts "Found #{blank_entries.count} blank entries"

    if blank_entries.count > 0
      puts ""
      blank_entries.each do |entry|
        puts "  ID: #{entry.id} | Category: #{entry.category}"
      end
      puts ""

      puts "These entries have no title and no section number - safe to delete."
      puts "Delete these #{blank_entries.count} entries? (yes/no - will not prompt interactively in rake)"
      blank_entries.destroy_all
      puts "✅ Deleted #{blank_entries.count} blank entries"
    else
      puts "✅ No blank entries found"
    end
  end

  desc "Regenerate dense index for all Trinity entries (updates section numbers to 3-digit format)"
  task regenerate_dense_index: :environment do
    puts "🔄 Regenerating dense index for all Trinity entries..."
    puts ""

    total_count = Trinity.count
    puts "Found #{total_count} entries"
    puts ""

    if total_count == 0
      puts "❌ No entries found!"
      exit 0
    end

    puts "This will trigger the before_save callback to rebuild dense_index with new 3-digit section numbers"
    puts ""
    puts "🚀 Starting regeneration..."
    puts ""

    processed = 0
    Trinity.find_each(batch_size: 50) do |entry|
      # Calling save without changes will still trigger callbacks
      # Use touch to update updated_at and trigger callbacks
      entry.save(touch: false)

      processed += 1
      if processed % 50 == 0
        puts "  Processed #{processed}/#{total_count}..."
      end
    end

    puts ""
    puts "✅ Dense index regeneration complete!"
    puts "   Processed #{processed} entries"
    puts ""

    # Show a few examples
    puts "Sample dense index entries (first 3):"
    Trinity.limit(3).each do |entry|
      dense_preview = entry.dense_index.to_s[0...80]
      puts "  #{entry.section_number} - #{dense_preview}..."
    end
  end
end
