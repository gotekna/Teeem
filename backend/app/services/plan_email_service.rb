# Service to email plans with attachments from SharePoint
class PlanEmailService
  def initialize(plans:, recipients:, subject:, body:, sender: nil)
    @plans = plans
    @recipients = Array(recipients)
    @subject = subject
    @body = body
    @sender = sender
  end

  def send!
    return { success: false, message: 'No plans to send' } if @plans.empty?
    return { success: false, message: 'No recipients' } if @recipients.empty?

    attachments = collect_attachments

    if attachments.empty?
      return { success: false, message: 'No plan files found to attach' }
    end

    # Try to send via Microsoft Graph (user's Outlook) if available
    if @sender&.outlook_credential&.valid_credential?
      send_via_outlook(attachments)
    else
      send_via_mailer(attachments)
    end
  rescue StandardError => e
    Rails.logger.error("PlanEmailService error: #{e.message}")
    { success: false, message: e.message }
  end

  # Get the sender email address that will be used
  def self.sender_email_for(user)
    if user&.outlook_credential&.valid_credential?
      user.email
    else
      # Fallback to system email (from ApplicationMailer default)
      "noreply@teeem.com.au"
    end
  end

  private

  def send_via_outlook(attachments)
    outlook = OutlookService.new(@sender)

    # Convert attachments to Outlook format (base64 encoded)
    outlook_attachments = attachments.map do |att|
      {
        name: att[:filename],
        content_type: att[:content_type],
        content: Base64.strict_encode64(att[:content])
      }
    end

    # Convert plain text body to HTML
    html_body = @body.gsub("\n", "<br>")

    result = outlook.send_email(
      to: @recipients,
      subject: @subject,
      body: html_body,
      attachments: outlook_attachments
    )

    if result[:success]
      {
        success: true,
        message: "Email sent successfully with #{attachments.size} plan(s)",
        sent_to: @recipients,
        sent_from: @sender.email
      }
    else
      # Fall back to mailer if Outlook fails
      Rails.logger.warn("Outlook send failed: #{result[:error]}, falling back to mailer")
      send_via_mailer(attachments)
    end
  end

  def send_via_mailer(attachments)
    # Send email using BpmnMailer (handles attachments)
    BpmnMailer.workflow_email(
      to: @recipients,
      subject: @subject,
      body: @body,
      attachments: attachments
    ).deliver_later

    {
      success: true,
      message: "Email sent successfully with #{attachments.size} plan(s)",
      sent_to: @recipients,
      sent_from: "noreply@teeem.com.au"
    }
  end

  def collect_attachments
    attachments = []

    @plans.each do |plan|
      revision = plan.current_revision
      next unless revision&.has_file?

      begin
        content = download_from_sharepoint(revision.sharepoint_file_id)
        next unless content

        attachments << {
          filename: revision.file_name || "#{plan.display_name}.pdf",
          content_type: 'application/pdf',
          content: content
        }
      rescue StandardError => e
        Rails.logger.warn("Failed to download plan #{plan.id}: #{e.message}")
        next
      end
    end

    attachments
  end

  def download_from_sharepoint(file_id)
    return nil if file_id.blank?

    credential = OrganizationSharePointCredential.active_credential
    return nil unless credential&.valid_credential?

    client = MicrosoftGraphClient.new(credential)
    client.download_file(file_id)
  end
end
