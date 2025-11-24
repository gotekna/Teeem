# frozen_string_literal: true

# SmComment - Discussion threads on tasks
#
# Features:
# - Rich text body with @mentions
# - Thread replies (parent_id)
# - Edit history
# - Soft delete
#
class SmComment < ApplicationRecord
  belongs_to :task, class_name: 'SmTask', foreign_key: 'sm_task_id'
  belongs_to :author, class_name: 'User'
  belongs_to :parent, class_name: 'SmComment', optional: true
  belongs_to :resource, class_name: 'SmResource', optional: true

  has_many :replies, class_name: 'SmComment', foreign_key: 'parent_id', dependent: :destroy
  has_many :mentions, class_name: 'SmCommentMention', dependent: :destroy

  validates :body, presence: true, length: { maximum: 5000 }

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :oldest_first, -> { order(created_at: :asc) }
  scope :top_level, -> { where(parent_id: nil) }
  scope :not_deleted, -> { where(deleted_at: nil) }
  scope :for_task, ->(task_id) { where(sm_task_id: task_id) }

  # Callbacks
  after_create :extract_mentions
  after_create :track_activity
  after_create :notify_mentions

  # Instance methods
  def edited?
    updated_at > created_at + 1.minute
  end

  def deleted?
    deleted_at.present?
  end

  def soft_delete!
    update!(deleted_at: Time.current, body: '[Comment deleted]')
  end

  def reply_count
    replies.not_deleted.count
  end

  def mentioned_users
    User.where(id: mentions.pluck(:user_id))
  end

  def mentioned_resources
    SmResource.where(id: mentions.where.not(resource_id: nil).pluck(:resource_id))
  end

  private

  def extract_mentions
    # Extract @username mentions from body
    usernames = body.scan(/@(\w+)/).flatten

    usernames.each do |username|
      # Try to find user by username or email prefix
      user = User.find_by('LOWER(email) LIKE ?', "#{username.downcase}%")
      next unless user

      mentions.create!(user: user, mentioned_at: created_at)
    end

    # Extract @resource mentions (format: @resource:123 or @resource:name)
    resource_refs = body.scan(/@resource:(\w+)/).flatten

    resource_refs.each do |ref|
      resource = if ref.match?(/^\d+$/)
                   SmResource.find_by(id: ref)
                 else
                   SmResource.find_by('LOWER(name) = ?', ref.downcase)
                 end
      next unless resource

      mentions.create!(resource: resource, mentioned_at: created_at)
    end
  end

  def track_activity
    SmActivity.track(
      'comment_added',
      construction: task.construction,
      user: author,
      task: task,
      trackable: self,
      metadata: {
        task_name: task.name,
        comment_preview: body.truncate(100),
        is_reply: parent_id.present?
      }
    )
  end

  def notify_mentions
    # Queue notification job for mentioned users
    mentions.each do |mention|
      NotifyMentionJob.perform_later(mention.id) if defined?(NotifyMentionJob)
    end
  end
end
