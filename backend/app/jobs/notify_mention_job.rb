# frozen_string_literal: true

# Sends a notification when a user is @mentioned in a comment
#
# Called from SmComment#notify_mentions after_create callback
#
class NotifyMentionJob < ApplicationJob
  queue_as :default

  def perform(mention_id)
    mention = SmCommentMention.find_by(id: mention_id)
    return unless mention

    # Only notify user mentions (not resource mentions)
    return unless mention.user_id.present?

    comment = mention.comment
    return unless comment

    # Don't notify the author for mentioning themselves
    return if mention.user_id == comment.author_id

    task = comment.task
    job_name = task&.job&.name || "Unknown Job"

    Notification.create!(
      user_id: mention.user_id,
      notifiable: comment,
      notification_type: "mention",
      title: "You were mentioned in a comment",
      message: "#{comment.author&.name || 'Someone'} mentioned you on task \"#{task&.name}\" (#{job_name}): \"#{comment.body.truncate(100)}\""
    )

    Rails.logger.info "[NotifyMentionJob] Notified user #{mention.user_id} about mention in comment #{comment.id}"
  rescue StandardError => e
    Rails.logger.error "[NotifyMentionJob] Failed to send mention notification: #{e.message}"
    # Don't re-raise - notification failures shouldn't break the app
  end
end
