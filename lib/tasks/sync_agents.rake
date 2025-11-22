# frozen_string_literal: true

namespace :trapid do
  namespace :agents do
    desc "Sync agent definitions from .claude/agents/*.md files to database"
    task sync: :environment do
      puts "🤖 Syncing agent definitions from .claude/agents/ to database..."

      agent_dir = Rails.root.join("../.claude/agents")
      unless Dir.exist?(agent_dir)
        puts "❌ Error: #{agent_dir} does not exist"
        exit 1
      end

      agent_files = Dir.glob(agent_dir.join("*.md")).reject do |file|
        File.basename(file) == "README.md"
      end

      if agent_files.empty?
        puts "⚠️  No agent files found in #{agent_dir}"
        exit 0
      end

      synced_count = 0
      updated_count = 0
      skipped_count = 0

      agent_files.each do |file_path|
        agent_id = File.basename(file_path, ".md")
        puts "\n📄 Processing: #{agent_id}"

        begin
          content = File.read(file_path)

          # Parse frontmatter if it exists (YAML between --- markers)
          frontmatter = {}
          body = content

          if content.start_with?("---\n")
            parts = content.split("---\n", 3)
            if parts.length >= 3
              # Parse YAML frontmatter
              require 'yaml'
              frontmatter = YAML.safe_load(parts[1]) || {}
              body = parts[2]
            end
          end

          # Extract metadata from frontmatter or markdown content
          name = frontmatter["name"] || extract_name_from_content(body, agent_id)
          description = frontmatter["description"] || extract_description_from_content(body)
          model = frontmatter["model"] || "sonnet"
          agent_type = frontmatter["type"] || determine_agent_type(body)
          focus = extract_focus_from_content(body, description)
          purpose = extract_purpose_from_content(body)
          capabilities = extract_capabilities_from_content(body)
          when_to_use = extract_when_to_use_from_content(body)
          tools = extract_tools_from_content(body)
          success_criteria = extract_success_criteria_from_content(body)
          example_invocations = extract_example_invocations_from_content(body)
          important_notes = extract_important_notes_from_content(body)
          priority = determine_priority(agent_id, agent_type)

          # Find or create agent definition
          agent = AgentDefinition.find_or_initialize_by(agent_id: agent_id)

          is_new = agent.new_record?

          # Get the git author names directly from git history
          # No database lookup - just store the git user.name
          file_relative_path = ".claude/agents/#{File.basename(file_path)}"
          project_root = Rails.root.join('..')

          # Check for explicit author in frontmatter (overrides git history)
          explicit_author = frontmatter["author"]
          created_by_name = nil
          updated_by_name = nil

          if explicit_author.present?
            created_by_name = explicit_author
            puts "  📝 Explicit author: #{explicit_author}"
          else
            # Get the original creator name from git history (first commit author)
            created_by_name = `cd #{project_root} && git log --diff-filter=A --format='%an' -- '#{file_relative_path}' 2>/dev/null`.strip rescue nil
            created_by_name = nil if created_by_name.blank?
          end

          # Get the last modifier name from git history
          updated_by_name = `cd #{project_root} && git log -1 --format='%an' -- '#{file_relative_path}' 2>/dev/null`.strip rescue nil
          updated_by_name = nil if updated_by_name.blank?

          # Fallback to current git user name
          fallback_name = `git config user.name`.strip rescue nil
          fallback_name = 'Unknown' if fallback_name.blank?

          created_by_name ||= fallback_name
          updated_by_name ||= fallback_name

          # Get category from frontmatter or determine from agent_type
          category = frontmatter["category"] || determine_category(agent_id, agent_type)

          # Update attributes
          agent.assign_attributes(
            name: name,
            agent_type: agent_type,
            category: category,
            focus: focus,
            model: model,
            purpose: purpose,
            capabilities: capabilities,
            when_to_use: when_to_use,
            tools_available: tools,
            success_criteria: success_criteria,
            example_invocations: example_invocations,
            important_notes: important_notes,
            active: true,
            priority: priority,
            updated_by_name: updated_by_name
          )

          # Set created_by_name only when agent is first created
          agent.created_by_name = created_by_name if is_new

          if agent.save
            if is_new
              puts "  ✅ Created: #{name}"
              synced_count += 1
            else
              puts "  ♻️  Updated: #{name}"
              updated_count += 1
            end
          else
            puts "  ❌ Failed to save: #{agent.errors.full_messages.join(', ')}"
            skipped_count += 1
          end

        rescue => e
          puts "  ❌ Error processing #{agent_id}: #{e.message}"
          skipped_count += 1
        end
      end

      puts "\n" + "=" * 60
      puts "📊 Sync Summary:"
      puts "  New agents created: #{synced_count}"
      puts "  Existing agents updated: #{updated_count}"
      puts "  Skipped/Failed: #{skipped_count}"
      puts "  Total processed: #{agent_files.length}"
      puts "=" * 60
    end

    private

    def extract_name_from_content(content, agent_id)
      # Try to find name in title (# Agent Name)
      match = content.match(/^#\s+(.+?)\s+Agent/i)
      return match[1].strip if match

      # Fallback to humanized agent_id
      agent_id.split('-').map(&:capitalize).join(' ')
    end

    def extract_description_from_content(content)
      # Look for description in various formats
      patterns = [
        /\*\*Purpose:\*\*\s*(.+?)(?:\n\n|\z)/m,
        /\*\*Description:\*\*\s*(.+?)(?:\n\n|\z)/m,
        /^description:\s*(.+?)$/m,
        /^##\s*Purpose\s*\n+(.+?)(?:\n\n|\z)/m
      ]

      patterns.each do |pattern|
        match = content.match(pattern)
        return match[1].strip if match
      end

      "Specialized Claude Code agent"
    end

    def extract_focus_from_content(content, fallback)
      # If description has box characters (from YAML frontmatter), use it as focus
      # This is the new standard format with Unicode box characters
      if fallback.to_s.include?("\u2554") || fallback.to_s.include?("╔")
        return fallback.to_s[0..1000]
      end

      # Look for focus/specialty in markdown body (legacy format)
      patterns = [
        /\*\*Focus:\*\*\s*(.+?)(?:\n|\z)/,
        /\*\*Specialty:\*\*\s*(.+?)(?:\n|\z)/,
        /focus:\s*(.+?)$/
      ]

      patterns.each do |pattern|
        match = content.match(pattern)
        return match[1].strip if match
      end

      fallback.to_s[0..1000] # Use first 1000 chars of description
    end

    def extract_purpose_from_content(content)
      match = content.match(/##\s*Purpose\s*\n+(.+?)(?:\n##|\z)/m)
      match ? match[1].strip : nil
    end

    def extract_capabilities_from_content(content)
      match = content.match(/##\s*Capabilities\s*\n+(.+?)(?:\n##|\z)/m)
      match ? match[1].strip : nil
    end

    def extract_when_to_use_from_content(content)
      match = content.match(/##\s*When to Use.*?\s*\n+(.+?)(?:\n##|\z)/m)
      match ? match[1].strip : nil
    end

    def extract_tools_from_content(content)
      match = content.match(/##\s*Tools.*?\s*\n+(.+?)(?:\n##|\z)/m)
      match ? match[1].strip : "All tools"
    end

    def extract_success_criteria_from_content(content)
      match = content.match(/##\s*Success Criteria\s*\n+(.+?)(?:\n##|\z)/m)
      match ? match[1].strip : nil
    end

    def extract_example_invocations_from_content(content)
      # Look for shortcuts or example invocations
      patterns = [
        /##\s*Shortcuts\s*\n+(.+?)(?:\n##|\z)/m,
        /##\s*Example Invocations\s*\n+(.+?)(?:\n##|\z)/m,
        /\*\*Shortcuts:\*\*\s*(.+?)(?:\n\n|\z)/m
      ]

      patterns.each do |pattern|
        match = content.match(pattern)
        if match
          # Extract shortcuts from list
          shortcuts = match[1].scan(/[`'""]([^`'""]+)[`'""]/).flatten
          return shortcuts.join(" | ") unless shortcuts.empty?
          return match[1].strip
        end
      end

      nil
    end

    def extract_important_notes_from_content(content)
      match = content.match(/##\s*Important Notes\s*\n+(.+?)(?:\n##|\z)/m)
      match ? match[1].strip : nil
    end

    def determine_agent_type(content)
      # Determine agent type from content
      return "deployment" if content.match?(/deploy|staging|production/i)
      return "diagnostic" if content.match?(/audit|review|compliance|bug.?hunt/i)
      return "planning" if content.match?(/plan|collaborat/i)

      "development" # default
    end

    def determine_category(agent_id, agent_type)
      # Map agents to categories
      categories = {
        # Validation (merged Quality + Data Integrity + Bug Hunting)
        "code-guardian" => "validation",
        "ui-compliance-auditor" => "validation",
        "ui-table-auditor" => "validation",
        "architecture-guardian" => "validation",
        "gold-standard-sst" => "validation",
        "ssot-agent" => "validation",
        "trinity-sync-validator" => "validation",
        "production-bug-hunter" => "validation",
        "gantt-bug-hunter" => "validation",
        # Deployment
        "deploy-manager" => "deployment",
        # Planning
        "planning-collaborator" => "planning",
        "product-owner-analyst" => "planning",
        # Development
        "trapid-table-architect" => "development",
        "invoke-helper" => "development"
      }

      categories[agent_id] || agent_type
    end

    def determine_priority(agent_id, agent_type)
      # Prioritize agents
      priorities = {
        "trapid-table-architect" => 90,
        "architecture-guardian" => 85,
        "code-guardian" => 85,
        "ui-table-auditor" => 80,
        "trinity-sync-validator" => 80,
        "production-bug-hunter" => 75,
        "gantt-bug-hunter" => 75,
        "backend-developer" => 70,
        "frontend-developer" => 70,
        "deploy-manager" => 65,
        "planning-collaborator" => 60,
        "ui-compliance-auditor" => 75
      }

      priorities[agent_id] || 50
    end
  end
end
