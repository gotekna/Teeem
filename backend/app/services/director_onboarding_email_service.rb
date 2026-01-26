class DirectorOnboardingEmailService
  def initialize(sender: nil)
    @email_service = MicrosoftEmailService.new
    @sender = sender # User object who is sending the email
  end

  # Send invitation email to director
  def send_invitation(request)
    onboarding_url = build_onboarding_url(request.access_token)

    subject = "Director ID Verification Required - #{company_name}"
    body = invitation_email_body(request, onboarding_url)

    result = @email_service.send_email(
      to: request.email,
      subject: subject,
      body: body,
      sender_name: sender_display_name,
      reply_to: sender_reply_to
    )

    if result[:success]
      request.update(invitation_sent_at: Time.current)
      Rails.logger.info "Director onboarding invitation sent to #{request.email}"
    else
      Rails.logger.error "Failed to send invitation to #{request.email}: #{result[:error]}"
    end

    result
  end

  # Send reminder email
  def send_reminder(request)
    onboarding_url = build_onboarding_url(request.access_token)

    subject = "Reminder: Director ID Verification Required - #{company_name}"
    body = reminder_email_body(request, onboarding_url)

    @email_service.send_email(
      to: request.email,
      subject: subject,
      body: body,
      sender_name: sender_display_name,
      reply_to: sender_reply_to
    )
  end

  # Send confirmation email after submission
  def send_submission_confirmation(request)
    subject = "Director ID Verification Received - #{company_name}"
    body = submission_confirmation_body(request)

    @email_service.send_email(
      to: request.email,
      subject: subject,
      body: body,
      sender_name: sender_display_name,
      reply_to: sender_reply_to
    )
  end

  # Send approval notification
  def send_approval_notification(request)
    subject = "Director ID Verification Approved - #{company_name}"
    body = approval_notification_body(request)

    @email_service.send_email(
      to: request.email,
      subject: subject,
      body: body,
      sender_name: sender_display_name,
      reply_to: sender_reply_to
    )
  end

  private

  # SSoT: Get company name from CorporateCompanySetting
  def company_name
    @company_name ||= CorporateCompanySetting.instance.company_name
  end

  # Build sender display name (e.g., "Robert Harder via Tekna Homes")
  def sender_display_name
    return nil unless @sender
    "#{@sender.name} via #{company_name}"
  end

  # Return sender's email for reply-to header
  def sender_reply_to
    return nil unless @sender
    @sender.email
  end

  def build_onboarding_url(access_token)
    frontend_host = ENV["FRONTEND_URL"] || (Rails.env.production? ? "https://teeem.vercel.app" : "https://teeemrob.vercel.app")
    "#{frontend_host}/director-onboarding/#{access_token}"
  end

  def invitation_email_body(request, onboarding_url)
    company_text = request.company.present? ? " for #{request.company.name}" : ""

    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
          .info-box { background-color: #e0f2fe; border-left: 4px solid #0284c7; padding: 12px; margin: 16px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>#{company_name}</h1>
            <p>Director ID Verification</p>
          </div>
          <div class="content">
            <p>Dear #{request.first_name},</p>

            <p>As part of our compliance requirements#{company_text}, we need to verify your identity as a company director.</p>

            <div class="info-box">
              <strong>What you'll need:</strong>
              <ul>
                <li>Your Director ID number</li>
                <li>Driver's licence (front and back)</li>
                <li>A recent photo of yourself</li>
                <li>Passport (optional but recommended)</li>
              </ul>
            </div>

            <p>Please click the button below to complete your verification:</p>

            <p style="text-align: center;">
              <a href="#{onboarding_url}" class="button" style="color: white;">Complete Verification</a>
            </p>

            <p>Or copy and paste this link into your browser:<br>
            <a href="#{onboarding_url}">#{onboarding_url}</a></p>

            <p><strong>This link will expire in 30 days.</strong></p>

            <p>If you have any questions, please don't hesitate to contact us.</p>

            <p>Best regards,<br>#{company_name} Administration</p>
          </div>
          <div class="footer">
            <p>This is an automated message from #{company_name}.</p>
            <p>If you did not expect this email, please contact us immediately.</p>
          </div>
        </div>
      </body>
      </html>
    HTML
  end

  def reminder_email_body(request, onboarding_url)
    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>#{company_name}</h1>
            <p>Reminder: Director ID Verification</p>
          </div>
          <div class="content">
            <p>Dear #{request.first_name},</p>

            <p>This is a friendly reminder that we still need you to complete your Director ID verification.</p>

            <p style="text-align: center;">
              <a href="#{onboarding_url}" class="button" style="color: white;">Complete Verification Now</a>
            </p>

            <p>Or copy and paste this link into your browser:<br>
            <a href="#{onboarding_url}">#{onboarding_url}</a></p>

            <p>If you've already completed this or have any questions, please contact us.</p>

            <p>Best regards,<br>#{company_name} Administration</p>
          </div>
          <div class="footer">
            <p>This is an automated reminder from #{company_name}.</p>
          </div>
        </div>
      </body>
      </html>
    HTML
  end

  def submission_confirmation_body(request)
    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>#{company_name}</h1>
            <p>Verification Received</p>
          </div>
          <div class="content">
            <p>Dear #{request.first_name},</p>

            <p>Thank you for submitting your Director ID verification.</p>

            <p>We have received your information and documents. Our team will review your submission and you'll receive confirmation once it has been approved.</p>

            <p>Submitted on: #{request.submitted_at&.strftime('%d %B %Y at %H:%M')}</p>

            <p>If you have any questions, please don't hesitate to contact us.</p>

            <p>Best regards,<br>#{company_name} Administration</p>
          </div>
          <div class="footer">
            <p>This is an automated message from #{company_name}.</p>
          </div>
        </div>
      </body>
      </html>
    HTML
  end

  def approval_notification_body(request)
    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>#{company_name}</h1>
            <p>Verification Approved</p>
          </div>
          <div class="content">
            <p>Dear #{request.first_name},</p>

            <p>Great news! Your Director ID verification has been approved.</p>

            <p>Your details have been added to our system and no further action is required from you at this time.</p>

            <p>Thank you for your cooperation.</p>

            <p>Best regards,<br>#{company_name} Administration</p>
          </div>
          <div class="footer">
            <p>This is an automated message from #{company_name}.</p>
          </div>
        </div>
      </body>
      </html>
    HTML
  end
end
