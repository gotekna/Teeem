# frozen_string_literal: true

# Import Chapter 19 Teacher sections from TEEEM_TEACHER.md

teacher_file = Rails.root.join("..", "TEEEM_DOCS", "TEEEM_TEACHER.md")
content = File.read(teacher_file, encoding: "UTF-8")

# Extract Chapter 19 content
if content =~ /# Chapter 19: (.+?)\n(.+?)(?=\n# Chapter 20:|\z)/m
  chapter_name = $1.strip
  chapter_content = $2

  puts "📖 Processing Chapter 19: #{chapter_name}"

  # Split by section markers (##)
  sections = chapter_content.scan(/## §([\d\.A-Z]+): (.+?)\n(.+?)(?=\n## §|\z)/m)

  puts "📝 Found #{sections.length} sections to import"

  sections.each do |section_num, title, body|
    puts "\n  Importing §#{section_num}: #{title}"

    # Parse the body content
    entry_type = "component" # default
    difficulty = nil
    summary = nil
    explanation = nil
    code_example = nil
    common_mistakes = nil
    testing_strategy = nil
    related_rules = nil

    # Extract Bible cross-reference
    if body =~ /Bible Cross-Reference:\*\* (.+)/
      related_rules = $1.strip
    end

    # Extract Quick Start as summary
    if body =~ /### Quick Start\n(.+?)(?=\n###|\z)/m
      summary = $1.strip
    end

    # Extract Common Mistakes
    if body =~ /### Common Mistakes\n(.+?)(?=\n###|\z)/m
      common_mistakes = $1.strip
    end

    # Extract first code block as code_example
    if body =~ /```(?:jsx|javascript|ruby)?\n(.+?)```/m
      code_example = $1.strip
    end

    # Create entry
    entry = Trinity.find_or_initialize_by(
      chapter_number: 19,
      section_number: section_num
    )

    entry.assign_attributes(
      chapter_name: chapter_name,
      title: title.strip,
      entry_type: entry_type,
      difficulty: difficulty,
      summary: summary,
      code_example: code_example,
      common_mistakes: common_mistakes,
      testing_strategy: testing_strategy,
      related_rules: related_rules
    )

    if entry.save
      puts "    ✅ Saved: §#{section_num}"
    else
      puts "    ❌ Failed: #{entry.errors.full_messages.join(', ')}"
    end
  end

  puts "\n✅ Import complete!"
  puts "📊 Total Chapter 19 Teacher entries: #{Trinity.teacher_entries.where(chapter_number: 19).count}"
else
  puts "❌ Could not find Chapter 19 in TEEEM_TEACHER.md"
end
