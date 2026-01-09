# Import Chapter 19 Teacher sections from TEEEM_TEACHER.md into database

teacher_file = Rails.root.join("..", "TEEEM_DOCS", "TEEEM_TEACHER.md")
content = File.read(teacher_file)

# Find Chapter 19
chapter_match = content.match(/# Chapter 19: (.+?)\n(.+?)(?=\n# Chapter|\z)/m)

unless chapter_match
  puts "❌ Chapter 19 not found in TEEEM_TEACHER.md"
  exit 1
end

chapter_name = chapter_match[1].strip
chapter_content = chapter_match[2]

puts "📖 Found Chapter 19: #{chapter_name}"

# Parse sections (§19.1, §19.2, etc.)
sections = chapter_content.scan(/## §(19\.\d+[A-Z]?): (.+?)\n(.+?)(?=\n## §|\z)/m)

puts "📝 Found #{sections.length} sections"

sections.each do |section_number, title, body|
  puts "\n  Processing §#{section_number}: #{title}"

  # Extract components from body
  entry_type_match = body.match(/🧩 (Component|Feature|Util|Hook|Integration|Optimization)/i)
  entry_type = case entry_type_match&.[](1)&.downcase
  when "component" then "component"
  when "feature" then "feature"
  when "util" then "util"
  when "hook" then "hook"
  when "integration" then "integration"
  when "optimization" then "optimization"
  else "component" # default
  end

  difficulty_match = body.match(/⭐ (Easy|Medium|Hard)/i)
  difficulty = difficulty_match&.[](1)&.downcase

  summary_match = body.match(/### Quick Summary\n(.+?)(?=\n###|\z)/m)
  summary = summary_match&.[](1)&.strip

  explanation_match = body.match(/### Step-by-Step Guide\n(.+?)(?=\n###|\z)/m)
  explanation = explanation_match&.[](1)&.strip

  code_match = body.match(/### Code Example\n```(?:jsx|ruby|javascript)?\n(.+?)```/m)
  code_example = code_match&.[](1)&.strip

  mistakes_match = body.match(/### ⚠️ Common Mistakes\n(.+?)(?=\n###|\z)/m)
  common_mistakes = mistakes_match&.[](1)&.strip

  testing_match = body.match(/### 🧪 Testing Strategy\n(.+?)(?=\n###|\z)/m)
  testing_strategy = testing_match&.[](1)&.strip

  rules_match = body.match(/\*\*📖 Related Bible Rules:\*\* (.+)/m)
  related_rules = rules_match&.[](1)&.strip

  # Create or update entry
  entry = Trinity.find_or_initialize_by(
    chapter_number: 19,
    section_number: section_number
  )

  entry.assign_attributes(
    chapter_name: chapter_name,
    title: title.strip,
    entry_type: entry_type,
    section_number: section_number,
    difficulty: difficulty,
    summary: summary,
    explanation: explanation,
    code_example: code_example,
    common_mistakes: common_mistakes,
    testing_strategy: testing_strategy,
    related_rules: related_rules
  )

  if entry.save
    puts "    ✅ Saved: §#{section_number}"
  else
    puts "    ❌ Failed: #{entry.errors.full_messages.join(', ')}"
  end
end

puts "\n✅ Import complete!"
puts "📊 Total Chapter 19 Teacher entries: #{Trinity.teacher_entries.where(chapter_number: 19).count}"
