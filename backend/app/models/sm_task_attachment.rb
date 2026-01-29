class SmTaskAttachment < ApplicationRecord
  # Associations
  belongs_to :sm_task
  belongs_to :attachable, polymorphic: true
  belongs_to :added_by, class_name: "User", optional: true
  belongs_to :action_item, class_name: "TaskActionItem", optional: true

  # Phase 3: Universal warehouse metadata (SSoT for display_name, send_name, folder)
  # Task attachments appear under Tasks/ folder in File Warehouse
  # Same file can appear in multiple folders (Tasks/ AND Emails/ or Corporate/)
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  # Attachment types
  ATTACHMENT_TYPES = %w[email document upload].freeze

  # Attachment categories
  CATEGORIES = %w[info response].freeze

  # Validations
  validates :attachable_type, inclusion: {
    in: %w[SyncedEmail WarehouseDocument]
  }
  validates :attachment_type, inclusion: { in: ATTACHMENT_TYPES }, allow_blank: true
  validates :category, inclusion: { in: CATEGORIES }, allow_blank: true

  # Callbacks
  after_create :auto_populate_keywords
  after_create :create_warehouse_entry

  # Soft delete support - deleted attachments won't be re-created by auto-attach
  # SSoT: Use deleted_at to track user-removed attachments
  default_scope { where(deleted_at: nil) }
  scope :with_deleted, -> { unscope(where: :deleted_at) }
  scope :deleted, -> { unscope(where: :deleted_at).where.not(deleted_at: nil) }

  # Scopes
  scope :emails, -> { where(attachable_type: "SyncedEmail") }
  scope :documents, -> { where(attachable_type: "WarehouseDocument") }
  scope :recent, -> { order(created_at: :desc) }
  scope :info, -> { where(category: "info") }
  scope :responses, -> { where(category: "response") }

  # Soft delete - marks as deleted instead of destroying
  # SSoT: Prevents email sync from re-creating deleted attachments
  def soft_delete!(user = nil)
    update!(deleted_at: Time.current, deleted_by_id: user&.id)
  end

  # Check if attachment was previously deleted (for auto-attach prevention)
  def self.was_deleted?(sm_task_id:, attachable_type:, attachable_id:)
    with_deleted
      .where(sm_task_id: sm_task_id, attachable_type: attachable_type, attachable_id: attachable_id)
      .where.not(deleted_at: nil)
      .exists?
  end

  # Phase 4: Virtual folder path for File Warehouse
  # SSoT: Reads from StorageConfiguration (full paths, no derivation)
  # FRC (Jan 2026): No hardcoded fallbacks - uses same logic as compute_task_folder_path
  def virtual_folder_path
    compute_task_folder_path
  end

  # Get the storage blob from the attached document
  # WarehouseDocument has storage_blob directly
  # SyncedEmail uses warehouse_document.storage_blob
  def storage_blob
    if attachable.respond_to?(:storage_blob) && attachable.storage_blob
      attachable.storage_blob
    elsif attachable&.warehouse_document&.storage_blob
      attachable.warehouse_document.storage_blob
    end
  end

  # Get display name - SSoT hierarchy for renamed attachments
  # Priority:
  #   1. warehouse_document.display_name (Phase 3 SSoT - editable)
  #   2. attachment.display_name (stored locally for emails/legacy)
  #   3. attachable's original name (file_name or subject)
  def display_name
    # Phase 3 SSoT: Check warehouse_document first
    if warehouse_document&.display_name.present?
      return warehouse_document.display_name
    end

    # Fallback: Check if custom display_name is stored on attachment
    stored_name = read_attribute(:display_name)
    return stored_name if stored_name.present?

    # Fall back to attachable's original name
    case attachable_type
    when "SyncedEmail"
      attachable&.subject || "Email"
    when "WarehouseDocument"
      attachable&.display_name || attachable&.original_filename || "Document"
    else
      "Attachment"
    end
  end

  private

  # Auto-populate task keywords from email subject when first email is attached
  def auto_populate_keywords
    return unless attachable_type == "SyncedEmail"
    return unless attachable.present?

    sm_task.add_keywords_from_email(attachable)
  rescue StandardError => e
    Rails.logger.error("[SmTaskAttachment] Failed to auto-populate keywords: #{e.message}")
  end

  # Create WarehouseDocument entry for this task attachment
  # Links to same StorageBlob as the attached document
  # SSoT: Sets linkable to SmTask for proper folder display in File Warehouse
  #
  # IMPORTANT: ALWAYS creates a new WarehouseDocument in the task folder,
  # even when attachable is already a WarehouseDocument. This allows the
  # same physical file (StorageBlob) to appear in multiple virtual folders.
  # Example: A PDF in "Corporate/Finance" can ALSO appear in "Tasks/2236/Responses"
  def create_warehouse_entry
    blob = storage_blob
    unless blob
      Rails.logger.warn("[SmTaskAttachment] ##{id}: No storage blob found for #{attachable_type}##{attachable_id}")
      return
    end

    # Get display name from attachable
    name = case attachable_type
           when "WarehouseDocument"
             attachable&.display_name || attachable&.original_filename || "Document"
           when "SyncedEmail"
             attachable&.subject || "Email"
           else
             "Attachment"
           end

    # Get original filename
    filename = case attachable_type
               when "WarehouseDocument"
                 attachable&.original_filename || attachable&.display_name
               when "SyncedEmail"
                 "#{attachable&.subject || 'Email'}.eml"
               else
                 nil
               end

    # Compute the task folder path (e.g., "Tasks/2236/Responses")
    folder = compute_task_folder_path

    create_warehouse_document!(
      source_type: "task",
      folder: folder,
      display_name: name,
      original_filename: filename,
      storage_blob: blob,
      linkable_type: "SmTask",
      linkable_id: sm_task_id,
      metadata: {
        task_id: sm_task_id,
        task_name: sm_task&.name,
        category: category,
        attachable_type: attachable_type,
        attachable_id: attachable_id,
        original_warehouse_document_id: attachable_type == "WarehouseDocument" ? attachable_id : nil
      }
    )
  rescue StandardError => e
    Rails.logger.error("[SmTaskAttachment] ##{id}: Failed to create warehouse entry: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
  end

  # Compute the folder path for File Warehouse
  # SSoT: Reads template from StorageConfiguration (full paths, no derivation)
  # Template: Tasks/{{TaskId}}/{{TaskName}}/Attachments (or Responses)
  #
  # FRC (Jan 2026): No hardcoded fallback - fail fast if config is wrong
  # If path is blank, it's immediately visible in UI and can be fixed
  def compute_task_folder_path
    task = sm_task
    return "Tasks/Unknown" unless task

    config = StorageConfiguration.instance rescue nil
    unless config
      Rails.logger.warn("[SmTaskAttachment] ##{id}: No StorageConfiguration found")
      return "Tasks/Unknown"
    end

    # SSoT: task_attachments and task_responses have FULL paths (Jan 2026 FRC fix)
    folder_type = category == "response" ? :task_responses : :task_attachments

    # Use config template - resolves {{TaskId}}, {{TaskName}}, etc.
    folder = config.resolve_virtual_path(folder_type, {
      TaskId: task.id,
      TaskName: task.name&.parameterize || "task-#{task.id}"
    })

    if folder.blank?
      Rails.logger.warn("[SmTaskAttachment] ##{id}: resolve_virtual_path returned blank for #{folder_type}")
      return "Tasks/Unknown"
    end

    folder
  end
end
