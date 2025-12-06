# frozen_string_literal: true

# Automated extraction of ALL Teacher content from TEEEM_BIBLE.md
# This script parses the Bible and extracts:
# - All code blocks (```ruby, ```javascript, ```jsx, etc.)
# - Implementation sections
# - Step-by-step guides
# - Configuration examples

require "fileutils"

bible_path = Rails.root.join("..", "TEEEM_DOCS", "TEEEM_BIBLE.md")
content = File.read(bible_path, encoding: "UTF-8")

puts "📖 Parsing TEEEM_BIBLE.md..."
puts "📄 File size: #{content.length} characters"
puts ""

# Chapter metadata mapping
CHAPTER_NAMES = {
  0 => "Overview & System-Wide Rules",
  1 => "Authentication & Users",
  2 => "System Administration",
  3 => "Contacts & Relationships",
  4 => "Price Books & Suppliers",
  5 => "Jobs & Construction Management",
  6 => "Estimates & Quoting",
  7 => "AI Plan Review",
  8 => "Purchase Orders",
  9 => "Gantt & Schedule Master",
  10 => "Project Tasks & Checklists",
  11 => "Weather & Public Holidays",
  12 => "OneDrive Integration",
  13 => "Outlook/Email Integration",
  14 => "Chat & Communications",
  15 => "Xero Accounting Integration",
  16 => "Payments & Financials",
  17 => "Workflows & Automation",
  18 => "Custom Tables & Formulas",
  19 => "UI/UX Standards & Patterns",
  20 => "Agent System & Automation"
}.freeze

# Extract chapters
chapters = content.scan(/# Chapter (\d+): (.+?)\n(.+?)(?=\n# Chapter \d+:|\z)/m)

puts "✅ Found #{chapters.length} chapters"
puts ""

total_created = 0
total_skipped = 0

chapters.each do |chapter_num_str, chapter_title, chapter_content|
  chapter_num = chapter_num_str.to_i

  # Skip if already processed (0, 1, 19)
  existing_count = Trinity.teacher_entries.where(chapter_number: chapter_num).count
  if existing_count > 0 && [ 0, 1, 19 ].include?(chapter_num)
    puts "⏭️  Chapter #{chapter_num}: #{CHAPTER_NAMES[chapter_num]} - SKIPPING (#{existing_count} entries already exist)"
    total_skipped += existing_count
    next
  end

  puts "📖 Chapter #{chapter_num}: #{CHAPTER_NAMES[chapter_num]}"

  # Extract all RULE sections with their content
  rules = chapter_content.scan(/## RULE #(\d+(?:\.\d+)?[A-Z]?): (.+?)\n(.+?)(?=\n## RULE #|\n## 🔒 Protected|\n## API Endpoints|\n---\n\n#|\z)/m)

  rules.each do |rule_num, rule_title, rule_content|
    # Skip if this is just a pure rule with no implementation
    next unless rule_content.match?(/```|Implementation:|Code location:|Pattern:/)

    # Extract code blocks
    code_blocks = rule_content.scan(/```(\w+)?\n(.+?)```/m)
    next if code_blocks.empty?

    # Combine all code blocks
    combined_code = code_blocks.map { |lang, code| code.strip }.join("\n\n# ---\n\n")

    # Extract summary from rule content (first paragraph after MUST/NEVER)
    summary_match = rule_content.match(/(?:✅ \*\*MUST.*?\n|❌ \*\*NEVER.*?\n)(.+?)(?=\n\n|\*\*|```)/m)
    summary = summary_match ? summary_match[1].strip.gsub(/\n/, " ").slice(0, 200) : rule_title

    # Determine entry type based on content
    entry_type = case rule_content
    when /Integration|OAuth|API|Webhook/ then "integration"
    when /Component|UI|Frontend|React/ then "component"
    when /Service|Backend|Database/ then "feature"
    when /Hook|useRef|useState/ then "hook"
    when /Performance|Optimization|Cache/ then "optimization"
    else "util"
    end

    # Determine difficulty
    difficulty = case rule_content
    when /CRITICAL|Advanced|Complex/ then "advanced"
    when /Beginner|Simple|Basic/ then "beginner"
    else "intermediate"
    end

    # Create entry
    entry = Trinity.find_or_initialize_by(
      chapter_number: chapter_num,
      section_number: rule_num
    )

    entry.assign_attributes(
      chapter_name: CHAPTER_NAMES[chapter_num],
      title: rule_title.strip,
      entry_type: entry_type,
      difficulty: difficulty,
      summary: summary,
      code_example: combined_code,
      related_rules: "TEEEM_BIBLE.md RULE ##{rule_num}"
    )

    if entry.save
      puts "  ✅ §#{rule_num}: #{rule_title.slice(0, 60)}"
      total_created += 1
    else
      puts "  ❌ Failed: #{entry.errors.full_messages.join(', ')}"
    end
  end

  puts ""
end

puts "=" * 60
puts "📊 EXTRACTION COMPLETE"
puts "=" * 60
puts "✅ Created: #{total_created} new Teacher entries"
puts "⏭️  Skipped: #{total_skipped} existing entries"
puts "📚 Total Teacher entries: #{Trinity.teacher_entries.count}"
puts ""
puts "Next step: bin/rails teeem:export_teacher"
