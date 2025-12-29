class AssetReminderService
  def initialize
    @today = Date.today
  end

  # Check all assets and send reminders for insurance and service
  def send_reminders
    sent_count = 0

    # Insurance expiry reminders
    sent_count += send_insurance_reminders

    # Service due reminders
    sent_count += send_service_reminders

    Rails.logger.info("Sent #{sent_count} asset reminders")

    {
      success: true,
      reminders_sent: sent_count
    }
  end

  # Send insurance expiry reminders
  def send_insurance_reminders
    sent_count = 0

    # Check for insurance expiring in 90, 60, 30, 7 days
    [ 90, 60, 30, 7 ].each do |days_before|
      target_date = @today + days_before.days

      insurances = AssetInsurance
        .includes(asset: :corporate_company)
        .where(status: "active")
        .where(renewal_date: target_date)

      insurances.each do |insurance|
        if send_insurance_reminder(insurance, days_before)
          sent_count += 1
        end
      end
    end

    # Overdue insurance
    overdue_insurances = AssetInsurance.overdue.includes(asset: :corporate_company)
    overdue_insurances.each do |insurance|
      if send_insurance_overdue_reminder(insurance)
        sent_count += 1
      end
    end

    sent_count
  end

  # Send service due reminders
  def send_service_reminders
    sent_count = 0

    # Find assets with service due soon (based on last service record)
    assets_needing_service = Asset
      .includes(:asset_service_histories, :company)
      .where(status: "active")

    assets_needing_service.each do |asset|
      last_service = asset.last_service

      next unless last_service&.next_service_date.present?

      days_until_service = (last_service.next_service_date - @today).to_i

      # Send reminder if service is due in 30, 7 days or overdue
      if days_until_service == 30 || days_until_service == 7
        if send_service_due_reminder(asset, last_service, days_until_service)
          sent_count += 1
        end
      elsif days_until_service < 0
        if send_service_overdue_reminder(asset, last_service, days_until_service.abs)
          sent_count += 1
        end
      end
    end

    sent_count
  end

  private

  def send_insurance_reminder(insurance, days_before)
    # Get company email recipients (can be configured in company settings)
    recipients = get_company_contacts(insurance.asset.company)
    return false if recipients.empty?

    subject = "#{insurance.asset.company.name} - Insurance Renewal Due: #{insurance.asset.name}"
    body = build_insurance_reminder_email(insurance, days_before)

    send_email(recipients, subject, body)

    # Log activity
    insurance.asset.company.corporate_company_activities.create!(
      activity_type: "insurance_reminder_sent",
      description: "Insurance renewal reminder sent for #{insurance.asset.name}",
      metadata: {
        asset_id: insurance.asset.id,
        insurance_id: insurance.id,
        days_before: days_before,
        renewal_date: insurance.renewal_date
      },
      performed_by: User.first,
      occurred_at: Time.current
    )

    true
  rescue StandardError => e
    Rails.logger.error("Failed to send insurance reminder for asset #{insurance.asset.id}: #{e.message}")
    false
  end

  def send_insurance_overdue_reminder(insurance)
    recipients = get_company_contacts(insurance.asset.company)
    return false if recipients.empty?

    days_overdue = (@today - insurance.renewal_date).to_i

    subject = "⚠️ OVERDUE: Insurance Expired - #{insurance.asset.name}"
    body = build_insurance_overdue_email(insurance, days_overdue)

    send_email(recipients, subject, body)

    # Log activity
    insurance.asset.company.corporate_company_activities.create!(
      activity_type: "insurance_overdue_reminder_sent",
      description: "Insurance overdue reminder sent for #{insurance.asset.name}",
      metadata: {
        asset_id: insurance.asset.id,
        insurance_id: insurance.id,
        days_overdue: days_overdue
      },
      performed_by: User.first,
      occurred_at: Time.current
    )

    true
  rescue StandardError => e
    Rails.logger.error("Failed to send insurance overdue reminder: #{e.message}")
    false
  end

  def send_service_due_reminder(asset, last_service, days_until)
    recipients = get_company_contacts(asset.company)
    return false if recipients.empty?

    subject = "#{asset.company.name} - Service Due: #{asset.name}"
    body = build_service_due_email(asset, last_service, days_until)

    send_email(recipients, subject, body)

    # Log activity
    asset.company.corporate_company_activities.create!(
      activity_type: "service_reminder_sent",
      description: "Service reminder sent for #{asset.name}",
      metadata: {
        asset_id: asset.id,
        service_id: last_service.id,
        days_until: days_until,
        next_service_date: last_service.next_service_date
      },
      performed_by: User.first,
      occurred_at: Time.current
    )

    true
  rescue StandardError => e
    Rails.logger.error("Failed to send service reminder for asset #{asset.id}: #{e.message}")
    false
  end

  def send_service_overdue_reminder(asset, last_service, days_overdue)
    recipients = get_company_contacts(asset.company)
    return false if recipients.empty?

    subject = "⚠️ OVERDUE: Service Overdue - #{asset.name}"
    body = build_service_overdue_email(asset, last_service, days_overdue)

    send_email(recipients, subject, body)

    # Log activity
    asset.company.corporate_company_activities.create!(
      activity_type: "service_overdue_reminder_sent",
      description: "Service overdue reminder sent for #{asset.name}",
      metadata: {
        asset_id: asset.id,
        days_overdue: days_overdue
      },
      performed_by: User.first,
      occurred_at: Time.current
    )

    true
  rescue StandardError => e
    Rails.logger.error("Failed to send service overdue reminder: #{e.message}")
    false
  end

  def get_company_contacts(company)
    # Get finance team emails from company metadata or use a default list
    # This can be customized based on company settings
    finance_emails = company.metadata["finance_team_emails"] if company.metadata.present?

    if finance_emails.present?
      finance_emails.is_a?(Array) ? finance_emails : [ finance_emails ]
    else
      # Default to admin users (SSoT: user_roles + roles tables)
      User.with_role("admin").pluck(:email)
    end
  end

  def build_insurance_reminder_email(insurance, days_before)
    <<~EMAIL
      Insurance Renewal Reminder - #{insurance.asset.company.name}

      Asset: #{insurance.asset.display_name}
      Type: #{insurance.asset.asset_type.titleize}
      Registration: #{insurance.asset.registration_number}

      Insurance Details:
      Insurer: #{insurance.insurer_name}
      Policy Number: #{insurance.policy_number}
      Renewal Date: #{insurance.renewal_date.strftime('%d %B %Y')}
      Days Until Renewal: #{days_before}
      Premium: $#{insurance.premium_amount}
      Coverage: $#{insurance.coverage_amount}

      Broker Contact:
      #{insurance.broker_name}
      #{insurance.broker_contact_name}
      #{insurance.broker_email}
      #{insurance.broker_phone}

      Please arrange renewal to ensure continuous coverage.

      ---
      This is an automated reminder from TEEEM Corporate Management System
    EMAIL
  end

  def build_insurance_overdue_email(insurance, days_overdue)
    <<~EMAIL
      ⚠️ INSURANCE EXPIRED - #{insurance.asset.company.name}

      Asset: #{insurance.asset.display_name}
      Type: #{insurance.asset.asset_type.titleize}
      Registration: #{insurance.asset.registration_number}

      ⚠️ Insurance Coverage Has EXPIRED

      Expiry Date: #{insurance.renewal_date.strftime('%d %B %Y')}
      Days Overdue: #{days_overdue}

      Insurer: #{insurance.insurer_name}
      Policy Number: #{insurance.policy_number}

      ⚠️ IMMEDIATE ACTION REQUIRED - Asset is currently uninsured.

      ---
      This is an automated reminder from TEEEM Corporate Management System
    EMAIL
  end

  def build_service_due_email(asset, service, days_until)
    <<~EMAIL
      Service Due Reminder - #{asset.company.name}

      Asset: #{asset.display_name}
      Type: #{asset.asset_type.titleize}
      Registration: #{asset.registration_number}
      Location: #{asset.location}

      Service Information:
      Last Service: #{service.service_date.strftime('%d %B %Y')}
      Next Service Due: #{service.next_service_date.strftime('%d %B %Y')}
      Days Until Due: #{days_until}

      Last Service Details:
      Type: #{service.formatted_service_type}
      Provider: #{service.service_provider}
      Cost: $#{service.cost}

      Please arrange service to maintain asset in good condition.

      ---
      This is an automated reminder from TEEEM Corporate Management System
    EMAIL
  end

  def build_service_overdue_email(asset, service, days_overdue)
    <<~EMAIL
      ⚠️ SERVICE OVERDUE - #{asset.company.name}

      Asset: #{asset.display_name}
      Type: #{asset.asset_type.titleize}
      Registration: #{asset.registration_number}

      ⚠️ Service is OVERDUE

      Service Due Date: #{service.next_service_date.strftime('%d %B %Y')}
      Days Overdue: #{days_overdue}

      Last Service: #{service.service_date.strftime('%d %B %Y')}

      ⚠️ IMMEDIATE ATTENTION REQUIRED

      ---
      This is an automated reminder from TEEEM Corporate Management System
    EMAIL
  end

  def send_email(recipients, subject, body)
    # TODO: Integrate with existing email service
    Rails.logger.info("Email to #{recipients.join(', ')}: #{subject}")

    # Example integration:
    # AssetReminderMailer.reminder_email(recipients, subject, body).deliver_later

    true
  end
end
