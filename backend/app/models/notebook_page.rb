# frozen_string_literal: true

# NotebookPage - Individual pages with rich text content
#
# Features:
# - Tiptap/HTML rich text content
# - Content metadata (word count, positioned boxes, strokes)
# - Author and edit tracking
# - Pinning
# - Soft delete via archived_at
# - Auto-sync to File Warehouse on save (via WarehouseSyncable)
#
class NotebookPage < ApplicationRecord
  include WarehouseSyncable

  # Define warehouse type for File Warehouse sync
  warehouse_type :notebook

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

  # ========================================
  # WarehouseSyncable Overrides
  # ========================================

  # Override: Resolve tenant from notebook owner
  # NotebookPage doesn't have direct tenant association, so derive from notebook.owner
  def resolved_tenant
    @resolved_tenant ||= begin
      # Try notebook owner's tenant
      if notebook&.owner&.respond_to?(:tenant) && notebook.owner.tenant.present?
        notebook.owner.tenant
      # Try created_by user's tenant
      elsif created_by&.respond_to?(:tenant) && created_by.tenant.present?
        created_by.tenant
      # Fall back to ActsAsTenant context
      elsif ActsAsTenant.current_tenant.present?
        ActsAsTenant.current_tenant
      else
        raise ::TenantNotFoundError, "Cannot resolve tenant for NotebookPage #{id}"
      end
    end
  end

  # Safe filename for warehouse export (required by WarehouseSyncable)
  def safe_filename
    return "untitled" if title.blank?

    # Remove invalid filename characters
    clean = title.to_s.gsub(/[:\/*?"<>|\\]/, " ")
    clean = clean.gsub(/\s+/, " ").strip
    clean = clean[0..200] if clean.length > 200
    clean.presence || "untitled"
  end

  # Alias for WarehouseSyncable (uses 'name' by default)
  def name
    title
  end

  # Override: Compute virtual folder path for File Warehouse
  # Format: Notes/NotebookName/Year
  def compute_virtual_folder_path
    notebook_name = notebook&.name || "Unnamed"
    year = (updated_at || Time.current).year.to_s

    # Sanitize notebook name for folder path
    safe_notebook = notebook_name.to_s.gsub(/[:\/*?"<>|\\]/, " ").gsub(/\s+/, " ").strip

    "Notes/#{safe_notebook}/#{year}"
  end

  # Override: Source type for WarehouseDocument
  def compute_source_type
    "notebook"
  end

  # Override: Custom metadata for WarehouseDocument
  def warehouse_metadata
    {
      notebook_id: notebook&.id,
      notebook_name: notebook&.name,
      section_id: section_id,
      section_name: section&.name,
      word_count: word_count,
      char_count: char_count,
      is_pinned: is_pinned,
      created_by_id: created_by_id,
      created_by_name: created_by&.name,
      last_edited_by_id: last_edited_by_id,
      last_edited_by_name: last_edited_by&.name
    }.compact
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

  # Override: Only sync when content actually changed (not just position changes)
  def should_sync_to_warehouse?
    return false if archived?
    return false unless warehouse_document_type.present?

    # Only sync on content changes, not position/pin changes
    content_changed_for_sync? && warehouse_sync_enabled?
  end

  # Check if any content-related fields changed that warrant a sync
  def content_changed_for_sync?
    saved_change_to_content? ||
      saved_change_to_content_metadata? ||
      saved_change_to_title?
  end

  # Override: Check warehouse sync is enabled
  def warehouse_sync_enabled?
    return false unless defined?(WarehouseProvider)

    config = WarehouseProvider.instance rescue nil
    config&.warehouse_sync_enabled? || false
  rescue StandardError => e
    Rails.logger.debug "[NotebookPage] Warehouse sync check failed: #{e.message}"
    false
  end
end
