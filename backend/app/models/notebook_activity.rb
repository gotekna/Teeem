# frozen_string_literal: true

# NotebookActivity - Activity tracking for notebooks
#
# Features:
# - Tracks all notebook actions
# - Links to user, page, section
# - Stores metadata for context
#
class NotebookActivity < ApplicationRecord
  # Associations
  belongs_to :notebook
  belongs_to :user
  belongs_to :page, class_name: "NotebookPage", optional: true
  belongs_to :section, class_name: "NotebookSection", optional: true

  # Validations
  validates :activity_type, presence: true

  # Activity types
  TYPES = %w[
    notebook_created notebook_updated notebook_archived notebook_restored
    section_created section_updated section_deleted section_moved
    page_created page_updated page_deleted page_moved page_pinned page_unpinned
    share_added share_removed share_updated
    attachment_added attachment_removed
  ].freeze

  validates :activity_type, inclusion: { in: TYPES }

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :for_type, ->(type) { where(activity_type: type) }
  scope :by_user, ->(user) { where(user: user) }

  # Class method to track activity
  def self.track(type, notebook:, user:, page: nil, section: nil, metadata: {})
    create!(
      activity_type: type,
      notebook: notebook,
      user: user,
      page: page,
      section: section,
      metadata: metadata
    )
  end

  # Human-readable description
  def description
    case activity_type
    when "notebook_created"
      "created this notebook"
    when "notebook_updated"
      "updated notebook settings"
    when "notebook_archived"
      "archived this notebook"
    when "notebook_restored"
      "restored this notebook"
    when "section_created"
      "created section \"#{metadata['section_name']}\""
    when "section_updated"
      "updated section \"#{metadata['section_name']}\""
    when "section_deleted"
      "deleted section \"#{metadata['section_name']}\""
    when "section_moved"
      "moved section \"#{metadata['section_name']}\""
    when "page_created"
      "created page \"#{metadata['page_title']}\""
    when "page_updated"
      "updated page \"#{metadata['page_title']}\""
    when "page_deleted"
      "deleted page \"#{metadata['page_title']}\""
    when "page_moved"
      "moved page \"#{metadata['page_title']}\""
    when "page_pinned"
      "pinned page \"#{metadata['page_title']}\""
    when "page_unpinned"
      "unpinned page \"#{metadata['page_title']}\""
    when "share_added"
      "shared with #{metadata['user_name']}"
    when "share_removed"
      "removed access for #{metadata['user_name']}"
    when "share_updated"
      "updated permissions for #{metadata['user_name']}"
    when "attachment_added"
      "added attachment \"#{metadata['file_name']}\""
    when "attachment_removed"
      "removed attachment \"#{metadata['file_name']}\""
    else
      activity_type.humanize.downcase
    end
  end
end
