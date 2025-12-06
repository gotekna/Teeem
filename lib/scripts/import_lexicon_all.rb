# frozen_string_literal: true

# Enhanced script to import ALL LEXICON entries (bugs + architecture + tests + etc.)
# Usage: rails runner lib/scripts/import_lexicon_all.rb

class LexiconImporterAll
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

      # Parse both bug entries (####) and knowledge entries (###)
      bug_entries = parse_bug_entries(chapter[:content], chapter[:number], chapter[:name])
      knowledge_entries = parse_knowledge_entries(chapter[:content], chapter[:number], chapter[:name])

      all_entries = bug_entries + knowledge_entries
      puts "Found #{all_entries.length} entries (#{bug_entries.length} bugs, #{knowledge_entries.length} knowledge)"

      all_entries.each do |entry_data|
        import_entry(entry_data)
        total_imported += 1
      end
    end

    puts "\n✅ Import complete! Imported #{total_imported} entries"
    puts "📊 Final stats:"
    puts "  Total entries: #{DocumentedBug.count}"
    puts "  By type: #{DocumentedBug.group(:knowledge_type).count}"
  end

  private

  def parse_chapters(content)
    chapters = []
    lines = content.split("\n")

    lines.each_with_index do |line, index|
      if line =~ /^# Chapter (\d+): (.+)$/
        chapter_num = $1.to_i
        chapter_name = $2.strip

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

  def parse_bug_entries(chapter_content, chapter_number, chapter_name)
    entries = []
    sections = chapter_content.split(/(?=^####\s+(?:Issue:|Bug:|BUG-\d+:))/)

    sections.each do |section|
      next if section.strip.empty?
      next unless section =~ /^####\s+(?:Issue:|Bug:|BUG-\d+:)\s*(.+)/

      entry = parse_bug_section(section, chapter_number, chapter_name)
      entries << entry if entry
    end

    entries
  end

  def parse_knowledge_entries(chapter_content, chapter_number, chapter_name)
    entries = []

    # Look for specific knowledge section markers
    if chapter_content =~ /## 🏗️ Architecture & Implementation(.+?)(?=^##|\z)/m
      arch_section = $1
      entries += extract_architecture_entries(arch_section, chapter_number, chapter_name)
    end

    if chapter_content =~ /## 📊 Test Catalog(.+?)(?=^##|\z)/m
      test_section = $1
      entries += extract_test_entries(test_section, chapter_number, chapter_name)
    end

    entries
  end

  def extract_architecture_entries(section, chapter_number, chapter_name)
    entries = []
    # Split by ### headings (level 3)
    subsections = section.split(/(?=^###\s+)/)

    subsections.each do |subsection|
      next if subsection.strip.empty?
      next unless subsection =~ /^###\s+(.+)/

      title = $1.strip
      next if title =~ /^(Known Issues|Bug Hunter)/i # Skip bug sections

      # Extract description (first few paragraphs)
      lines = subsection.split("\n")[1..-1] || []
      description = lines.take_while { |l| !l.match?(/^\*\*/) && l.strip != "" }.join("\n").strip
      description = lines[0..10].join("\n") if description.empty?

      # Extract details (everything after description)
      details = subsection.split("\n")[1..-1].join("\n").strip

      entries << {
        chapter_number: chapter_number,
        chapter_name: chapter_name,
        component: nil,
        bug_title: title,
        knowledge_type: "architecture",
        status: nil,
        severity: nil,
        first_reported: nil,
        last_occurred: nil,
        fixed_date: nil,
        scenario: nil,
        root_cause: nil,
        solution: nil,
        prevention: nil,
        description: description[0..500], # Truncate for summary
        details: details,
        recommendations: nil
      }
    end

    entries
  end

  def extract_test_entries(section, chapter_number, chapter_name)
    entries = []
    subsections = section.split(/(?=^###\s+)/)

    subsections.each do |subsection|
      next if subsection.strip.empty?
      next unless subsection =~ /^###\s+(.+)/

      title = $1.strip

      lines = subsection.split("\n")[1..-1] || []
      description = lines[0..5].join("\n").strip
      details = subsection.split("\n")[1..-1].join("\n").strip

      entries << {
        chapter_number: chapter_number,
        chapter_name: chapter_name,
        component: nil,
        bug_title: title,
        knowledge_type: "test",
        status: nil,
        severity: nil,
        first_reported: nil,
        last_occurred: nil,
        fixed_date: nil,
        scenario: nil,
        root_cause: nil,
        solution: nil,
        prevention: nil,
        description: description[0..500],
        details: details,
        recommendations: nil
      }
    end

    entries
  end

  def parse_bug_section(section, chapter_number, chapter_name)
    lines = section.split("\n")

    title_line = lines.first
    return nil unless title_line =~ /^####\s+(?:Issue:|Bug:|BUG-\d+:)\s*(.+)/
    title = $1.strip

    status = extract_status(section)
    severity = extract_severity(section)
    component = extract_component(section)
    first_reported = extract_date(section, "First Reported")
    last_occurred = extract_date(section, "Last Occurred")
    fixed_date = extract_date(section, "Fixed") || extract_date(section, "Last Reported") if status == "fixed"

    scenario = extract_section(section, "Scenario")
    root_cause = extract_section(section, "Root Cause")
    solution = extract_section(section, "Solution") || extract_section(section, "Temporary Solution")
    prevention = extract_section(section, "Prevention")

    description = scenario || lines[1..5].join("\n").strip

    details = []
    details << extract_section(section, "Why It Happened")
    details << extract_section(section, "Lesson Learned")
    details << extract_section(section, "Current Stats")
    details = details.compact.join("\n\n---\n\n")
    details = nil if details.empty?

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
    pattern = /\*\*#{heading}:\*\*\s*\n(.*?)(?=\n\*\*[A-Z]|\n```|\z)/m
    if text =~ pattern
      content = $1.strip
      return nil if content.empty?
      content
    end
  end

  def import_entry(entry_data)
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
      type_label = entry_data[:knowledge_type] == "bug" ? "🐛" : (entry_data[:knowledge_type] == "architecture" ? "🏗️" : "📊")
      puts "  ✅ Imported #{type_label}: #{bug.bug_title}"
    rescue => e
      puts "  ❌ Failed: #{entry_data[:bug_title]}"
      puts "     Error: #{e.message}"
    end
  end
end

# Run import
LexiconImporterAll.import
