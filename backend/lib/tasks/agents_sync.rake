# frozen_string_literal: true

namespace :agents do
  desc "Sync agents from .claude/ files to database"
  task sync_from_files: :environment do
    require "yaml"

    claude_dir = Rails.root.join("..", ".claude")
    synced_ids = []
    stats = { agents: 0, commands: 0, skills: 0 }

    puts "Syncing agents from #{claude_dir}..."

    # 1. Sync agents from .claude/agents/*.md
    Dir.glob(claude_dir.join("agents", "*.md")).each do |filepath|
      next if File.basename(filepath) == "README.md"

      data = parse_agent_file(filepath)
      next unless data

      agent = upsert_agent(data)
      synced_ids << agent.agent_id
      stats[:agents] += 1
      puts "  ✓ Agent: #{agent.name}"
    end

    # 2. Sync commands from .claude/commands/*.md
    Dir.glob(claude_dir.join("commands", "*.md")).each do |filepath|
      next if File.basename(filepath) == "README.md"

      data = parse_command_file(filepath)
      next unless data

      agent = upsert_agent(data)
      synced_ids << agent.agent_id
      stats[:commands] += 1
      puts "  ✓ Command: #{agent.name}"
    end

    # 3. Sync skills from .claude/skills/*/SKILL.md
    Dir.glob(claude_dir.join("skills", "*", "SKILL.md")).each do |filepath|
      data = parse_skill_file(filepath)
      next unless data

      agent = upsert_agent(data)
      synced_ids << agent.agent_id
      stats[:skills] += 1
      puts "  ✓ Skill: #{agent.name}"
    end

    # Mark agents not found in files as inactive
    orphaned = AgentDefinition.where.not(agent_id: synced_ids).where(active: true)
    if orphaned.any?
      puts "\nMarking #{orphaned.count} orphaned agents as inactive..."
      orphaned.update_all(active: false)
    end

    puts "\n✅ Sync complete!"
    puts "   Agents: #{stats[:agents]}"
    puts "   Commands: #{stats[:commands]}"
    puts "   Skills: #{stats[:skills]}"
    puts "   Total: #{synced_ids.count}"
  end

  private

  def parse_agent_file(filepath)
    content = File.read(filepath)
    filename = File.basename(filepath, ".md")

    # Parse YAML frontmatter
    frontmatter = {}
    body = content
    if content.start_with?("---")
      parts = content.split("---", 3)
      if parts.length >= 3
        begin
          frontmatter = YAML.safe_load(parts[1]) || {}
        rescue StandardError
          frontmatter = {}
        end
        body = parts[2]
      end
    end

    # Extract name from frontmatter or first header
    name = frontmatter["name"] || extract_header(body) || filename.titleize

    # Extract description - use frontmatter description or purpose section
    description = frontmatter["description"]
    description = extract_purpose(body) if description.blank?
    # Clean up ASCII art boxes from description
    description = clean_description(description)

    {
      agent_id: filename,
      name: name,
      purpose: description,
      agent_type: frontmatter["type"] || "development",
      focus: frontmatter["focus"] || extract_focus(body) || "Agent",
      model: frontmatter["model"] || "sonnet",
      category: "agent",
      command: filename, # Agents invoked by name
      active: true
    }
  end

  def parse_command_file(filepath)
    content = File.read(filepath)
    filename = File.basename(filepath, ".md")

    # Commands typically don't have frontmatter
    # Extract name from first # header
    name = extract_header(content) || filename.titleize

    # Extract description from first paragraph after header or **Shortcut:** line
    description = extract_first_paragraph(content)

    # Determine the command shortcut
    shortcut = "/#{filename}"

    {
      agent_id: "cmd-#{filename}",
      name: name,
      purpose: description,
      agent_type: "command",
      focus: "Slash command",
      model: "sonnet",
      category: "command",
      command: shortcut,
      active: true
    }
  end

  def parse_skill_file(filepath)
    content = File.read(filepath)
    skill_name = File.basename(File.dirname(filepath))

    # Skills have YAML frontmatter
    frontmatter = {}
    if content.start_with?("---")
      parts = content.split("---", 3)
      if parts.length >= 3
        begin
          frontmatter = YAML.safe_load(parts[1]) || {}
        rescue StandardError
          frontmatter = {}
        end
      end
    end

    name = frontmatter["name"] || skill_name.titleize
    description = frontmatter["description"]

    {
      agent_id: "skill-#{skill_name}",
      name: name,
      purpose: description,
      agent_type: "skill",
      focus: "Claude Code skill",
      model: "sonnet",
      category: "skill",
      command: "/#{skill_name}",
      active: true
    }
  end

  def upsert_agent(data)
    agent = AgentDefinition.find_or_initialize_by(agent_id: data[:agent_id])

    # Truncate string fields to fit in varchar(255) - be safe with all fields
    name = data[:name]&.truncate(250)
    agent_type = data[:agent_type]&.truncate(250)
    model = data[:model]&.truncate(250)
    category = data[:category]&.truncate(250)

    # Only update certain fields, preserve run stats
    agent.assign_attributes(
      name: name,
      purpose: data[:purpose], # TEXT field, no limit
      agent_type: agent_type,
      focus: data[:focus], # TEXT field, no limit
      model: model,
      category: category,
      active: data[:active],
      metadata: (agent.metadata || {}).merge("command" => data[:command])
    )

    agent.save!
    agent
  end

  def extract_header(content)
    match = content.match(/^#\s+(.+)$/m)
    match&.[](1)&.strip
  end

  def extract_purpose(content)
    # Look for ## Purpose section
    match = content.match(/##\s*Purpose\s*\n+(.+?)(\n##|\n\n\n|\z)/m)
    return match[1].strip if match

    # Fallback to first paragraph after header
    extract_first_paragraph(content)
  end

  def extract_first_paragraph(content)
    # Skip the header line and get first meaningful paragraph
    lines = content.lines
    in_content = false
    paragraph = []

    lines.each do |line|
      # Skip header
      if line.start_with?("#")
        in_content = true
        next
      end

      next unless in_content

      # Skip empty lines at start
      next if paragraph.empty? && line.strip.empty?

      # End at empty line after content
      break if line.strip.empty? && paragraph.any?

      paragraph << line.strip
    end

    paragraph.join(" ").strip.presence
  end

  def extract_focus(content)
    match = content.match(/\*\*Focus:\*\*\s*(.+)$/m)
    match&.[](1)&.strip
  end

  def clean_description(text)
    return nil if text.blank?

    # Remove ASCII art box characters and clean up
    text = text.gsub(/[╔╗╚╝╠╣║═]/, "")
    text = text.gsub(/\[PASS\]/, "")
    text = text.gsub(/\s+/, " ")
    text.strip.presence
  end
end
