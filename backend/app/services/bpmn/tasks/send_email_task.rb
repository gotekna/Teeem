module Bpmn
  module Tasks
    class SendEmailTask < BaseTask
      def execute
        recipients = resolve_recipients
        subject_line = get_config("subject")
        body = get_config("body")

        raise "No recipients specified" if recipients.blank?
        raise "No subject specified" if subject_line.blank?

        log_info("Sending email to #{recipients.join(', ')}")

        # Use existing mailer or a generic workflow mailer
        BpmnMailer.workflow_email(
          to: recipients,
          subject: subject_line,
          body: body,
          attachments: resolve_attachments
        ).deliver_later

        {
          sent_to: recipients,
          subject: subject_line,
          sent_at: Time.current.iso8601
        }
      end

      private

      def resolve_recipients
        recipients = []

        case @config["recipient_type"]
        when "static"
          recipients = Array(@config["recipient_value"])
        when "variable"
          value = @variables[@config["recipient_value"]]
          recipients = Array(value)
        when "role"
          role = @config["recipient_value"]
          recipients = User.where(role: role).pluck(:email)
        when "subject_field"
          field = @config["recipient_value"]
          value = @subject.try(field)
          recipients = Array(value)
        when "contact"
          contact_id = @config["contact_id"] || @variables["contact_id"]
          if contact_id
            contact = Contact.find_by(id: contact_id)
            recipients = [ contact.email ] if contact&.email.present?
          end
        end

        # Also check for additional_recipients
        if @config["additional_recipients"].present?
          recipients += Array(@config["additional_recipients"])
        end

        recipients.compact.uniq
      end

      def resolve_attachments
        return [] unless @config["attachments"].present?

        @config["attachments"].map do |attachment_config|
          case attachment_config["type"]
          when "variable"
            @variables[attachment_config["value"]]
          when "document"
            # Could integrate with document generation
            nil
          else
            nil
          end
        end.compact
      end
    end
  end
end
