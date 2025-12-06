namespace :agents do
  desc "Export agent definitions from Trinity database to .claude/agents/*.md files"
  task export_definitions: :environment do
    puts "📋 Exporting agent definitions from Trinity database..."
    puts "=" * 60

    # Find all dropdown_md entries in Chapter 21 (Agent System)
    agents = ActiveRecord::Base.connection.execute(<<~SQL)
      SELECT#{' '}
        section_number,
        title,
        description
      FROM trinity
      WHERE category = 'teacher'
        AND chapter_number = 21
        AND entry_type = 'dropdown_md'
      ORDER BY section_number
    SQL

    agents.each do |agent|
      # Extract agent_id from section number (e.g., 21.15 -> ui-compliance-auditor)
      # For now, derive filename from title
      filename = agent["title"]
                   .downcase
                   .gsub(" agent", "")
                   .gsub(" - markdown definition", "")
                   .gsub(/[^a-z0-9]+/, "-")
                   .gsub(/-+/, "-")
                   .gsub(/^-|-$/, "")

      filepath = Rails.root.join("..", ".claude", "agents", "#{filename}.md")

      # Write the markdown content
      File.write(filepath, agent["description"])

      puts "✅ Exported: #{filename}.md (§#{agent['section_number']})"
    end

    puts "=" * 60
    puts "✅ Export complete!"
    puts "   Files: #{Rails.root.join('..', '.claude', 'agents')}/*.md"
  end
end
