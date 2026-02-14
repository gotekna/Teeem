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
  # @param current_page [String, nil] The page the user is currently viewing (e.g. "/jobs")
  # @return [Hash] { content: String, source: "ai" }
  def respond(message:, history: [], current_page: nil)
    if ENV["ANTHROPIC_API_KEY"].blank?
      return { content: "Support chat is temporarily unavailable. Please contact support@teeem.com.au", source: "fallback" }
    end

    @current_page = current_page

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

      IMPORTANT - Hyperlinks:
      - ALWAYS include clickable markdown links when mentioning pages or features
      - Format: [Link Text](/route/path)
      - Example: "Go to [Jobs](/jobs) and click New Job" or "Check your [Settings](/settings)"
      - This helps users navigate directly to the right place
      - CRITICAL: ONLY use routes from the list below. NEVER invent or guess a route.
        If you are unsure of the correct route, describe the feature without a link.
        There is NO /templates or /documents page. Never link to those.

      COMPLETE route list (ONLY use these exact routes):

      Main pages:
      - [Dashboard](/dashboard): KPIs, cost maps, activity feeds, quick links
      - [Jobs](/jobs): Create and manage construction/project jobs with job codes, statuses, stages
      - [Contacts](/contacts): CRM for managing clients, suppliers, subcontractors
      - [Email](/email): Integrated email with automatic job/contact linking
      - [Chat](/chat): Internal team messaging, guest chat links, group chats
      - [Cases](/cases): Issue/case tracking linked to jobs
      - [Tasks](/tasks): Task Hub for personal and team tasks
      - [Schedule Master](/schedule-master): Gantt chart scheduling with tasks, resources, trades
      - [Schedule Templates](/schedule-templates): Reusable schedule templates for common project types
      - [Estimates](/estimates): Project estimates and quoting
      - [Purchase Orders](/purchase_orders): Purchase order management
      - [Pricebook](/pricebook): Standard items, prices, categories for estimates and POs
      - [Warehouse](/warehouse): File warehouse - all documents organised in folders (NOT /documents)
      - [Training](/training): Training materials and SWMS documents
      - [Notebooks](/notebooks): Rich-text notebooks linked to jobs or standalone
      - [Calendar](/calendar): Calendar view of events and schedules
      - [Meetings](/meetings): Meeting management
      - [Leads](/leads): Lead tracking and pipeline
      - [Plans](/plans): Plan distribution and management
      - [E-Signature](/e-signature): Electronic signature workflows
      - [Workflows](/workflows): Workflow automation
      - [WHS](/whs): Workplace health and safety
      - [Site Presence](/site-presence): Site attendance tracking

      Job detail pages (replace ID with the job number):
      - /jobs/[id]: Job detail with tabs - Details, Communications, Documents, Schedule, Financials

      Contact detail pages:
      - /contacts/[id]: Contact detail with tabs - Overview, Communications, Documents, User Account

      Settings (under gear icon):
      - [Settings](/settings): Main settings page
      - [User Management](/settings/users): Add/manage users, assign roles
      - [Access Control](/settings/roles): Permissions, user roles, groups
      - [Company Info](/settings/company/info): Company details
      - [Company Documents](/settings/company/documents): Document types and templates
      - [Job Setup](/settings/company/job-setup): Job types, statuses, stages, suburbs
      - [Warehouse Config](/settings/company/warehouse-config): Document folders and file organisation
      - [Holidays](/settings/company/holidays): Public holidays
      - [Connections](/settings/connections): Storage providers (SharePoint, S3/Wasabi), Xero, integrations
      - [Operations](/settings/operations): Schedule Master config, contact types, meeting types
      - [Profile](/settings/profile): Your personal profile
      - [Notifications](/settings/notifications): Notification preferences
      - [Security](/settings/security): Password and two-factor authentication

      TEMPLATES - There is no single "templates" page. Templates are spread across features:
      - Schedule Templates: Reusable project schedules at [Schedule Templates](/schedule-templates). Create standard build schedules, then apply them to new jobs.
      - Document Templates: Letter and contract templates at [Settings > Company > Documents](/settings/company/documents). Create Welcome Letters, Colour Selections, contracts with merge fields.
      - Email Templates: Reusable email templates created from the compose window in [Email](/email). Save frequently-used emails as templates with variables like {{recipient_name}}, {{job_name}}.
      - PO Template Packs: Pre-built sets of purchase orders at [Settings > Operations](/settings/operations). Stamp a full set of POs onto a new job in one click.
      - Invoice Templates: Invoice visual styles at [Settings > Company > Documents](/settings/company/documents).
      - WHS Templates: Safety inspection and induction checklists in [WHS](/whs).
      - Supervisor Checklists: Task completion checklists configured in [Settings > Operations](/settings/operations).
      When a user asks about "templates", ask which type they mean before guiding them.

      Navigation tips:
      - Main menu is on the left sidebar
      - Settings are under the gear icon at the bottom of the sidebar
      - Use the search bar at the top to find anything quickly
      - Documents/files are in [Warehouse](/warehouse), NOT "/documents" or "/templates"

      Important:
      - Keep responses concise (2-4 sentences when possible)
      - Use plain language, not technical jargon
      - ALWAYS link to relevant pages using markdown links like [Page Name](/route)
      - NEVER link to routes not in the list above - this sends users to broken error pages
      - If the question is about a bug or error, suggest they describe what they see
      - For account/billing questions, direct them to their admin or support@teeem.com.au
      - You are chatting with: #{@user&.name || "a user"}#{@tenant ? " from #{@tenant.name}" : ""}
      #{page_context}
    PROMPT
  end

  # Generate page-aware context so the AI knows what screen the user is on
  def page_context
    return "" if @current_page.blank?

    page_hints = {
      "/dashboard" => "The user is on the Dashboard. They can see KPIs, cost maps, recent activity, and quick links to important items.",
      "/jobs" => "The user is on the Jobs list page. They can see all jobs, filter by status (LIVE/Completed), create new jobs with '+ New Job', and click any job to open it.",
      "/contacts" => "The user is on the Contacts list page. They can see all contacts (clients, suppliers, subcontractors), search/filter, and create new contacts. Click a contact to see their details, communications, and documents.",
      "/email" => "The user is on the Email page. They can read/compose emails, switch between mailboxes, and emails are auto-linked to jobs and contacts. Email templates can be saved from the compose window.",
      "/chat" => "The user is on the Chat page. They can send direct messages, create group chats, generate guest chat links for clients, and use Teeem AI support.",
      "/cases" => "The user is on the Cases page. They can track issues, defects, and action items linked to jobs.",
      "/tasks" => "The user is on the Task Hub. They can manage personal and team tasks, set due dates, and track completion.",
      "/schedule-master" => "The user is on Schedule Master (Gantt chart). They can view/edit project schedules, assign resources, set dependencies between tasks, and manage trades.",
      "/schedule-templates" => "The user is on Schedule Templates. They can create, edit, duplicate, and manage reusable schedule templates. Templates can be set as default for new jobs. Click 'View Rows' to edit template tasks.",
      "/estimates" => "The user is on the Estimates page. They can create/manage project estimates, add line items from the pricebook, and convert estimates to purchase orders.",
      "/purchase_orders" => "The user is on the Purchase Orders page. They can create/manage POs linked to jobs, track approvals, and link to suppliers.",
      "/pricebook" => "The user is on the Pricebook. They can manage standard items, prices, and categories used in estimates and purchase orders.",
      "/warehouse" => "The user is on the File Warehouse. This shows all documents organised in folders. They can upload files, create folders, search, and browse by source (Jobs, Email, Corporate, etc.).",
      "/training" => "The user is on the Training page. They can access training materials, SWMS documents, and safety resources.",
      "/notebooks" => "The user is on Notebooks. They can create/edit rich-text notebooks linked to jobs or standalone.",
      "/calendar" => "The user is on the Calendar. They can view scheduled events, meetings, and deadlines.",
      "/meetings" => "The user is on the Meetings page. They can schedule and manage meetings.",
      "/leads" => "The user is on Leads. They can track potential clients and manage the sales pipeline.",
      "/plans" => "The user is on Plans. They can distribute and manage project plans.",
      "/e-signature" => "The user is on E-Signature. They can create and manage electronic signature workflows.",
      "/workflows" => "The user is on Workflows. They can view and manage workflow automations.",
      "/whs" => "The user is on WHS (Workplace Health & Safety). They can manage safety documentation, inspection templates, and induction checklists.",
      "/site-presence" => "The user is on Site Presence. They can track who is on site.",
      "/settings" => "The user is in Settings. Sub-sections: Users, Access Control, Company Info, Documents, Job Setup, Warehouse Config, Connections, Operations, etc.",
      "/settings/users" => "The user is on User Management. They can add/remove users, assign roles, and manage permissions.",
      "/settings/roles" => "The user is on Access Control. They can manage permissions, user roles, and groups.",
      "/settings/company/info" => "The user is on Company Info. They can edit company details.",
      "/settings/company/documents" => "The user is on Company Documents. They can manage document types, document templates (Welcome Letters, contracts, etc.), invoice templates, and bank statement templates.",
      "/settings/company/job-setup" => "The user is on Job Setup. They can configure job types, statuses, stages, and suburbs used across all jobs.",
      "/settings/company/warehouse-config" => "The user is on Warehouse Config. They can configure document folder structures, document types, and how files are organised.",
      "/settings/company/holidays" => "The user is on Holidays. They can manage public holidays for scheduling.",
      "/settings/connections" => "The user is on Connections. They can set up storage providers (SharePoint, S3/Wasabi), Xero integration, and email migration.",
      "/settings/operations" => "The user is on Operations. They can configure Schedule Master settings, contact types, meeting types, supervisor checklists, and PO template packs.",
      "/settings/profile" => "The user is on their Profile settings. They can update their personal details.",
      "/settings/notifications" => "The user is on Notification settings. They can configure notification preferences.",
      "/settings/security" => "The user is on Security settings. They can change password and set up two-factor authentication."
    }

    # Exact match or prefix match for dynamic routes
    hint = page_hints[@current_page]
    unless hint
      # Try matching /jobs/123 → /jobs hint + detail context
      if @current_page.match?(%r{^/jobs/\d+})
        hint = "The user is viewing a specific Job's detail page. They can see/edit job details, view Communications (emails, chat), Documents, Schedule (Gantt), and Financials (estimates, POs). Tabs are at the top of the page."
      elsif @current_page.match?(%r{^/contacts/\d+})
        hint = "The user is viewing a specific Contact's detail page. They can see/edit contact info, view Communications, Documents, and manage the contact's User Account."
      elsif @current_page.match?(%r{^/cases/\d+})
        hint = "The user is viewing a specific Case detail page. They can see case details, linked items, and status."
      elsif @current_page.match?(%r{^/estimates/\d+})
        hint = "The user is viewing a specific Estimate. They can add/edit line items, link to pricebook items, and manage estimate sections."
      elsif @current_page.match?(%r{^/purchase.orders/\d+})
        hint = "The user is viewing a specific Purchase Order. They can see PO lines, approval status, and linked job/supplier."
      elsif @current_page.start_with?("/settings")
        hint = "The user is in a Settings sub-page."
      elsif @current_page.start_with?("/email")
        hint = "The user is viewing their email."
      end
    end

    return "" unless hint

    <<~CTX

      CURRENT PAGE CONTEXT:
      The user is currently viewing: #{@current_page}
      #{hint}
      Tailor your response to what they can see and do on THIS page. Be specific about buttons, tabs, and actions available. Guide them step-by-step through the interface they're looking at right now.
    CTX
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
