# frozen_string_literal: true

# DailyDigestService - Morning briefing data aggregation
#
# Pure database aggregation (no AI calls, $0/month).
# Generates a personalized daily briefing for a user:
# - Tasks due today
# - Overdue tasks
# - Follow-up emails due
# - Unanswered business emails (48hrs+)
# - Pending PO approvals
# - Active alert count
#
# Usage:
#   service = DailyDigestService.new(user: user)
#   digest = service.generate
#   # => { greeting: "Good morning Rob", sections: [...], has_items: true }
#
# Formats for different channels:
#   service.format_for(:web)      # => HTML card
#   service.format_for(:sms)      # => Plain text (< 1600 chars)
#   service.format_for(:slack)    # => Slack blocks JSON
#
class DailyDigestService
  def initialize(user:)
    @user = user
  end

  # Generate the full digest data
  # @return [Hash] { greeting: String, sections: Array, has_items: Boolean, generated_at: String }
  def generate
    sections = []

    tasks_due = tasks_due_today
    sections << { type: "tasks_due", title: "Tasks Due Today", count: tasks_due.size, items: tasks_due } if tasks_due.any?

    overdue = overdue_tasks
    sections << { type: "overdue", title: "Overdue Tasks", count: overdue.size, items: overdue } if overdue.any?

    follow_ups = follow_up_emails
    sections << { type: "follow_ups", title: "Email Follow-ups Due", count: follow_ups.size, items: follow_ups } if follow_ups.any?

    unanswered = unanswered_emails
    sections << { type: "unanswered", title: "Awaiting Your Reply (48h+)", count: unanswered.size, items: unanswered } if unanswered.any?

    pending_pos = pending_po_approvals
    sections << { type: "pending_pos", title: "Pending PO Approvals", count: pending_pos.size, items: pending_pos } if pending_pos.any?

    alert_count = active_alert_count

    {
      greeting: greeting_text,
      sections: sections,
      has_items: sections.any?,
      alert_count: alert_count,
      generated_at: Time.current.in_time_zone("Australia/Brisbane").strftime("%d/%m/%Y %H:%M"),
      user_name: @user.name
    }
  end

  # Format digest for a specific channel
  # @param channel [Symbol] :web, :sms, :whatsapp, :slack
  # @return [String|Hash] Formatted content
  def format_for(channel)
    digest = generate
    return nil unless digest[:has_items]

    case channel
    when :web
      format_web(digest)
    when :sms, :whatsapp, :signal
      format_plain_text(digest)
    when :slack
      format_slack(digest)
    else
      format_plain_text(digest)
    end
  end

  private

  def greeting_text
    hour = Time.current.in_time_zone("Australia/Brisbane").hour
    name = @user.name&.split(" ")&.first || "there"

    greeting = case hour
    when 0..11 then "Good morning"
    when 12..16 then "Good afternoon"
    else "Good evening"
    end

    "#{greeting} #{name}"
  end

  def tasks_due_today
    SmTask.where(assigned_user_id: @user.id)
      .where(start_date: Date.current)
      .where.not(status: "completed")
      .includes(:job)
      .order(:sequence_order)
      .limit(10)
      .map do |t|
        {
          id: t.id,
          name: t.name,
          status: t.status,
          job_name: t.job&.name,
          priority: t.end_date && t.end_date <= Date.current ? "high" : "medium"
        }
      end
  end

  def overdue_tasks
    SmTask.where(assigned_user_id: @user.id)
      .where("end_date < ?", Date.current)
      .where.not(status: "completed")
      .includes(:job)
      .order(end_date: :asc)
      .limit(10)
      .map do |t|
        {
          id: t.id,
          name: t.name,
          days_overdue: (Date.current - t.end_date).to_i,
          job_name: t.job&.name
        }
      end
  end

  def follow_up_emails
    SyncedEmail.follow_up_due
      .where("received_at > ?", 30.days.ago)
      .order(follow_up_date: :asc)
      .limit(10)
      .map do |e|
        {
          id: e.id,
          subject: e.subject&.truncate(80),
          from: e.from_name || e.from_email,
          follow_up_reason: e.follow_up_reason
        }
      end
  end

  def unanswered_emails
    SyncedEmail.not_spam
      .where(is_read: true, is_latest_in_thread: true)
      .where("received_at < ? AND received_at > ?", 48.hours.ago, 7.days.ago)
      .where("email_classification->>'email_type' IS DISTINCT FROM ?", "marketing")
      .where("email_classification->>'email_type' IS DISTINCT FROM ?", "transactional")
      .order(received_at: :desc)
      .limit(10)
      .map do |e|
        {
          id: e.id,
          subject: e.subject&.truncate(80),
          from: e.from_name || e.from_email,
          hours_waiting: ((Time.current - e.received_at) / 3600).to_i
        }
      end
  end

  def pending_po_approvals
    # Check for PurchaseOrders in pending_approval status
    if defined?(PurchaseOrder) && PurchaseOrder.respond_to?(:column_names) && PurchaseOrder.column_names.include?("status")
      PurchaseOrder.where(status: "pending_approval")
        .order(created_at: :desc)
        .limit(5)
        .map do |po|
          {
            id: po.id,
            po_number: po.respond_to?(:po_number) ? po.po_number : "PO-#{po.id}",
            supplier: po.respond_to?(:supplier_name) ? po.supplier_name : nil,
            total: po.respond_to?(:total_amount) ? po.total_amount : nil
          }
        end
    else
      []
    end
  rescue StandardError
    []
  end

  def active_alert_count
    AssistantAlert.where(user: @user).active.count
  end

  # ========================================
  # Channel Formatters
  # ========================================

  def format_web(digest)
    # Web format is just the raw digest hash (frontend renders it)
    digest
  end

  def format_plain_text(digest)
    lines = ["#{digest[:greeting]}! Here's your daily briefing:\n"]

    digest[:sections].each do |section|
      lines << "#{section[:title]} (#{section[:count]}):"
      section[:items].first(3).each do |item|
        lines << case section[:type]
        when "tasks_due"
          "  - #{item[:name]}#{item[:job_name] ? " (#{item[:job_name]})" : ""}"
        when "overdue"
          "  - #{item[:name]} (#{item[:days_overdue]}d overdue)"
        when "follow_ups"
          "  - #{item[:from]}: #{item[:subject]}"
        when "unanswered"
          "  - #{item[:from]}: #{item[:subject]} (#{item[:hours_waiting]}h)"
        when "pending_pos"
          "  - #{item[:po_number]}#{item[:supplier] ? " - #{item[:supplier]}" : ""}"
        else
          "  - #{item[:name] || item[:subject]}"
        end
      end
      lines << "  ...and #{section[:count] - 3} more" if section[:count] > 3
      lines << ""
    end

    lines << "Open TEEEM to take action."
    lines.join("\n").truncate(1500) # SMS limit
  end

  def format_slack(digest)
    blocks = [{
      type: "header",
      text: { type: "plain_text", text: "#{digest[:greeting]}! Daily Briefing" }
    }]

    digest[:sections].each do |section|
      blocks << { type: "divider" }
      blocks << {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*#{section[:title]}* (#{section[:count]})"
        }
      }

      items_text = section[:items].first(5).map do |item|
        case section[:type]
        when "tasks_due"
          "• #{item[:name]}#{item[:job_name] ? " _(#{item[:job_name]})_" : ""}"
        when "overdue"
          "• #{item[:name]} _(#{item[:days_overdue]}d overdue)_"
        when "follow_ups"
          "• #{item[:from]}: #{item[:subject]}"
        when "unanswered"
          "• #{item[:from]}: #{item[:subject]} _(#{item[:hours_waiting]}h)_"
        else
          "• #{item[:name] || item[:subject]}"
        end
      end.join("\n")

      blocks << {
        type: "section",
        text: { type: "mrkdwn", text: items_text }
      }
    end

    { blocks: blocks }
  end
end
