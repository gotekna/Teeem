# frozen_string_literal: true

# AI-powered feature request scoping assistant
# Helps users craft better feature requests by:
# 1. Checking if the feature already exists in TEEEM
# 2. Finding duplicate/similar existing requests
# 3. Asking clarifying questions
# 4. Building a structured description
#
# Usage:
#   service = FeatureRequestScopingService.new(user: current_user, tenant: current_tenant)
#   result = service.scope(message: "I want to track invoices", history: [], existing_requests: [...])
#   # => { content: "<!--META:{...}-->...", source: "ai" }
#
class FeatureRequestScopingService
  include AnthropicClient

  self.default_claude_model = CLAUDE_HAIKU
  self.default_max_tokens = 1000

  def initialize(user:, tenant: nil)
    @user = user
    @tenant = tenant
  end

  # Main conversation method
  # @param message [String] The user's current message
  # @param history [Array<Hash>] Previous messages [{role: "user"/"assistant", content: "..."}]
  # @param existing_requests [Array<Array>] Active feature requests [[title, description, status], ...]
  # @return [Hash] { content: String, source: "ai" }
  def scope(message:, history: [], existing_requests: [])
    if ENV["ANTHROPIC_API_KEY"].blank?
      return { content: "Feature scoping is temporarily unavailable.", source: "fallback" }
    end

    @existing_requests = existing_requests
    messages = build_messages(message, history)

    client = anthropic_client
    response = client.messages(parameters: {
      model: default_claude_model,
      max_tokens: default_max_tokens,
      system: system_prompt,
      messages: messages
    })

    content = response.dig("content", 0, "text") || "I'm sorry, I couldn't process that. Please try again."

    { content: content, source: "ai" }
  rescue StandardError => e
    Rails.logger.error "[FeatureRequestScoping] AI response failed: #{e.message}"
    { content: "I'm having trouble right now. You can use the quick submit form instead.", source: "error" }
  end

  private

  def system_prompt
    <<~PROMPT
      You are TEEEM's Feature Request Assistant. Your job is to help users submit well-scoped feature requests.

      You are chatting with: #{@user&.name || "a user"}#{@tenant ? " from #{@tenant.name}" : ""}

      ## Your Process

      1. **FIRST**: Check if the feature already exists in TEEEM (see Feature Catalog below)
      2. **SECOND**: Check if a similar request has already been submitted (see Existing Requests below)
      3. **THIRD**: Ask 2-3 clarifying questions to understand the request better
      4. **FOURTH**: Compile a structured description and present it for review

      ## Response Format

      EVERY response MUST start with a hidden metadata tag on its own line:
      <!--META:{"phase":"checking","existingFeature":null,"duplicates":[]}-->

      Phases:
      - "checking" - You're checking for existing features or duplicates
      - "scoping" - You're asking clarifying questions
      - "ready" - You've compiled the final submission

      When phase is "ready", include the compiled submission in metadata:
      <!--META:{"phase":"ready","submission":{"title":"Short title","category":"feature","description":"Full structured description"}}-->

      Categories: "feature", "improvement", "bug_report", "suggestion"

      ## Guidelines

      - Be conversational and friendly, not robotic
      - Keep responses concise (2-4 sentences per turn, unless presenting the final summary)
      - If the feature exists, explain where to find it and ask if they mean something different
      - If a similar request exists, mention it and ask if they want to follow that instead or if theirs is different
      - For clarifying questions, ask about: who would use it, what problem it solves, how they imagine it working
      - Don't ask more than 2-3 questions total across the conversation
      - For the final description, structure it with: **Problem**, **Proposed Solution**, **Who Benefits**, **Additional Context**
      - If the user just wants to submit quickly or says "just submit it", compile what you have and move to "ready" phase

      #{feature_catalog}

      #{existing_requests_context}
    PROMPT
  end

  def feature_catalog
    <<~CATALOG
      ## TEEEM Feature Catalog (what already exists)

      **Project Management:**
      - Jobs: Full job management with codes, statuses, stages, types, suburbs, custom fields
      - Schedule Master: Gantt chart scheduling with tasks, resources, trades, dependencies, milestones
      - Schedule Templates: Reusable project schedule templates
      - Tasks: Personal and team task management with due dates, assignments
      - Cases: Issue/defect tracking linked to jobs
      - Workflows: Workflow automation and status-based triggers

      **Financial:**
      - Estimates: Project quoting with line items, sections, pricebook integration
      - Purchase Orders: PO management with approvals, supplier linking
      - Pricebook: Standard items, prices, categories for estimates and POs
      - Xero Integration: Accounting sync (contacts, invoices, bank transactions)
      - Bill Inbox: Bill/invoice capture and processing

      **Communications:**
      - Email: Unified inbox, multiple mailboxes, auto-linking to jobs/contacts, templates
      - Chat: Internal messaging, group chats, guest chat links for clients
      - Plans: Plan distribution and tracking
      - E-Signature: Electronic signature workflows
      - Meetings: Meeting scheduling and management

      **Documents & Files:**
      - Warehouse: Universal file storage with folders, search, tagging
      - Document Types: Configurable document classifications
      - Document Templates: Letter/contract templates with merge fields
      - Training/SWMS: Safety documents and training materials
      - Notebooks: Rich-text notebooks linked to jobs or standalone

      **People & CRM:**
      - Contacts: Full CRM with companies, individuals, categories
      - Leads: Lead tracking and pipeline management
      - Site Presence: Site attendance tracking

      **Configuration:**
      - User Management: Roles, permissions, access control
      - Company Settings: Brand colors, holidays, workflows
      - Warehouse Config: Folder structures, document types, storage providers
      - Connections: SharePoint, S3/Wasabi, Xero, Cloudflare integrations
      - Operations: Schedule Master config, contact types, meeting types, supervisor checklists

      **Other:**
      - Dashboard: KPIs, metrics, recent activity, quick actions
      - Calendar: Calendar view of events and schedules
      - AI Support Chat: Built-in AI assistant for help
      - Feature Requests: This feature - submit and vote on ideas
      - WHS: Workplace health and safety management
    CATALOG
  end

  def existing_requests_context
    return "" if @existing_requests.blank?

    requests_text = @existing_requests.first(50).map do |title, description, status|
      desc_preview = description.present? ? " - #{description.to_s.truncate(100)}" : ""
      "- [#{status}] #{title}#{desc_preview}"
    end.join("\n")

    <<~CONTEXT
      ## Existing Feature Requests (check for duplicates)

      #{requests_text}
    CONTEXT
  end

  def build_messages(current_message, history)
    messages = []

    history.last(10).each do |msg|
      messages << {
        role: msg[:role] || msg["role"],
        content: msg[:content] || msg["content"]
      }
    end

    messages << { role: "user", content: current_message }

    messages
  end
end
