# frozen_string_literal: true

namespace :teeem do
  desc "Import Bible rules from TEEEM_BIBLE.md into database"
  task import_bible: :environment do
    bible_path = Rails.root.join("..", "TEEEM_DOCS", "TEEEM_BIBLE.md")

    unless File.exist?(bible_path)
      puts "❌ Error: TEEEM_BIBLE.md not found at #{bible_path}"
      exit 1
    end

    content = File.read(bible_path)

    # Chapter name mapping
    chapter_names = {
      0 => "System-Wide Rules",
      1 => "Authentication",
      2 => "System Admin",
      3 => "Contacts",
      4 => "Price Books",
      5 => "Jobs",
      6 => "Estimates",
      7 => "AI Plan Review",
      8 => "Purchase Orders",
      9 => "Gantt",
      10 => "Tasks",
      11 => "Weather",
      12 => "OneDrive",
      13 => "Outlook",
      14 => "Chat",
      15 => "Xero",
      16 => "Payments",
      17 => "Workflows",
      18 => "Custom Tables",
      19 => "UI/UX",
      20 => "Agents",
      21 => "Agent System & Automation"
    }

    imported_count = 0
    skipped_count = 0
    current_chapter = 0

    puts "\n📖 Importing Bible rules from TEEEM_BIBLE.md..."
    puts "=" * 60

    # Find all rules with their content
    content.scan(/^## RULE #([\d.A-Z]+):\s*(.+?)$\n(.*?)(?=^## RULE #|^# Chapter \d+:|^---\n\n#|\z)/m) do |rule_number, title, body|
      # Determine chapter number from rule_number (e.g., "19.1" -> 19, "0" -> 0)
      chapter_num = if rule_number.include?(".")
                      rule_number.split(".").first.to_i
      elsif rule_number == "X.Y" || rule_number.match?(/[A-Z]/)
                      next  # Skip template rules
      else
                      rule_number.to_i
      end

      # Check if we have a mapping for this chapter
      unless chapter_names.key?(chapter_num)
        puts "  ⚠️  Warning: Unknown chapter #{chapter_num} for RULE ##{rule_number}, skipping"
        next
      end

      # Update current chapter tracker
      if current_chapter != chapter_num
        current_chapter = chapter_num
        puts "\n📍 Processing Chapter #{chapter_num}: #{chapter_names[chapter_num]}"
      end

      title = title.strip
      body = body.strip

      # Extract rule type from body
      rule_type = nil
      if body.match?(/✅.*MUST/)
        rule_type = "MUST"
      elsif body.match?(/❌.*NEVER/)
        rule_type = "NEVER"
      elsif body.match?(/🔄.*ALWAYS/)
        rule_type = "ALWAYS"
      elsif body.match?(/🔒.*PROTECTED/)
        rule_type = "PROTECTED"
      elsif body.match?(/⚙️.*CONFIG/)
        rule_type = "CONFIG"
      end

      # Extract code examples (triple backtick blocks)
      code_examples = body.scan(/```[\w]*\n(.*?)```/m).flatten.join("\n\n---\n\n")

      # Extract cross-references
      cross_refs = body.scan(/(?:See|Ref|Reference):\s*(.+?)$/m).flatten.join("\n")

      # Clean description (remove code blocks for main description)
      description = body.gsub(/```[\w]*\n.*?```/m, "[Code example - see code_example field]").strip

      # Check if rule already exists
      existing_rule = Trinity.bible_entries.find_by(chapter_number: chapter_num, section_number: rule_number)

      if existing_rule
        puts "  ⏭️  Skipping RULE ##{rule_number} (already exists)"
        skipped_count += 1
      else
        begin
          Trinity.create!(
            category: "bible",
            chapter_number: chapter_num,
            chapter_name: chapter_names[chapter_num],
            section_number: rule_number,
            title: title,
            entry_type: rule_type || "rule",
            description: description,
            code_example: code_examples.presence,
            related_rules: cross_refs.presence
          )
          puts "  ✅ Imported RULE ##{rule_number}: #{title.truncate(60)}"
          imported_count += 1
        rescue ActiveRecord::RecordInvalid => e
          puts "  ❌ Error importing RULE ##{rule_number}: #{e.message}"
        end
      end
    end

    puts "\n" + "=" * 60
    puts "✅ Import complete!"
    puts "   Imported: #{imported_count} rules"
    puts "   Skipped:  #{skipped_count} rules (already existed)"
    puts "   Total:    #{Trinity.bible_entries.count} rules in database"
    puts "=" * 60
  end

  desc "Export Bible rules from database to TEEEM_BIBLE.md"
  task export_bible: :environment do
    bible_path = Rails.root.join("..", "TEEEM_DOCS", "TEEEM_BIBLE.md")

    puts "\n📖 Exporting Bible rules to TEEEM_BIBLE.md..."
    puts "=" * 60

    # Generate markdown content
    content = <<~HEADER
      # TEEEM BIBLE - Development Rules

      **Version:** 2.0.0
      **Last Updated:** #{Time.current.strftime("%Y-%m-%d %H:%M %Z")}
      **Authority Level:** ABSOLUTE
      **Audience:** Claude Code + Human Developers
      **Source of Truth:** Database table `bible_rules` (this file is auto-generated)

      ---

      ## 🔴 CRITICAL: Read This First

      ### This Document is "The Bible"

      This file is the **absolute authority** for all TEEEM development where chapters exist.

      **This Bible Contains RULES ONLY:**
      - ✅ MUST do this
      - ❌ NEVER do that
      - 🔄 ALWAYS check X before Y
      - 🔒 Protected code patterns
      - ⚙️ Configuration values that must match

      **This file is AUTO-GENERATED from the database.**
      - **DO NOT edit this file directly**
      - Update rules via TEEEM app → Documentation page → 📖 Bible
      - Export to markdown via: `bin/rails teeem:export_bible`

      **For IMPLEMENTATION PATTERNS (code examples, how-to guides):**
      - 🔧 See [TEEEM_TEACHER.md](TEEEM_TEACHER.md)

      **For KNOWLEDGE (how things work, bug history, why we chose X):**
      - 📕 See [TEEEM_LEXICON.md](TEEEM_LEXICON.md)

      **For USER GUIDES (how to use features):**
      - 📘 See [TEEEM_USER_MANUAL.md](TEEEM_USER_MANUAL.md)

      ---

    HEADER

    # Group rules by chapter (0-21 to include Agent System chapter)
    (0..21).each do |chapter_num|
      rules = Trinity.bible_entries.by_chapter(chapter_num).ordered
      next if rules.empty?

      chapter_name = rules.first.chapter_name

      puts "📍 Exporting Chapter #{chapter_num}: #{chapter_name}"

      content += <<~CHAPTER
        # Chapter #{chapter_num}: #{chapter_name}

        **Last Updated:** #{rules.maximum(:updated_at).strftime("%Y-%m-%d %H:%M %Z")}

      CHAPTER

      rules.each do |rule|
        # Ultra-lean format: No emojis, minimal formatting
        content += "## #{rule.section_display}: #{rule.title}\n\n" if rule.section_number.present?
        content += "## #{rule.title}\n\n" unless rule.section_number.present?

        # Type without emoji (e.g., "MUST:" instead of "✅ MUST")
        content += "#{rule.entry_type.upcase}:\n" if rule.entry_type.present?

        # Content without extra blank lines or bold formatting
        content += "#{rule.summary}\n\n" if rule.summary.present?
        content += "#{rule.description}\n\n" if rule.description.present?
        content += "#{rule.details}\n\n" if rule.details.present?
      end
    end

    # Write to file
    File.write(bible_path, content)

    puts "\n" + "=" * 60
    puts "✅ Export complete!"
    puts "   File: #{bible_path}"
    puts "   Rules exported: #{Trinity.bible_entries.count}"
    puts "=" * 60
  end

  desc "Clear all Bible rules from database (WARNING: destructive)"
  task clear_bible: :environment do
    print "⚠️  WARNING: This will delete ALL Bible rules from the database. Continue? (y/N): "
    confirmation = STDIN.gets.chomp

    if confirmation.downcase == "y"
      count = Trinity.bible_entries.count
      Trinity.bible_entries.destroy_all
      puts "✅ Deleted #{count} Bible rules"
    else
      puts "❌ Cancelled"
    end
  end
end
