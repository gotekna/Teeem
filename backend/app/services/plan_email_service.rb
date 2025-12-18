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
      sent_to: @recipients
    }
  rescue StandardError => e
    Rails.logger.error("PlanEmailService error: #{e.message}")
    { success: false, message: e.message }
  end

  private

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
