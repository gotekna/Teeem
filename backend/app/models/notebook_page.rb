# frozen_string_literal: true

# NotebookPage - Individual pages with rich text content
#
# Features:
# - Tiptap/HTML rich text content
# - Content metadata (word count, etc.)
# - Author and edit tracking
# - Pinning
# - Soft delete via archived_at
# - Auto-sync to File Warehouse on save
#
class NotebookPage < ApplicationRecord
  # Associations
  belongs_to :section, class_name: "NotebookSection"
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :last_edited_by, class_name: "User", optional: true

  has_one :notebook, through: :section
  has_many :attachments, class_name: "NotebookPageAttachment", foreign_key: "page_id", dependent: :destroy

  # WarehouseDocument link for File Warehouse (Phase 6: Universal Documents)
  has_one :warehouse_document, as: :documentable, class_name: "WarehouseDocument", dependent: :nullify

  # Validations
  validates :title, presence: true, length: { maximum: 255 }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Scopes
  scope :active, -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  scope :ordered, -> { order(position: :asc) }
  scope :pinned, -> { where(is_pinned: true) }
  scope :recent, -> { order(updated_at: :desc) }

  # Callbacks
  before_create :set_position
  before_save :update_content_metadata
  after_save :sync_to_warehouse, if: :should_sync_to_warehouse?

  # Soft delete
  def archive!
    update!(archived_at: Time.current)
  end

  def restore!
    update!(archived_at: nil)
  end

  def archived?
    archived_at.present?
  end

  # Toggle pin status
  def toggle_pin!
    update!(is_pinned: !is_pinned)
  end

  # Word count from content
  def word_count
    content_metadata&.dig("word_count") || 0
  end

  # Character count
  def char_count
    content_metadata&.dig("char_count") || 0
  end

  # Plain text preview
  def preview(length = 200)
    return "" if content.blank?

    # Strip HTML tags and get plain text
    plain = ActionController::Base.helpers.strip_tags(content)
    plain.truncate(length)
  end

  # Move to different section
  def move_to_section(new_section)
    return if section_id == new_section.id

    transaction do
      # Update positions in old section
      section.pages.where("position > ?", position)
             .update_all("position = position - 1")

      # Set position in new section
      new_position = (new_section.pages.maximum(:position) || -1) + 1
      update!(section: new_section, position: new_position)
    end
  end

  # Move to new position within section
  def move_to(new_position)
    return if position == new_position

    transaction do
      if new_position > position
        section.pages.where("position > ? AND position <= ?", position, new_position)
               .update_all("position = position - 1")
      else
        section.pages.where("position >= ? AND position < ?", new_position, position)
               .update_all("position = position + 1")
      end
      update!(position: new_position)
    end
  end

  private

  def set_position
    self.position ||= (section.pages.maximum(:position) || -1) + 1
  end

  def update_content_metadata
    return unless content_changed?

    plain = ActionController::Base.helpers.strip_tags(content.to_s)
    # Merge with existing metadata to preserve positioned_boxes and other data
    self.content_metadata = (content_metadata || {}).merge(
      "word_count" => plain.split.size,
      "char_count" => plain.length,
      "updated_at" => Time.current.iso8601
    )
  end

  # ========================================
  # File Warehouse Sync
  # ========================================

  # Queue background job to sync this page to File Warehouse
  def sync_to_warehouse
    SyncNotebookToWarehouseJob.perform_later(id)
  end

  # Determine if this save should trigger warehouse sync
  def should_sync_to_warehouse?
    # Skip if archived
    return false if archived?

    # Skip if no meaningful content changes
    return false unless content_changed_for_sync?

    # Check if warehouse sync is enabled (fail gracefully if not configured)
    warehouse_sync_enabled?
  end

  # Check if any content-related fields changed that warrant a sync
  def content_changed_for_sync?
    saved_change_to_content? ||
      saved_change_to_content_metadata? ||
      saved_change_to_title?
  end

  # Check if warehouse sync is enabled for notebooks
  # Fails gracefully if WarehouseProvider is not configured
  def warehouse_sync_enabled?
    return false unless defined?(WarehouseProvider)

    config = WarehouseProvider.instance rescue nil
    config&.warehouse_sync_enabled? || false
  rescue StandardError => e
    Rails.logger.debug "[NotebookPage] Warehouse sync check failed: #{e.message}"
    false
  end
end
