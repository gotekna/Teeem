# frozen_string_literal: true

# AI-powered support chat using Claude
# First-line support responder - answers questions about Teeem
#
# Usage:
#   service = SupportChatService.new(user: current_user, tenant: current_tenant)
#   response = service.respond(message: "How do I create a job?", history: [...])
#   # => { content: "To create a job, navigate to...", source: "ai" }
#
class SupportChatService
  include AnthropicClient

  # Use Haiku for fast, cost-effective support responses
  self.default_claude_model = CLAUDE_HAIKU
  self.default_max_tokens = 800

  def initialize(user:, tenant: nil)
    @user = user
    @tenant = tenant
  end

  # Generate an AI response to a support message
  # @param message [String] The user's message
  # @param history [Array<Hash>] Previous messages [{role: "user"/"assistant", content: "..."}]
  # @return [Hash] { content: String, source: "ai" }
  def respond(message:, history: [])
    if ENV["ANTHROPIC_API_KEY"].blank?
      return { content: "Support chat is temporarily unavailable. Please contact support@teeem.com.au", source: "fallback" }
    end

    # Build conversation messages for Claude
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
    Rails.logger.error "[SupportChat] AI response failed: #{e.message}"
    { content: "I'm having trouble right now. A team member will follow up shortly.", source: "error" }
  end

  private

  def system_prompt
    <<~PROMPT
      You are Teeem's AI support assistant. Teeem is a project management and business operations platform used by construction and professional services companies in Australia.

      Your role:
      - Answer questions about how to use Teeem
      - Help users find features and navigate the platform
      - Provide helpful, concise answers
      - Be friendly and professional
      - If you don't know the answer, say so honestly and suggest they contact the team

      Key Teeem features you can help with:
      - Jobs: Create and manage construction/project jobs with job codes, statuses, stages
      - Contacts: CRM for managing clients, suppliers, subcontractors
      - Documents: File warehouse with SharePoint/S3/Wasabi integration
      - Schedule Master: Gantt chart scheduling with tasks, resources, trades
      - Estimates & Purchase Orders: Financial management
      - Email: Integrated email with automatic job/contact linking
      - Chat: Internal team messaging, guest chat links, group chats
      - Cases: Issue/case tracking
      - Xero Integration: Accounting sync for contacts and invoices
      - Dashboard: KPIs, cost maps, activity feeds
      - Settings: Company config, user management, integrations

      Navigation tips:
      - Main menu is on the left sidebar
      - Settings are under the gear icon → /settings
      - Each job has tabs: Details, Communications, Documents, Schedule, Financials
      - Contacts have tabs: Overview, Communications, Documents, User Account
      - Use the search bar at the top to find anything quickly

      Important:
      - Keep responses concise (2-4 sentences when possible)
      - Use plain language, not technical jargon
      - If the question is about a bug or error, suggest they describe what they see
      - For account/billing questions, direct them to their admin or support@teeem.com.au
      - You are chatting with: #{@user&.name || "a user"}#{@tenant ? " from #{@tenant.name}" : ""}
    PROMPT
  end

  def build_messages(current_message, history)
    messages = []

    # Include recent history (last 10 messages for context)
    history.last(10).each do |msg|
      messages << {
        role: msg[:role] || msg["role"],
        content: msg[:content] || msg["content"]
      }
    end

    # Add current message
    messages << { role: "user", content: current_message }

    messages
  end
end
