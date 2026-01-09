module Bpmn
  module Tasks
    class SendNotificationTask < BaseTask
      def execute
        title = get_config("title", interpolate_value: true)
        message = get_config("message", interpolate_value: true)
        notification_type = @config["notification_type"] || "info"

        raise "No title specified" if title.blank?
        raise "No message specified" if message.blank?

        log_info("Sending notification: #{title}")

        recipients = resolve_recipients
        notifications_sent = []

        recipients.each do |recipient|
          notification = Notification.create!(
            user: recipient,
            title: title,
            message: message,
            notification_type: notification_type,
            notifiable: @subject,
            metadata: {
              workflow_instance_id: @instance.id,
              workflow_name: @instance.bpmn_process.name
            }
          )
          notifications_sent << { user_id: recipient.id, notification_id: notification.id }

          # Send push notification if enabled
          if @config["send_push"] && recipient.push_enabled?
            PushNotificationJob.perform_later(notification.id)
          end
        end

        {
          title: title,
          recipients_count: notifications_sent.count,
          notification_ids: notifications_sent.map { |n| n[:notification_id] },
          sent_at: Time.current.iso8601
        }
      end

      private

      def resolve_recipients
        recipients = []

        case @config["recipient_type"]
        when "user"
          user = User.find_by(id: @config["recipient_id"])
          recipients << user if user
        when "users"
          user_ids = Array(@config["recipient_ids"])
          recipients = User.where(id: user_ids).to_a
        when "role"
          role = @config["role"]
          recipients = User.with_role(role).to_a
        when "variable"
          var_value = @variables[@config["recipient_variable"]]
          if var_value.is_a?(Array)
            recipients = User.where(id: var_value).to_a
          else
            user = User.find_by(id: var_value)
            recipients << user if user
          end
        when "subject_field"
          field = @config["recipient_field"]
          user = @subject.try(field)
          recipients << user if user.is_a?(User)
        when "all_admins"
          recipients = User.with_role("admin").to_a
        end

        recipients.compact.uniq
      end
    end
  end
end
