class ComplianceReminderService
  def initialize
    @today = Date.today
  end

  # Check all compliance items and send reminders
  def send_reminders
    sent_count = 0

    # Check for items needing reminders at different intervals
    [ 90, 60, 30, 7 ].each do |days_before|
      items = find_items_needing_reminder(days_before)

      items.each do |item|
        if send_reminder(item, days_before)
          sent_count += 1
        end
      end
    end

    # Also send overdue reminders
    overdue_items = CorporateCompanyComplianceItem.overdue
    overdue_items.each do |item|
      if send_overdue_reminder(item)
        sent_count += 1
      end
    end

    Rails.logger.info("Sent #{sent_count} compliance reminders")

    {
      success: true,
      reminders_sent: sent_count
    }
  end

  # Find items that need reminders today
  def find_items_needing_reminder(days_before)
    target_date = @today + days_before.days

    CorporateCompanyComplianceItem
      .includes(:corporate_company)
      .where(status: "pending")
      .where(due_date: target_date)
      .select { |item| item.needs_reminder?(days_before) }
  end

  # Send reminder email for an item
  def send_reminder(item, days_before)
    recipients = parse_recipients(item)
    return false if recipients.empty?

    subject = "#{item.company.name} - #{item.title} - Due in #{days_before} days"
    body = build_reminder_email(item, days_before)

    send_email(recipients, subject, body)

    # Log activity
    item.company.corporate_company_activities.create!(
      activity_type: "compliance_reminder_sent",
      description: "Reminder sent for: #{item.title} (#{days_before} days before due)",
      metadata: { compliance_item_id: item.id, days_before: days_before },
      performed_by: User.first, # System user
      occurred_at: Time.current
    )

    true
  rescue StandardError => e
    Rails.logger.error("Failed to send compliance reminder for item #{item.id}: #{e.message}")
    false
  end

  # Send overdue reminder
  def send_overdue_reminder(item)
    recipients = parse_recipients(item)
    return false if recipients.empty?

    days_overdue = (@today - item.due_date).to_i

    subject = "OVERDUE: #{item.company.name} - #{item.title}"
    body = build_overdue_email(item, days_overdue)

    send_email(recipients, subject, body)

    # Log activity
    item.company.corporate_company_activities.create!(
      activity_type: "compliance_overdue_reminder_sent",
      description: "Overdue reminder sent for: #{item.title} (#{days_overdue} days overdue)",
      metadata: { compliance_item_id: item.id, days_overdue: days_overdue },
      performed_by: User.first,
      occurred_at: Time.current
    )

    true
  rescue StandardError => e
    Rails.logger.error("Failed to send overdue reminder for item #{item.id}: #{e.message}")
    false
  end

  private

  def parse_recipients(item)
    return [] unless item.notification_recipients.present?

    # Parse comma-separated email addresses
    item.notification_recipients.split(",").map(&:strip).select { |email| valid_email?(email) }
  end

  def valid_email?(email)
    email.match?(URI::MailTo::EMAIL_REGEXP)
  end

  def build_reminder_email(item, days_before)
    <<~EMAIL
      Compliance Reminder for #{item.company.name}

      Item: #{item.title}
      Type: #{item.formatted_compliance_type}
      Due Date: #{item.due_date.strftime('%d %B %Y')}
      Days Until Due: #{days_before}

      Description:
      #{item.description}

      Please ensure this compliance requirement is completed by the due date.

      ---
      This is an automated reminder from TEEEM Corporate Management System
    EMAIL
  end

  def build_overdue_email(item, days_overdue)
    <<~EMAIL
      ⚠️ OVERDUE COMPLIANCE ITEM - #{item.company.name}

      Item: #{item.title}
      Type: #{item.formatted_compliance_type}
      Due Date: #{item.due_date.strftime('%d %B %Y')}
      Days Overdue: #{days_overdue}

      Description:
      #{item.description}

      ⚠️ This compliance item is now OVERDUE. Immediate action is required.

      ---
      This is an automated reminder from TEEEM Corporate Management System
    EMAIL
  end

  def send_email(recipients, subject, body)
    # TODO: Integrate with existing email service (ActionMailer or MicrosoftAppGraphClient)
    # For now, log the email
    Rails.logger.info("Email to #{recipients.join(', ')}: #{subject}")

    # Example integration with ActionMailer:
    # ComplianceMailer.reminder_email(recipients, subject, body).deliver_later

    true
  end
end
