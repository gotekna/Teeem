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
  # SSoT: Reads from StorageConfiguration + respects exclude_sm_tasks checkbox
  # - exclude_sm_tasks=true → SM tasks under job: Jobs/{{JobCode}}/Tasks/{{TaskId}}
  # - exclude_sm_tasks=false → Standalone: Tasks/{{Category}}/{{TaskId}}
  def virtual_folder_path
    task = sm_task
    return "Tasks/Unknown" unless task

    config = StorageConfiguration.instance

    # If exclude_sm_tasks is true, SM tasks go under job folder (use :task template)
    if config.exclude_sm_linked_tasks? && task.job.present?
      template = config.virtual_template_for(:task)
      return "Tasks/Unknown" unless template

      result = template.dup
      result.gsub!("{{JobCode}}", task.job.job_code.to_s)
      result.gsub!("{{TaskId}}", task.id.to_s)
      result.gsub!("{{Category}}", category&.titleize || "Attachments")
      # Clean up empty tokens
      result.gsub!(/\{\{[^}]+\}\}/, "")
      result.gsub!(%r{//+}, "/")
      result
    else
      # Standalone tasks folder
      cat = category&.titleize || "Attachments"
      "Tasks/#{cat}/#{task.id}"
    end
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
  # Skip creating warehouse entry when attachable IS a WarehouseDocument
  # because the link_to_task controller action already handles updating it
  def create_warehouse_entry
    # If attachable is already a WarehouseDocument, it's being linked via the
    # link_to_task endpoint which updates the existing WarehouseDocument directly.
    # Creating another one would be a duplicate.
    if attachable_type == "WarehouseDocument"
      Rails.logger.info("[SmTaskAttachment] ##{id}: Skipping warehouse entry - attachable is already a WarehouseDocument")
      return
    end

    blob = storage_blob
    unless blob
      Rails.logger.warn("[SmTaskAttachment] ##{id}: No storage blob found for #{attachable_type}##{attachable_id}")
      return
    end

    create_warehouse_document!(
      source_type: "task",
      folder: virtual_folder_path,
      display_name: display_name,
      original_filename: attachable&.try(:file_name) || attachable&.try(:filename) || attachable&.try(:original_filename),
      storage_blob: blob,
      linkable_type: "SmTask",
      linkable_id: sm_task_id,
      metadata: {
        task_id: sm_task_id,
        task_name: sm_task&.name,
        category: category,
        attachable_type: attachable_type,
        attachable_id: attachable_id
      }
    )
  rescue StandardError => e
    Rails.logger.error("[SmTaskAttachment] ##{id}: Failed to create warehouse entry: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
  end
end
