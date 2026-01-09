# frozen_string_literal: true

# Script to import LEXICON.md bug entries into DocumentedBug table
# Usage: rails runner lib/scripts/import_lexicon.rb

class LexiconImporter
  LEXICON_PATH = Rails.root.join("../TEEEM_DOCS/TEEEM_LEXICON.md")

  def self.import
    new.import
  end

  def import
    puts "🔄 Reading LEXICON from: #{LEXICON_PATH}"
    content = File.read(LEXICON_PATH)

    puts "📖 Parsing chapters..."
    chapters = parse_chapters(content)

    puts "Found #{chapters.length} chapters"

    total_imported = 0
    chapters.each do |chapter|
      puts "\n" + "="*60
      puts "Chapter #{chapter[:number]}: #{chapter[:name]}"
      puts "="*60

      entries = parse_entries(chapter[:content], chapter[:number], chapter[:name])
      puts "Found #{entries.length} entries to import"

      entries.each do |entry_data|
        import_entry(entry_data)
        total_imported += 1
      end
    end

    puts "\n✅ Import complete! Imported #{total_imported} entries"
    puts "📊 Final stats:"
    puts "  Total bugs: #{DocumentedBug.count}"
    puts "  By type: #{DocumentedBug.group(:knowledge_type).count}"
  end

  private

  def parse_chapters(content)
    chapters = []
    lines = content.split("\n")

    lines.each_with_index do |line, index|
      # Match "# Chapter X: Name" pattern
      if line =~ /^# Chapter (\d+): (.+)$/
        chapter_num = $1.to_i
        chapter_name = $2.strip

        # Find next chapter or end of file
        next_chapter_line = lines[(index+1)..-1].find_index { |l| l =~ /^# Chapter \d+:/ }
        end_line = next_chapter_line ? index + 1 + next_chapter_line : lines.length

        chapter_content = lines[(index+1)...end_line].join("\n")

        chapters << {
          number: chapter_num,
          name: chapter_name,
          content: chapter_content
        }
      end
    end

    chapters
  end

  def parse_entries(chapter_content, chapter_number, chapter_name)
    entries = []

    # Split by "#### Issue:" or "#### Bug:" or "#### BUG-" markers
    sections = chapter_content.split(/(?=^####\s+(?:Issue:|Bug:|BUG-\d+:))/)

    sections.each do |section|
      next if section.strip.empty?
      next unless section =~ /^####\s+(?:Issue:|Bug:|BUG-\d+:)\s*(.+)/

      entry = parse_entry_section(section, chapter_number, chapter_name)
      entries << entry if entry
    end

    entries
  end

  def parse_entry_section(section, chapter_number, chapter_name)
    lines = section.split("\n")

    # Extract title from first line
    title_line = lines.first
    return nil unless title_line =~ /^####\s+(?:Issue:|Bug:|BUG-\d+:)\s*(.+)/
    title = $1.strip

    # Parse metadata
    status = extract_status(section)
    severity = extract_severity(section)
    component = extract_component(section)
    first_reported = extract_date(section, "First Reported")
    last_occurred = extract_date(section, "Last Occurred")
    fixed_date = extract_date(section, "Fixed") || extract_date(section, "Last Reported") if status == "fixed"

    # Extract content sections
    scenario = extract_section(section, "Scenario")
    root_cause = extract_section(section, "Root Cause")
    solution = extract_section(section, "Solution") || extract_section(section, "Temporary Solution")
    prevention = extract_section(section, "Prevention")

    # Build description from scenario or first paragraph
    description = scenario || lines[1..5].join("\n").strip

    # Extract details (Why It Happened, Lesson Learned, etc.)
    details = []
    details << extract_section(section, "Why It Happened")
    details << extract_section(section, "Lesson Learned")
    details << extract_section(section, "Current Stats")
    details = details.compact.join("\n\n---\n\n")
    details = nil if details.empty?

    # Extract recommendations
    recommendations = extract_section(section, "Future Enhancement") ||
                     extract_section(section, "Future Consideration")

    {
      chapter_number: chapter_number,
      chapter_name: chapter_name,
      component: component,
      bug_title: title,
      knowledge_type: "bug",
      status: status,
      severity: severity,
      first_reported: first_reported,
      last_occurred: last_occurred,
      fixed_date: fixed_date,
      scenario: scenario,
      root_cause: root_cause,
      solution: solution,
      prevention: prevention,
      description: description,
      details: details,
      recommendations: recommendations
    }
  end

  def extract_status(text)
    case text
    when /\*\*Status:\*\*\s*✅\s*(?:FIXED|RESOLVED)/i
      "fixed"
    when /\*\*Status:\*\*\s*⚠️\s*BY DESIGN/i
      "by_design"
    when /\*\*Status:\*\*\s*🔄\s*MONITORING/i
      "monitoring"
    else
      "open"
    end
  end

  def extract_severity(text)
    case text
    when /\*\*Severity:\*\*\s*Critical/i
      "critical"
    when /\*\*Severity:\*\*\s*High/i
      "high"
    when /\*\*Severity:\*\*\s*Medium/i
      "medium"
    when /\*\*Severity:\*\*\s*Low/i
      "low"
    else
      "medium"
    end
  end

  def extract_component(text)
    # Try to extract from code snippets or file paths
    if text =~ /app\/controllers\/api\/v1\/(\w+)_controller\.rb/
      $1.camelize
    elsif text =~ /app\/models\/(\w+)\.rb/
      $1.camelize
    elsif text =~ /app\/services\/(\w+)\.rb/
      $1.camelize
    else
      nil
    end
  end

  def extract_date(text, label)
    if text =~ /\*\*#{label}:\*\*\s*(\d{4}-\d{2}-\d{2})/
      $1
    end
  end

  def extract_section(text, heading)
    # Extract content under "**Heading:**" until next "**" heading or code block
    pattern = /\*\*#{heading}:\*\*\s*\n(.*?)(?=\n\*\*[A-Z]|\n```|\z)/m
    if text =~ pattern
      content = $1.strip
      return nil if content.empty?
      content
    end
  end

  def import_entry(entry_data)
    # Skip if already exists
    existing = DocumentedBug.find_by(
      chapter_number: entry_data[:chapter_number],
      bug_title: entry_data[:bug_title]
    )

    if existing
      puts "  ⏭️  Skipping (exists): #{entry_data[:bug_title]}"
      return
    end

    begin
      bug = DocumentedBug.create!(entry_data)
      puts "  ✅ Imported: #{bug.bug_title}"
    rescue => e
      puts "  ❌ Failed: #{entry_data[:bug_title]}"
      puts "     Error: #{e.message}"
    end
  end
end

# Run import
LexiconImporter.import
