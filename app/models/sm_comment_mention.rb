# frozen_string_literal: true

# SmCommentMention - Tracks @mentions in comments
#
class SmCommentMention < ApplicationRecord
  belongs_to :comment, class_name: 'SmComment', foreign_key: 'sm_comment_id'
  belongs_to :user, optional: true
  belongs_to :resource, class_name: 'SmResource', optional: true

  validates :comment, presence: true
  validate :must_have_user_or_resource

  scope :for_user, ->(user_id) { where(user_id: user_id) }
  scope :for_resource, ->(resource_id) { where(resource_id: resource_id) }
  scope :unread, -> { where(read_at: nil) }
  scope :recent, -> { order(mentioned_at: :desc) }

  def mark_read!
    update!(read_at: Time.current) if read_at.nil?
  end

  def unread?
    read_at.nil?
  end

  private

  def must_have_user_or_resource
    return if user_id.present? || resource_id.present?

    errors.add(:base, 'Must mention either a user or resource')
  end
end
