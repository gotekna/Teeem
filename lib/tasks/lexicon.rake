# frozen_string_literal: true

namespace :trapid do
  desc 'Import documentation entries from JSON file'
  task import_docs: :environment do
    puts '📥 Importing documentation entries from JSON...'

    json_path = Rails.root.join('tmp', 'documentation_entries.json')
    unless File.exist?(json_path)
      puts '❌ File not found: tmp/documentation_entries.json'
      puts 'Run: bin/rails trapid:export_docs first'
      exit 1
    end

    data = JSON.parse(File.read(json_path))

    puts "Found #{data.length} entries to import"
    imported = 0
    skipped = 0

    data.each do |attrs|
      # Remove id and timestamps to let Rails handle them
      attrs.delete('id')
      created_at = attrs.delete('created_at')
      updated_at = attrs.delete('updated_at')

      entry = Trinity.find_or_initialize_by(
        chapter_number: attrs['chapter_number'],
        section_number: attrs['section_number']
      )

      if entry.persisted?
        skipped += 1
        next
      end

      entry.assign_attributes(attrs)
      entry.created_at = created_at if created_at
      entry.updated_at = updated_at if updated_at

      if entry.save
        imported += 1
      else
        puts "❌ Failed to import: #{entry.title} - #{entry.errors.full_messages.join(', ')}"
      end
    end

    puts "✅ Import complete!"
    puts "   Imported: #{imported}"
    puts "   Skipped (duplicates): #{skipped}"
    puts "   Total in database: #{Trinity.count}"
  end

  desc 'Export documentation entries to JSON file'
  task export_docs: :environment do
    puts '📤 Exporting documentation entries to JSON...'

    data = Trinity.all.map(&:attributes)

    json_path = Rails.root.join('tmp', 'documentation_entries.json')
    File.write(json_path, JSON.pretty_generate(data))

    puts "✅ Export complete: tmp/documentation_entries.json"
    puts "   Total entries: #{data.length}"
  end

  desc 'Export Lexicon database to TRAPID_LEXICON.md'
  task export_lexicon: :environment do
    puts '📕 Exporting Lexicon database to markdown...'

    # Build markdown content
    content = []

    # Header
    content << '# TRAPID LEXICON - Bug History & Knowledge Base'
    content << ''
    content << '**Version:** 1.0.0'
    content << "**Last Updated:** #{Time.current.strftime('%Y-%m-%d %H:%M %Z')}"
    content << '**Authority Level:** Reference (supplements Bible)'
    content << '**Audience:** Claude Code + Human Developers'
    content << ''
    content << '---'
    content << ''
    content << '## 🔴 CRITICAL: Read This First'
    content << ''
    content << '### This Document is "The Lexicon"'
    content << ''
    content << 'This file is the **knowledge base** for all Trapid development.'
    content << ''
    content << '**This Lexicon Contains KNOWLEDGE ONLY:**'
    content << '- 🐛 Bug history (what went wrong, how we fixed it)'
    content << '- 🏛️ Architecture decisions (why we chose X over Y)'
    content << '- 📊 Test catalog (what tests exist, what\'s missing)'
    content << '- 🔍 Known gaps (what needs to be built)'
    content << ''
    content << '**For RULES (MUST/NEVER/ALWAYS):**'
    content << '- 📖 See [TRAPID_BIBLE.md](TRAPID_BIBLE.md)'
    content << ''
    content << '**For USER GUIDES (how to use features):**'
    content << '- 📘 See [TRAPID_USER_MANUAL.md](TRAPID_USER_MANUAL.md)'
    content << ''
    content << '---'
    content << ''
    content << '## 💾 Database-Driven Lexicon'
    content << ''
    content << '**IMPORTANT:** This file is auto-generated from the `trinity` database table.'
    content << ''
    content << '**To edit entries:**'
    content << '1. Go to Documentation page in Trapid'
    content << '2. Click "📕 TRAPID Lexicon"'
    content << '3. Use the UI to add/edit/delete entries'
    content << '4. Run `rake trapid:export_lexicon` to update this file'
    content << ''
    content << '**Single Source of Truth:** Database (not this file)'
    content << ''
    content << '---'
    content << ''
    content << '## Table of Contents'
    content << ''

    # Get all chapters (only from Lexicon entries)
    chapters = Trinity.lexicon_entries
                      .select(:chapter_number, :chapter_name)
                      .distinct
                      .order(:chapter_number)

    chapters.each do |chapter|
      content << "- [Chapter #{chapter.chapter_number}: #{chapter.chapter_name}](#chapter-#{chapter.chapter_number}-#{chapter.chapter_name.downcase.gsub(/[^a-z0-9]+/, '-')})"
    end

    content << ''
    content << '---'
    content << ''

    # Generate content for each chapter
    chapters.each do |chapter|
      content << ''
      content << "# Chapter #{chapter.chapter_number}: #{chapter.chapter_name}"
      content << ''
      content << "**Last Updated:** #{Time.current.strftime('%Y-%m-%d')}"
      content << ''

      # Get Lexicon entries for this chapter only
      entries = Trinity.lexicon_entries
                       .where(chapter_number: chapter.chapter_number)
                       .order(:entry_type, :created_at)

      # Group by entry_type
      bugs = entries.where(entry_type: 'bug')
      architecture = entries.where(entry_type: 'architecture')
      tests = entries.where(entry_type: 'test')
      performance = entries.where(entry_type: 'performance')
      dev_notes = entries.where(entry_type: 'dev_note')
      common_issues = entries.where(entry_type: 'common_issue')

      # Bug Hunter section
      if bugs.any?
        content << '## 🐛 Bug Hunter'
        content << ''

        bugs.each do |bug|
          status_emoji = case bug.status
                        when 'active' then '🔴'
                        when 'resolved' then '✅'
                        when 'monitoring' then '🔄'
                        when 'by_design' then '⚠️'
                        else '⚡'
                        end

          content << "### #{status_emoji} #{bug.title}"
          content << ''
          content << "**Status:** #{status_emoji} #{bug.status&.upcase || 'UNKNOWN'}"
          content << "**First Reported:** #{bug.first_reported || 'Unknown'}"
          content << "**Last Occurred:** #{bug.last_occurred}" if bug.last_occurred
          content << "**Fixed Date:** #{bug.fixed_date}" if bug.fixed_date
          content << "**Severity:** #{bug.severity&.capitalize || 'Unknown'}"
          content << ''

          if bug.description.present?
            content << '#### Summary'
            content << bug.description
            content << ''
          end

          if bug.scenario.present?
            content << '#### Scenario'
            content << bug.scenario
            content << ''
          end

          if bug.root_cause.present?
            content << '#### Root Cause'
            content << bug.root_cause
            content << ''
          end

          if bug.solution.present?
            content << '#### Solution'
            content << bug.solution
            content << ''
          end

          if bug.prevention.present?
            content << '#### Prevention'
            content << bug.prevention
            content << ''
          end

          if bug.component.present?
            content << "**Component:** #{bug.component}"
            content << ''
          end

          content << ''
        end
      end

      # Architecture section
      if architecture.any?
        content << '## 🏛️ Architecture'
        content << ''
        content << '### Design Decisions & Rationale'
        content << ''

        architecture.each_with_index do |arch, index|
          content << "### #{index + 1}. #{arch.title}"
          content << ''

          if arch.rule_reference.present?
            content << "**Related Rule:** Bible #{arch.rule_reference}"
            content << ''
          end

          if arch.description.present?
            content << "**Decision:** #{arch.description}"
            content << ''
          end

          if arch.details.present?
            content << "**Details:**"
            content << arch.details
            content << ''
          end

          if arch.root_cause.present?
            content << "**Rationale:**"
            content << arch.root_cause
            content << ''
          end

          if arch.solution.present?
            content << "**Implementation:**"
            content << arch.solution
            content << ''
          end

          if arch.recommendations.present?
            content << "**Trade-offs:**"
            content << arch.recommendations
            content << ''
          end

          content << ''
        end
      end

      # Test Catalog section
      if tests.any?
        content << '## 📊 Test Catalog'
        content << ''

        tests.each do |test|
          content << "### #{test.title}"
          content << ''

          if test.description.present?
            content << test.description
            content << ''
          end

          if test.solution.present?
            content << '**Tests:**'
            content << test.solution
            content << ''
          end

          content << ''
        end
      end

      # Performance section
      if performance.any?
        content << '## 📈 Performance'
        content << ''

        performance.each do |perf|
          content << "### #{perf.title}"
          content << ''
          content << perf.description if perf.description.present?
          content << ''
          content << perf.solution if perf.solution.present?
          content << ''
          content << ''
        end
      end

      # Dev Notes section
      if dev_notes.any?
        content << '## 🎓 Developer Notes'
        content << ''

        dev_notes.each do |note|
          content << "### #{note.title}"
          content << ''

          if note.description.present?
            content << note.description
            content << ''
          end

          if note.details.present?
            content << note.details
            content << ''
          end

          content << ''
        end
      end

      # Common Issues section
      if common_issues.any?
        content << '## 🔍 Common Issues'
        content << ''

        common_issues.each do |issue|
          content << "### #{issue.title}"
          content << ''

          if issue.description.present?
            content << issue.description
            content << ''
          end

          if issue.scenario.present?
            content << '#### Scenario'
            content << issue.scenario
            content << ''
          end

          if issue.root_cause.present?
            content << '#### Root Cause'
            content << issue.root_cause
            content << ''
          end

          if issue.solution.present?
            content << '#### Solution'
            content << issue.solution
            content << ''
          end

          if issue.prevention.present?
            content << '#### Prevention'
            content << issue.prevention
            content << ''
          end

          content << ''
        end
      end
    end

    # Footer
    content << ''
    content << "**Last Generated:** #{Time.current.strftime('%Y-%m-%d %H:%M %Z')}"
    content << '**Generated By:** `rake trapid:export_lexicon`'
    content << '**Maintained By:** Development Team via Database UI'
    content << '**Review Schedule:** After each bug fix or knowledge entry'

    # Write to file
    file_path = Rails.root.join('..', 'TRAPID_DOCS', 'TRAPID_LEXICON.md')
    File.write(file_path, content.join("\n"))

    total_entries = Trinity.lexicon_entries.count
    puts "✅ Exported #{total_entries} entries across #{chapters.count} chapters"
    puts "📄 File: #{file_path}"
    puts ''
    puts '💡 Next steps:'
    puts '  1. Review the generated file'
    puts '  2. Commit to git: git add TRAPID_DOCS/TRAPID_LEXICON.md'
    puts '  3. Git commit message: "docs: Update Lexicon from database export"'
  end

  desc 'Export Teacher database to TRAPID_TEACHER.md'
  task export_teacher: :environment do
    puts '🔧 Exporting Teacher database to markdown...'

    # Build markdown content
    content = []

    # Header
    content << '# TRAPID TEACHER - Implementation Patterns & Code Examples'
    content << ''
    content << '**Version:** 1.0.0'
    content << "**Last Updated:** #{Time.current.strftime('%Y-%m-%d %H:%M %Z')}"
    content << '**Authority Level:** Reference (HOW to implement Bible rules)'
    content << '**Audience:** Claude Code + Human Developers'
    content << ''
    content << '---'
    content << ''
    content << '## 🔴 CRITICAL: Read This First'
    content << ''
    content << '### This Document is "The Teacher"'
    content << ''
    content << 'This file contains **code examples and step-by-step guides** for implementing Trapid features.'
    content << ''
    content << '**This Teacher Contains HOW-TO ONLY:**'
    content << '- 🧩 Component patterns (full code examples)'
    content << '- ✨ Feature implementation guides (step-by-step)'
    content << '- 🔧 Utility functions (reusable code)'
    content << '- 🪝 Hook patterns (React/Rails hooks)'
    content << '- 🔌 Integration guides (Xero, OneDrive, etc.)'
    content << '- ⚡ Optimization techniques (performance improvements)'
    content << ''
    content << '**For RULES (MUST/NEVER/ALWAYS):**'
    content << '- 📖 See [TRAPID_BIBLE.md](TRAPID_BIBLE.md)'
    content << ''
    content << '**For BUG HISTORY & KNOWLEDGE:**'
    content << '- 📕 See [TRAPID_LEXICON.md](TRAPID_LEXICON.md)'
    content << ''
    content << '**For USER GUIDES (how to use features):**'
    content << '- 📘 See [TRAPID_USER_MANUAL.md](TRAPID_USER_MANUAL.md)'
    content << ''
    content << '---'
    content << ''
    content << '## 💾 Database-Driven Teacher'
    content << ''
    content << '**IMPORTANT:** This file is auto-generated from the `trinity` database table.'
    content << ''
    content << '**To edit entries:**'
    content << '1. Go to Documentation page in Trapid'
    content << '2. Click "🔧 TRAPID Teacher"'
    content << '3. Use the UI to add/edit/delete teaching patterns'
    content << '4. Run `rake trapid:export_teacher` to update this file'
    content << ''
    content << '**Single Source of Truth:** Database (not this file)'
    content << ''
    content << '---'
    content << ''
    content << '## Table of Contents'
    content << ''

    # Get all chapters (only from Teacher entries)
    chapters = Trinity.teacher_entries
                      .select(:chapter_number, :chapter_name)
                      .distinct
                      .order(:chapter_number)

    chapters.each do |chapter|
      content << "- [Chapter #{chapter.chapter_number}: #{chapter.chapter_name}](#chapter-#{chapter.chapter_number}-#{chapter.chapter_name.downcase.gsub(/[^a-z0-9]+/, '-')})"
    end

    content << ''
    content << '---'
    content << ''

    # Generate content for each chapter
    chapters.each do |chapter|
      content << ''
      content << "# Chapter #{chapter.chapter_number}: #{chapter.chapter_name}"
      content << ''
      content << "**Last Updated:** #{Time.current.strftime('%Y-%m-%d')}"
      content << ''

      # Get Teacher entries for this chapter
      entries = Trinity.teacher_entries
                       .where(chapter_number: chapter.chapter_number)
                       .order(:section_number, :created_at)

      entries.each do |entry|
        # Section header
        section_prefix = entry.section_number.present? ? "§#{entry.section_number}: " : ""
        content << "## #{section_prefix}#{entry.title}"
        content << ''

        # Type and difficulty badges
        badges = []
        badges << "#{entry.type_emoji} #{entry.entry_type.titleize}"
        badges << "#{entry.difficulty_emoji} #{entry.difficulty&.capitalize}" if entry.difficulty.present?
        content << badges.join(' | ')
        content << ''

        # Related rules
        if entry.related_rules.present?
          content << "**📖 Related Bible Rules:** #{entry.related_rules}"
          content << ''
        end

        # Summary
        if entry.summary.present?
          content << '### Quick Summary'
          content << entry.summary
          content << ''
        end

        # Step-by-step guide (using details field)
        if entry.details.present?
          content << '### Step-by-Step Guide'
          content << entry.details
          content << ''
        end

        # Code example
        if entry.code_example.present?
          content << '### Code Example'
          content << '```jsx'
          content << entry.code_example
          content << '```'
          content << ''
        end

        # Common mistakes
        if entry.common_mistakes.present?
          content << '### ⚠️ Common Mistakes'
          content << entry.common_mistakes
          content << ''
        end

        # Testing strategy
        if entry.testing_strategy.present?
          content << '### 🧪 Testing Strategy'
          content << entry.testing_strategy
          content << ''
        end

        # Additional universal fields
        if entry.description.present?
          content << '### Description'
          content << entry.description
          content << ''
        end

        if entry.examples.present?
          content << '### Examples'
          content << entry.examples
          content << ''
        end

        if entry.recommendations.present?
          content << '### Recommendations'
          content << entry.recommendations
          content << ''
        end

        content << ''
      end
    end

    # Footer
    content << ''
    content << "**Last Generated:** #{Time.current.strftime('%Y-%m-%d %H:%M %Z')}"
    content << '**Generated By:** `rake trapid:export_teacher`'
    content << '**Maintained By:** Development Team via Database UI'
    content << '**Review Schedule:** After adding new patterns or updating examples'

    # Write to file
    file_path = Rails.root.join('..', 'TRAPID_DOCS', 'TRAPID_TEACHER.md')
    File.write(file_path, content.join("\n"))

    total_entries = Trinity.teacher_entries.count
    puts "✅ Exported #{total_entries} teaching patterns across #{chapters.count} chapters"
    puts "📄 File: #{file_path}"
    puts ''
    puts '💡 Next steps:'
    puts '  1. Review the generated file'
    puts '  2. Commit to git: git add TRAPID_DOCS/TRAPID_TEACHER.md'
    puts '  3. Git commit message: "docs: Update Teacher from database export"'
  end

  desc 'Export Teacher database to per-chapter files in TEACHER/ directory'
  task export_teacher_split: :environment do
    puts '🔧 Exporting Teacher database to per-chapter markdown files...'

    # Ensure TEACHER directory exists
    teacher_dir = Rails.root.join('..', 'TRAPID_DOCS', 'TEACHER')
    FileUtils.mkdir_p(teacher_dir)

    # Get all chapters (only from Teacher entries)
    chapters = Trinity.teacher_entries
                      .select(:chapter_number, :chapter_name)
                      .distinct
                      .order(:chapter_number)

    generated_files = []

    # Generate a file for each chapter
    chapters.each do |chapter|
      content = []

      # Chapter-specific header
      chapter_name_slug = chapter.chapter_name.upcase.gsub(/[^A-Z0-9]+/, '_')
      content << "# TRAPID TEACHER - Chapter #{chapter.chapter_number}: #{chapter.chapter_name}"
      content << ''
      content << "**Last Updated:** #{Time.current.strftime('%Y-%m-%d %H:%M %Z')}"
      content << '**Authority Level:** Reference (HOW to implement Bible rules)'
      content << '**Audience:** Claude Code + Human Developers'
      content << ''
      content << '---'
      content << ''
      content << '## 📚 Navigation'
      content << ''
      content << '**Other Teacher Chapters:**'
      content << '- [Main Teacher Index](../TRAPID_TEACHER.md)'

      # Add links to adjacent chapters
      if chapter.chapter_number > 0
        prev_chapter = chapters.find { |c| c.chapter_number == chapter.chapter_number - 1 }
        if prev_chapter
          prev_slug = prev_chapter.chapter_name.upcase.gsub(/[^A-Z0-9]+/, '_')
          content << "- [← Previous: Chapter #{prev_chapter.chapter_number} - #{prev_chapter.chapter_name}](CHAPTER_#{prev_chapter.chapter_number.to_s.rjust(2, '0')}_#{prev_slug}.md)"
        end
      end

      next_chapter = chapters.find { |c| c.chapter_number == chapter.chapter_number + 1 }
      if next_chapter
        next_slug = next_chapter.chapter_name.upcase.gsub(/[^A-Z0-9]+/, '_')
        content << "- [Next: Chapter #{next_chapter.chapter_number} - #{next_chapter.chapter_name} →](CHAPTER_#{next_chapter.chapter_number.to_s.rjust(2, '0')}_#{next_slug}.md)"
      end

      content << ''
      content << '**Related Documentation:**'
      content << '- 📖 [TRAPID Bible (Rules)](../TRAPID_BIBLE.md)'
      content << '- 📕 [TRAPID Lexicon (Bug History)](../TRAPID_LEXICON.md)'
      content << '- 📘 [User Manual](../TRAPID_USER_MANUAL.md)'
      content << ''
      content << '---'
      content << ''
      content << "## Chapter #{chapter.chapter_number}: #{chapter.chapter_name}"
      content << ''

      # Get Teacher entries for this chapter
      entries = Trinity.teacher_entries
                       .where(chapter_number: chapter.chapter_number)
                       .order(:section_number, :created_at)

      if entries.empty?
        content << '*No teaching patterns available for this chapter yet.*'
        content << ''
      else
        entries.each do |entry|
          # Section header
          section_prefix = entry.section_number.present? ? "§#{entry.section_number}: " : ""
          content << "## #{section_prefix}#{entry.title}"
          content << ''

          # Type and difficulty badges
          badges = []
          badges << "#{entry.type_emoji} #{entry.entry_type.titleize}"
          badges << "#{entry.difficulty_emoji} #{entry.difficulty&.capitalize}" if entry.difficulty.present?
          content << badges.join(' | ')
          content << ''

          # Related rules
          if entry.related_rules.present?
            content << "**📖 Related Bible Rules:** #{entry.related_rules}"
            content << ''
          end

          # Summary
          if entry.summary.present?
            content << '### Quick Summary'
            content << entry.summary
            content << ''
          end

          # Step-by-step guide (using details field)
          if entry.details.present?
            content << '### Step-by-Step Guide'
            content << entry.details
            content << ''
          end

          # Code example
          if entry.code_example.present?
            content << '### Code Example'
            content << '```jsx'
            content << entry.code_example
            content << '```'
            content << ''
          end

          # Common mistakes
          if entry.common_mistakes.present?
            content << '### ⚠️ Common Mistakes'
            content << entry.common_mistakes
            content << ''
          end

          # Testing strategy
          if entry.testing_strategy.present?
            content << '### 🧪 Testing Strategy'
            content << entry.testing_strategy
            content << ''
          end

          # Additional universal fields
          if entry.description.present?
            content << '### Description'
            content << entry.description
            content << ''
          end

          if entry.examples.present?
            content << '### Examples'
            content << entry.examples
            content << ''
          end

          if entry.recommendations.present?
            content << '### Recommendations'
            content << entry.recommendations
            content << ''
          end

          content << ''
        end
      end

      # Footer
      content << ''
      content << '---'
      content << ''
      content << "**Last Generated:** #{Time.current.strftime('%Y-%m-%d %H:%M %Z')}"
      content << '**Generated By:** `rake trapid:export_teacher_split`'
      content << '**Maintained By:** Development Team via Database UI'

      # Write chapter file
      chapter_filename = "CHAPTER_#{chapter.chapter_number.to_s.rjust(2, '0')}_#{chapter_name_slug}.md"
      file_path = teacher_dir.join(chapter_filename)
      File.write(file_path, content.join("\n"))
      generated_files << chapter_filename

      puts "  ✅ Chapter #{chapter.chapter_number}: #{chapter.chapter_name} (#{entries.count} entries)"
    end

    puts ''
    puts "✅ Exported #{chapters.count} chapters to separate files"
    puts "📁 Directory: #{teacher_dir}"
    puts ''
    puts 'Generated files:'
    generated_files.each { |f| puts "  - #{f}" }
    puts ''
    puts '💡 Next steps:'
    puts '  1. Review the generated files in TRAPID_DOCS/TEACHER/'
    puts '  2. Commit to git: git add TRAPID_DOCS/TEACHER/'
    puts '  3. Git commit message: "docs: Split Teacher into per-chapter files for token efficiency"'
  end
end
