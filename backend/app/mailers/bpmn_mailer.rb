class BpmnMailer < ApplicationMailer
  def workflow_email(to:, subject:, body:, attachments: [])
    @body = body

    attachments.each do |attachment|
      next unless attachment.is_a?(Hash)

      attachments[attachment[:filename]] = {
        mime_type: attachment[:content_type],
        content: attachment[:content]
      }
    end

    mail(
      to: Array(to),
      subject: subject
    )
  end
end
