# frozen_string_literal: true

module Api
  module V1
    class AgentDefinitionsController < ApplicationController
      skip_before_action :authorize_request, only: [ :index, :show, :record_run, :sync ]

      # GET /api/v1/agent_definitions
      # Returns list of all agents
      # Params:
      #   - category: filter by category (agent, command, skill)
      #   - active_only: if "true", only return active agents (default: false)
      def index
        agents = AgentDefinition.order(category: :asc, name: :asc)
                                .includes(:created_by, :updated_by, :last_run_by)

        agents = agents.active if params[:active_only] == "true"
        agents = agents.where(category: params[:category]) if params[:category].present?

        render json: {
          success: true,
          data: agents.map { |agent| agent_json(agent) },
          stats: {
            total: agents.count,
            agents: agents.where(category: "agent").count,
            commands: agents.where(category: "command").count,
            skills: agents.where(category: "skill").count
          }
        }
      end

      # POST /api/v1/agent_definitions/sync
      # Syncs agents from .claude/ files to database
      def sync
        require "yaml"

        claude_dir = Rails.root.join("..", ".claude")
        synced_ids = []
        stats = { agents: 0, commands: 0, skills: 0 }

        # 1. Sync agents from .claude/agents/*.md
        Dir.glob(claude_dir.join("agents", "*.md")).each do |filepath|
          next if File.basename(filepath) == "README.md"
          data = parse_agent_file(filepath)
          next unless data
          agent = upsert_agent(data)
          synced_ids << agent.agent_id
          stats[:agents] += 1
        end

        # 2. Sync commands from .claude/commands/*.md
        Dir.glob(claude_dir.join("commands", "*.md")).each do |filepath|
          next if File.basename(filepath) == "README.md"
          data = parse_command_file(filepath)
          next unless data
          agent = upsert_agent(data)
          synced_ids << agent.agent_id
          stats[:commands] += 1
        end

        # 3. Sync skills from .claude/skills/*/SKILL.md
        Dir.glob(claude_dir.join("skills", "*", "SKILL.md")).each do |filepath|
          data = parse_skill_file(filepath)
          next unless data
          agent = upsert_agent(data)
          synced_ids << agent.agent_id
          stats[:skills] += 1
        end

        # Mark agents not found in files as inactive
        AgentDefinition.where.not(agent_id: synced_ids).where(active: true).update_all(active: false)

        render json: {
          success: true,
          message: "Synced #{synced_ids.count} agents",
          stats: stats
        }
      end

      # GET /api/v1/agent_definitions/:id
      # Returns single agent with full details
      def show
        agent = AgentDefinition.includes(:created_by, :updated_by, :last_run_by).find_by!(agent_id: params[:agent_id])

        render json: {
          success: true,
          data: agent.as_json(
            methods: [ :status_emoji, :success_rate ],
            include: {
              created_by: {},
              updated_by: {},
              last_run_by: {}
            }
          )
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Agent not found" }, status: :not_found
      end

      # POST /api/v1/agent_definitions/:id/record_run
      # Records a run result
      # Accepts user_name param for CLI runs (from git config user.name)
      # Accepts tokens param for token usage tracking
      def record_run
        agent = AgentDefinition.find_by!(agent_id: params[:agent_id])
        status = params[:status] # 'success' or 'failure'
        message = params[:message]
        details = params[:details] || {}
        user_name = params[:user_name]
        tokens = params[:tokens].to_i if params[:tokens].present?

        if status == "success"
          agent.record_success(message, details, user_name: user_name, tokens: tokens)
        else
          agent.record_failure(message, details, user_name: user_name, tokens: tokens)
        end

        render json: {
          success: true,
          data: agent.as_json
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Agent not found" }, status: :not_found
      end

      # POST /api/v1/agent_definitions (admin only)
      # Creates a new agent
      def create
        agent = AgentDefinition.new(agent_params)

        if agent.save
          render json: { success: true, data: agent }, status: :created
        else
          render json: { success: false, errors: agent.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/agent_definitions/:id (admin only)
      # Updates an agent
      def update
        agent = AgentDefinition.find_by!(agent_id: params[:agent_id])

        if agent.update(agent_params)
          render json: { success: true, data: agent }
        else
          render json: { success: false, errors: agent.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Agent not found" }, status: :not_found
      end

      # DELETE /api/v1/agent_definitions/:id (admin only)
      # Deactivates an agent
      def destroy
        agent = AgentDefinition.find_by!(agent_id: params[:agent_id])
        agent.update!(active: false)

        render json: { success: true, message: "Agent deactivated" }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Agent not found" }, status: :not_found
      end

      private

      def agent_params
        params.require(:agent_definition).permit(
          :agent_id, :name, :agent_type, :focus, :model,
          :purpose, :capabilities, :when_to_use, :tools_available,
          :success_criteria, :example_invocations, :important_notes,
          :active, :priority, metadata: {}
        )
      end

      def agent_json(agent)
        {
          id: agent.id,
          agent_id: agent.agent_id,
          name: agent.name,
          purpose: agent.purpose,
          agent_type: agent.agent_type,
          focus: agent.focus,
          model: agent.model,
          category: agent.category,
          command: agent.metadata&.dig("command") || derive_command(agent),
          active: agent.active,
          total_runs: agent.total_runs,
          successful_runs: agent.successful_runs,
          failed_runs: agent.failed_runs,
          last_run_at: agent.last_run_at,
          last_status: agent.last_status,
          updated_at: agent.updated_at,
          created_at: agent.created_at,
          status_emoji: agent.status_emoji,
          success_rate: agent.success_rate,
          health_status: agent.health_status,
          days_since_last_run: agent.days_since_last_run
        }
      end

      def derive_command(agent)
        case agent.category
        when "command"
          "/#{agent.agent_id.sub('cmd-', '')}"
        when "skill"
          "/#{agent.agent_id.sub('skill-', '')}"
        else
          agent.agent_id
        end
      end

      # File parsing methods for sync
      def parse_agent_file(filepath)
        content = File.read(filepath)
        filename = File.basename(filepath, ".md")

        frontmatter = extract_frontmatter(content)
        body = extract_body(content)

        name = frontmatter["name"] || extract_header(body) || filename.titleize
        description = frontmatter["description"] || extract_purpose(body)
        description = clean_description(description)

        {
          agent_id: filename,
          name: name,
          purpose: description,
          agent_type: frontmatter["type"] || "development",
          focus: frontmatter["focus"] || extract_focus(body) || "Agent",
          model: frontmatter["model"] || "sonnet",
          category: "agent",
          command: filename,
          source_path: ".claude/agents/#{filename}.md",
          active: true
        }
      end

      def parse_command_file(filepath)
        content = File.read(filepath)
        filename = File.basename(filepath, ".md")

        name = extract_header(content) || filename.titleize
        description = extract_first_paragraph(content)

        {
          agent_id: "cmd-#{filename}",
          name: name,
          purpose: description,
          agent_type: "command",
          focus: "Slash command",
          model: "sonnet",
          category: "command",
          command: "/#{filename}",
          source_path: ".claude/commands/#{filename}.md",
          active: true
        }
      end

      def parse_skill_file(filepath)
        content = File.read(filepath)
        skill_name = File.basename(File.dirname(filepath))

        frontmatter = extract_frontmatter(content)

        {
          agent_id: "skill-#{skill_name}",
          name: frontmatter["name"] || skill_name.titleize,
          purpose: frontmatter["description"],
          agent_type: "skill",
          focus: "Claude Code skill",
          model: "sonnet",
          category: "skill",
          command: "/#{skill_name}",
          source_path: ".claude/skills/#{skill_name}/SKILL.md",
          active: true
        }
      end

      def upsert_agent(data)
        agent = AgentDefinition.find_or_initialize_by(agent_id: data[:agent_id])

        # Truncate purpose to fit in varchar(255)
        purpose = data[:purpose]
        purpose = purpose.truncate(250) if purpose.present? && purpose.length > 250

        agent.assign_attributes(
          name: data[:name],
          purpose: purpose,
          agent_type: data[:agent_type],
          focus: data[:focus],
          model: data[:model],
          category: data[:category],
          active: data[:active],
          metadata: (agent.metadata || {}).merge(
            "command" => data[:command],
            "source_path" => data[:source_path]
          )
        )
        agent.save!
        agent
      end

      def extract_frontmatter(content)
        return {} unless content.start_with?("---")
        parts = content.split("---", 3)
        return {} if parts.length < 3
        YAML.safe_load(parts[1]) || {}
      rescue StandardError
        {}
      end

      def extract_body(content)
        return content unless content.start_with?("---")
        parts = content.split("---", 3)
        parts.length >= 3 ? parts[2] : content
      end

      def extract_header(content)
        match = content.match(/^#\s+(.+)$/m)
        match&.[](1)&.strip
      end

      def extract_purpose(content)
        match = content.match(/##\s*Purpose\s*\n+(.+?)(\n##|\n\n\n|\z)/m)
        return match[1].strip if match
        extract_first_paragraph(content)
      end

      def extract_first_paragraph(content)
        lines = content.lines
        in_content = false
        paragraph = []

        lines.each do |line|
          if line.start_with?("#")
            in_content = true
            next
          end
          next unless in_content
          next if paragraph.empty? && line.strip.empty?
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
        text = text.gsub(/[╔╗╚╝╠╣║═]/, "")
        text = text.gsub(/\[PASS\]/, "")
        text = text.gsub(/\s+/, " ")
        text.strip.presence
      end
    end
  end
end
