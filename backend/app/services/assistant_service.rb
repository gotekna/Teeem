# frozen_string_literal: true

# AssistantService - TEEEM AI Assistant Brain
#
# The core AI service that powers the construction manager's smart assistant.
# Uses Claude Sonnet with tool use to understand natural language requests
# and take actions on behalf of the user (with approval).
#
# Usage:
#   service = AssistantService.new(user: current_user, tenant: current_tenant)
#   result = service.chat(message: "What's due this week?", conversation: conv)
#   # => { content: "You have 5 tasks...", actions: [], tool_calls_made: [...] }
#
# Architecture:
#   - Haiku for simple routing/classification
#   - Sonnet for complex reasoning and tool use
#   - All write actions require user approval (no auto-execute)
#
class AssistantService
  include AnthropicClient

  # Use Sonnet for tool use and complex reasoning
  self.default_claude_model = CLAUDE_SONNET
  self.default_max_tokens = 4096

  MAX_TOOL_ITERATIONS = 8

  def initialize(user:, tenant:)
    @user = user
    @tenant = tenant
  end

  # Main chat entry point
  # @param message [String] User's message
  # @param conversation [AssistantConversation] The conversation context
  # @return [Hash] { content: String, actions: Array<AssistantAction>, tool_calls_made: Array }
  def chat(message:, conversation:)
    # Add user message to conversation
    conversation.add_user_message(message)

    # Build messages for Claude (multi-turn history)
    messages = conversation.messages_for_claude

    # Run the tool use loop
    result = run_tool_loop(messages, conversation)

    # Log the final response
    conversation.add_assistant_message(
      result[:content],
      tool_calls: result[:final_tool_calls],
      metadata: { model: default_claude_model, tool_calls_count: result[:tool_calls_made].size }
    )

    result
  rescue StandardError => e
    Rails.logger.error "[AssistantService] Chat error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    {
      content: "I'm sorry, I encountered an error processing your request. Please try again.",
      actions: [],
      tool_calls_made: []
    }
  end

  private

  # The core tool-use loop: send to Claude, execute tools, repeat until done
  def run_tool_loop(messages, conversation)
    actions = []
    tool_calls_made = []
    iterations = 0

    loop do
      iterations += 1
      break if iterations > MAX_TOOL_ITERATIONS

      # Call Claude with tools
      response = call_claude_with_tools(messages)

      # Extract content blocks
      content_blocks = response["content"] || []
      stop_reason = response["stop_reason"]

      # Collect text and tool_use blocks
      text_parts = []
      tool_use_blocks = []

      content_blocks.each do |block|
        case block["type"]
        when "text"
          text_parts << block["text"]
        when "tool_use"
          tool_use_blocks << block
        end
      end

      # If there are tool calls, execute them and continue the loop
      if tool_use_blocks.any?
        # Record tool calls in conversation for context
        conversation.add_assistant_message(
          text_parts.join("\n"),
          tool_calls: tool_use_blocks.map { |t| { id: t["id"], name: t["name"], input: t["input"] } }
        )

        # Execute each tool and collect results
        tool_results = tool_use_blocks.map do |tool_block|
          tool_calls_made << { name: tool_block["name"], input: tool_block["input"] }
          result = execute_tool(tool_block["name"], tool_block["input"], conversation)

          # If the tool created an action, track it
          actions << result[:action] if result[:action]

          { tool_use_id: tool_block["id"], content: result[:output].to_s }
        end

        # Add tool results to conversation
        conversation.add_tool_results(tool_results)

        # Rebuild messages for next iteration
        messages = conversation.messages_for_claude
      else
        # No tool calls - final response
        return {
          content: text_parts.join("\n"),
          actions: actions,
          tool_calls_made: tool_calls_made,
          final_tool_calls: []
        }
      end
    end

    # If we exhausted iterations, return what we have
    {
      content: "I've completed my analysis. Let me know if you need anything else.",
      actions: actions,
      tool_calls_made: tool_calls_made,
      final_tool_calls: []
    }
  end

  # Call Claude API with tool definitions
  def call_claude_with_tools(messages)
    client = anthropic_client

    client.messages(parameters: {
      model: default_claude_model,
      max_tokens: default_max_tokens,
      system: system_prompt,
      messages: messages,
      tools: tool_definitions
    })
  end

  # Execute a single tool call and return the result
  def execute_tool(name, input, conversation)
    case name
    when "search_emails"
      tool_search_emails(input)
    when "get_job_summary"
      tool_get_job_summary(input)
    when "get_my_tasks"
      tool_get_my_tasks(input)
    when "get_overdue_tasks"
      tool_get_overdue_tasks(input)
    when "draft_email"
      tool_draft_email(input, conversation)
    when "create_task"
      tool_create_task(input, conversation)
    when "update_task"
      tool_update_task(input, conversation)
    when "get_schedule"
      tool_get_schedule(input)
    when "search_contacts"
      tool_search_contacts(input)
    when "get_notifications"
      tool_get_notifications(input)
    when "draft_sms"
      tool_draft_sms(input, conversation)
    else
      { output: "Unknown tool: #{name}", action: nil }
    end
  rescue StandardError => e
    Rails.logger.error "[AssistantService] Tool #{name} error: #{e.message}"
    { output: "Error executing #{name}: #{e.message}", action: nil }
  end

  # ========================================
  # Tool Implementations
  # ========================================

  def tool_search_emails(input)
    query = input["query"]
    limit = (input["limit"] || 10).to_i.clamp(1, 25)

    emails = SyncedEmail
      .where("subject ILIKE ? OR from_name ILIKE ? OR from_email ILIKE ?",
             "%#{query}%", "%#{query}%", "%#{query}%")
      .order(received_at: :desc)
      .limit(limit)

    results = emails.map do |e|
      {
        id: e.id,
        subject: e.subject,
        from: "#{e.from_name} <#{e.from_email}>",
        received_at: e.received_at&.strftime("%d/%m/%Y %H:%M"),
        preview: e.body_preview || e.body_text&.truncate(200),
        is_read: e.is_read,
        importance: e.importance,
        job_id: e.job_id
      }
    end

    { output: results.to_json, action: nil }
  end

  def tool_get_job_summary(input)
    job = find_job(input["job_identifier"])
    return { output: "Job not found", action: nil } unless job

    tasks = job.sm_tasks
    task_stats = {
      total: tasks.count,
      completed: tasks.where(status: "completed").count,
      in_progress: tasks.where(status: "started").count,
      not_started: tasks.where(status: "not_started").count,
      overdue: tasks.where("end_date < ? AND status != 'completed'", Date.current).count
    }

    summary = {
      id: job.id,
      job_code: job.respond_to?(:job_code) ? job.job_code : nil,
      name: job.name,
      status: job.job_status&.name,
      stage: job.job_stage&.name,
      type: job.job_type&.name,
      location: job.location,
      supervisor: job.supervisor&.name,
      tasks: task_stats,
      recent_emails: job.emails.order(received_at: :desc).limit(3).map { |e|
        { subject: e.subject, from: e.from_name, date: e.received_at&.strftime("%d/%m") }
      }
    }

    { output: summary.to_json, action: nil }
  end

  def tool_get_my_tasks(input)
    scope = SmTask.where(assigned_user_id: @user.id)
    scope = scope.where("start_date >= ? AND start_date <= ?",
                        Date.current.beginning_of_week, Date.current.end_of_week) if input["this_week"]
    scope = scope.where("start_date = ?", Date.current) if input["today"]
    scope = scope.where(status: input["status"]) if input["status"].present?
    scope = scope.where.not(status: "completed") unless input["include_completed"]

    tasks = scope.includes(:job, :supplier).order(start_date: :asc, sequence_order: :asc).limit(25)

    results = tasks.map do |t|
      {
        id: t.id,
        name: t.name,
        status: t.status,
        start_date: t.start_date&.strftime("%d/%m/%Y"),
        end_date: t.end_date&.strftime("%d/%m/%Y"),
        job_code: t.job&.respond_to?(:job_code) ? t.job.job_code : nil,
        job_name: t.job&.name,
        supplier: t.supplier&.display_name,
        overdue: t.end_date && t.end_date < Date.current && t.status != "completed"
      }
    end

    { output: results.to_json, action: nil }
  end

  def tool_get_overdue_tasks(input)
    scope = SmTask.where("end_date < ? AND status != 'completed'", Date.current)
    scope = scope.where(assigned_user_id: @user.id) unless input["all_users"]

    tasks = scope.includes(:job, :assigned_user, :supplier)
                 .order(end_date: :asc)
                 .limit(25)

    results = tasks.map do |t|
      days_overdue = (Date.current - t.end_date).to_i
      {
        id: t.id,
        name: t.name,
        status: t.status,
        end_date: t.end_date&.strftime("%d/%m/%Y"),
        days_overdue: days_overdue,
        assigned_to: t.assigned_user&.name,
        job_code: t.job&.respond_to?(:job_code) ? t.job.job_code : nil,
        job_name: t.job&.name,
        supplier: t.supplier&.display_name
      }
    end

    { output: results.to_json, action: nil }
  end

  def tool_draft_email(input, conversation)
    action = AssistantAction.create!(
      user: @user,
      tenant_id: @tenant.id,
      assistant_conversation: conversation,
      action_type: "draft_email",
      status: "pending",
      description: "Draft email to #{input['to']}",
      action_data: {
        to: input["to"],
        subject: input["subject"],
        body: input["body"],
        job_id: input["job_id"]
      }
    )

    {
      output: "Email draft created (Action ##{action.id}). The user will review and approve before sending.",
      action: action
    }
  end

  def tool_create_task(input, conversation)
    action = AssistantAction.create!(
      user: @user,
      tenant_id: @tenant.id,
      assistant_conversation: conversation,
      action_type: "create_task",
      status: "pending",
      description: "Create task: #{input['name']}",
      action_data: {
        name: input["name"],
        description: input["description"],
        start_date: input["start_date"] || Date.current.to_s,
        end_date: input["end_date"] || (Date.current + 1.day).to_s,
        duration_days: input["duration_days"] || 1,
        job_id: input["job_id"],
        assigned_user_id: input["assigned_user_id"] || @user.id,
        status: "not_started"
      }
    )

    {
      output: "Task creation prepared (Action ##{action.id}). The user will review and approve.",
      action: action
    }
  end

  def tool_update_task(input, conversation)
    task = SmTask.find_by(id: input["task_id"])
    return { output: "Task not found", action: nil } unless task

    updates = input.slice("status", "name", "description", "end_date", "assigned_user_id").compact

    action = AssistantAction.create!(
      user: @user,
      tenant_id: @tenant.id,
      assistant_conversation: conversation,
      action_type: "update_task",
      status: "pending",
      description: "Update task ##{task.id}: #{task.name}",
      source_type: "SmTask",
      source_id: task.id,
      action_data: { task_id: task.id, updates: updates }
    )

    {
      output: "Task update prepared (Action ##{action.id}). Changes: #{updates.keys.join(', ')}. The user will review and approve.",
      action: action
    }
  end

  def tool_get_schedule(input)
    job = find_job(input["job_identifier"])
    return { output: "Job not found", action: nil } unless job

    ai_service = SmAiService.new(job)

    summary = {
      job_code: job.respond_to?(:job_code) ? job.job_code : nil,
      job_name: job.name,
      delay_predictions: ai_service.delay_predictions.first(5),
      resource_issues: ai_service.resource_optimization.first(5)
    }

    { output: summary.to_json, action: nil }
  end

  def tool_search_contacts(input)
    query = input["query"]
    contacts = Contact.search(query).limit(10)

    results = contacts.map do |c|
      {
        id: c.id,
        name: c.display_name,
        entity_type: c.entity_type,
        email: c.contact_emails.first&.email,
        phone: c.contact_phones.first&.phone_number
      }
    end

    { output: results.to_json, action: nil }
  end

  def tool_get_notifications(input)
    scope = Notification.where(user: @user)
    scope = scope.where(read: false) if input["unread_only"]
    scope = scope.where("created_at > ?", 24.hours.ago) if input["today_only"]

    notifications = scope.order(created_at: :desc).limit(15)

    results = notifications.map do |n|
      {
        id: n.id,
        type: n.notification_type,
        title: n.title,
        message: n.message,
        read: n.read,
        link: n.link,
        created_at: n.created_at&.strftime("%d/%m/%Y %H:%M")
      }
    end

    { output: results.to_json, action: nil }
  end

  def tool_draft_sms(input, conversation)
    action = AssistantAction.create!(
      user: @user,
      tenant_id: @tenant.id,
      assistant_conversation: conversation,
      action_type: "draft_sms",
      status: "pending",
      description: "Draft SMS to #{input['to']}",
      action_data: {
        to: input["to"],
        body: input["body"],
        contact_id: input["contact_id"]
      }
    )

    {
      output: "SMS draft created (Action ##{action.id}). The user will review and approve before sending.",
      action: action
    }
  end

  # ========================================
  # Helpers
  # ========================================

  # Find a job by code, name, or ID
  def find_job(identifier)
    return nil if identifier.blank?

    # Try by ID first
    job = Job.find_by(id: identifier) if identifier.to_s.match?(/\A\d+\z/)
    return job if job

    # Try by job_code
    job = Job.find_by("LOWER(job_code) = ?", identifier.to_s.downcase) if Job.column_names.include?("job_code")
    return job if job

    # Try by name (partial match)
    Job.where("name ILIKE ?", "%#{identifier}%").first
  end

  # ========================================
  # System Prompt
  # ========================================

  def system_prompt
    <<~PROMPT
      You are the TEEEM AI Assistant, a smart construction management assistant for #{@user.name}#{@tenant ? " at #{@tenant.name}" : ""}.

      You help construction managers by:
      - Answering questions about their jobs, tasks, and schedule
      - Searching emails and contacts
      - Drafting replies to emails and SMS messages
      - Creating and updating tasks
      - Alerting about overdue items and schedule delays

      IMPORTANT RULES:
      1. Be concise and professional. Construction managers are busy.
      2. Use Australian date format (DD/MM/YYYY).
      3. When referring to jobs, use the job code (e.g., "HAR-001") not the ID number.
      4. When creating tasks or drafting emails, always confirm with the user before execution.
      5. If you're unsure about something, ask rather than guess.
      6. For write actions (create task, draft email, update task), use the appropriate tool.
         The user will review and approve before anything is sent or saved.
      7. Never make up data. If you don't have information, say so and offer to search.
      8. Keep responses short. Use bullet points for lists.

      Current date: #{Date.current.strftime("%A, %d %B %Y")}
      Timezone: Australia/Brisbane (AEST)
    PROMPT
  end

  # ========================================
  # Tool Definitions for Claude
  # ========================================

  def tool_definitions
    [
      {
        name: "search_emails",
        description: "Search the user's synced emails by subject, sender name, or email address",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (matches subject, sender name, sender email)" },
            limit: { type: "integer", description: "Max results (default 10, max 25)" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_job_summary",
        description: "Get a summary of a construction job including status, tasks, and recent communications",
        input_schema: {
          type: "object",
          properties: {
            job_identifier: { type: "string", description: "Job code (e.g. 'HAR-001'), name (e.g. 'Harold'), or numeric ID" }
          },
          required: ["job_identifier"]
        }
      },
      {
        name: "get_my_tasks",
        description: "Get the user's assigned tasks with optional filters",
        input_schema: {
          type: "object",
          properties: {
            this_week: { type: "boolean", description: "Only tasks starting this week" },
            today: { type: "boolean", description: "Only tasks starting today" },
            status: { type: "string", description: "Filter by status: not_started, started, completed" },
            include_completed: { type: "boolean", description: "Include completed tasks (default false)" }
          }
        }
      },
      {
        name: "get_overdue_tasks",
        description: "Get overdue tasks (past end date and not completed)",
        input_schema: {
          type: "object",
          properties: {
            all_users: { type: "boolean", description: "Show all users' overdue tasks (default: just mine)" }
          }
        }
      },
      {
        name: "draft_email",
        description: "Draft an email reply. The user will review and approve before it's sent.",
        input_schema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email address or name" },
            subject: { type: "string", description: "Email subject line" },
            body: { type: "string", description: "Email body content" },
            job_id: { type: "integer", description: "Optional job ID to associate with" }
          },
          required: ["to", "subject", "body"]
        }
      },
      {
        name: "create_task",
        description: "Create a new task. The user will review and approve before it's saved.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Task name" },
            description: { type: "string", description: "Task description" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD format)" },
            end_date: { type: "string", description: "Due date (YYYY-MM-DD format)" },
            duration_days: { type: "integer", description: "Duration in days (default 1)" },
            job_id: { type: "integer", description: "Optional job ID to assign to" },
            assigned_user_id: { type: "integer", description: "User ID to assign (default: current user)" }
          },
          required: ["name"]
        }
      },
      {
        name: "update_task",
        description: "Update an existing task. The user will review and approve the changes.",
        input_schema: {
          type: "object",
          properties: {
            task_id: { type: "integer", description: "The task ID to update" },
            status: { type: "string", description: "New status: not_started, started, completed" },
            name: { type: "string", description: "New task name" },
            description: { type: "string", description: "New description" },
            end_date: { type: "string", description: "New due date (YYYY-MM-DD)" },
            assigned_user_id: { type: "integer", description: "New assigned user ID" }
          },
          required: ["task_id"]
        }
      },
      {
        name: "get_schedule",
        description: "Get AI-powered schedule analysis for a job including delay predictions and resource issues",
        input_schema: {
          type: "object",
          properties: {
            job_identifier: { type: "string", description: "Job code, name, or ID" }
          },
          required: ["job_identifier"]
        }
      },
      {
        name: "search_contacts",
        description: "Search contacts (clients, suppliers, subcontractors) by name, email, or phone",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_notifications",
        description: "Get the user's notifications",
        input_schema: {
          type: "object",
          properties: {
            unread_only: { type: "boolean", description: "Only unread notifications (default false)" },
            today_only: { type: "boolean", description: "Only from the last 24 hours (default false)" }
          }
        }
      },
      {
        name: "draft_sms",
        description: "Draft an SMS message. The user will review and approve before it's sent.",
        input_schema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient phone number or contact name" },
            body: { type: "string", description: "SMS message body" },
            contact_id: { type: "integer", description: "Optional contact ID" }
          },
          required: ["to", "body"]
        }
      }
    ]
  end
end
