# Service to email plans with attachments from storage
class PlanEmailService
  include StorageUploadable

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

    # SSoT: Per-user Outlook credentials removed - using system mailer
    send_via_mailer(attachments)
  rescue StandardError => e
    Rails.logger.error("PlanEmailService error: #{e.message}")
    { success: false, message: e.message }
  end

  # Get the sender email address that will be used
  # SSoT: Per-user Outlook credentials removed - always uses system email
  def self.sender_email_for(user)
    "noreply@teeem.com.au"
  end

  private

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
        result = download_from_storage(revision.storage_path || revision.sharepoint_file_id)
        next unless result[:success]
        content = result[:content]

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
end
