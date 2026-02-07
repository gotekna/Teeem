class SmTaskAttachment < ApplicationRecord
  # Associations
  belongs_to :sm_task
  belongs_to :attachable, polymorphic: true
  belongs_to :added_by, class_name: "User", optional: true
  belongs_to :action_item, class_name: "TaskActionItem", optional: true

  # Phase 3: Universal warehouse metadata (SSoT for ui_name, download_name, folder)
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
  after_create :attach_email_file_attachments, if: -> { attachable_type == 'SyncedEmail' }
  before_destroy :remove_auto_attached_documents

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
  # SSoT: Reads from WarehouseProvider (full paths, no derivation)
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
  #   1. warehouse_document.ui_name (Phase 3 SSoT - editable)
  #   2. attachment.display_name (stored locally for emails/legacy)
  #   3. attachable's original name (file_name or subject)
  def display_name
    # Phase 3 SSoT: Check warehouse_document first
    if warehouse_document&.ui_name.present?
      return warehouse_document.ui_name
    end

    # Fallback: Check if custom display_name is stored on attachment
    stored_name = read_attribute(:display_name)
    return stored_name if stored_name.present?

    # Fall back to attachable's original name
    case attachable_type
    when "SyncedEmail"
      attachable&.subject || "Email"
    when "WarehouseDocument"
      attachable&.ui_name || attachable&.original_filename || "Document"
    else
      "Attachment"
    end
  end

  # Helper: Determine if this attachment should be treated as a "response" attachment
  # SSoT (Jan 2026): "Response" means one of:
  # - category == "response" (explicitly marked)
  # - action_item_id is present (linked to a question/action item)
  # Matches frontend logic in TaskFullscreenView.tsx (responseDocuments, responseEmails)
  def is_response_attachment?
    category == "response" || action_item_id.present?
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
  # FRC (Jan 2026): Email handling - "Response" means:
  # - category == "response" (explicitly marked as response)
  # - OR action_item_id is set (linked to a question/action item)
  # Both conditions mean the email is part of the response workflow
  #
  # - "Response" emails → appear in Tasks/{id}/Responses folder
  # - "Info" emails (category="info" AND no action_item) → skip (already in Emails/ folder)
  # - Documents → always appear in appropriate folder
  def create_warehouse_entry
    # Skip info emails - they appear in Emails/ folder, not Tasks/Attachments
    # Response emails (category="response" OR linked to action item) DO appear in Tasks/{id}/Responses
    if attachable_type == "SyncedEmail" && !is_response_attachment?
      return
    end

    blob = storage_blob
    unless blob
      Rails.logger.warn("[SmTaskAttachment] ##{id}: No storage blob found for #{attachable_type}##{attachable_id}")
      return
    end

    # Get display name from attachable
    name = case attachable_type
           when "WarehouseDocument"
             attachable&.ui_name || attachable&.original_filename || "Document"
           when "SyncedEmail"
             attachable&.subject || "Email"
           else
             "Attachment"
           end

    # Get original filename
    filename = case attachable_type
               when "WarehouseDocument"
                 attachable&.original_filename || attachable&.ui_name
               when "SyncedEmail"
                 "#{attachable&.subject || 'Email'}.eml"
               else
                 nil
               end

    # Compute the task folder path (e.g., "Tasks/2236/Responses")
    folder = compute_task_folder_path

    # FRC (Feb 2026): Prevent duplicate WarehouseDocuments for same blob+folder
    # Same file can appear in multiple folders, but NOT multiple times in same folder
    existing = WarehouseDocument.find_by(storage_blob_id: blob.id, folder: folder)
    if existing
      Rails.logger.debug("[SmTaskAttachment] ##{id}: Skipping duplicate - WD #{existing.id} already exists for blob #{blob.id} in #{folder}")
      return
    end

    # FRC (Jan 2026): Must set tenant explicitly - model callbacks don't have
    # ActsAsTenant context, and WarehouseDocument validates tenant presence
    create_warehouse_document!(
      tenant_id: sm_task.tenant_id,
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

  # Auto-attach file attachments from an email when the email is attached to a task
  # SSoT: Uses SyncedEmail#attachment_documents (WarehouseDocument) for email files
  #
  # Behavior:
  # - Only runs when attachable_type is 'SyncedEmail'
  # - Respects sm_task.auto_attach_email_files setting (toggle per-task)
  # - Skips if document already attached or was previously deleted
  # - Tracks source_email_attachment_id for cascade delete
  def attach_email_file_attachments
    return unless sm_task.auto_attach_email_files?
    return unless attachable.respond_to?(:attachment_documents)

    # Use document_attachments to exclude small signature images
    docs = attachable.respond_to?(:document_attachments) ? attachable.document_attachments : attachable.attachment_documents

    docs.each do |doc|
      # Skip if already attached (active or soft-deleted)
      next if SmTaskAttachment.with_deleted.exists?(
        sm_task_id: sm_task_id,
        attachable_type: 'WarehouseDocument',
        attachable_id: doc.id
      )

      SmTaskAttachment.create!(
        sm_task_id: sm_task_id,
        attachable: doc,
        attachment_type: 'document',
        category: category, # Inherit from email (info/response)
        added_by_id: added_by_id,
        auto_attached: true,
        source_email_attachment_id: id # Track which email triggered this
      )
    end
  rescue StandardError => e
    Rails.logger.error("[SmTaskAttachment] ##{id}: Failed to attach email file attachments: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
  end

  # Cascade delete auto-attached documents when their source email is removed
  # SSoT: Uses source_email_attachment_id to find documents that were auto-added
  def remove_auto_attached_documents
    return unless attachable_type == 'SyncedEmail'

    # Find all auto-attached documents that came from this email
    auto_docs = SmTaskAttachment.where(
      sm_task_id: sm_task_id,
      auto_attached: true,
      source_email_attachment_id: id
    )

    count = auto_docs.count
    if count > 0
      Rails.logger.info("[SmTaskAttachment] ##{id}: Cascade deleting #{count} auto-attached documents")
      auto_docs.destroy_all
    end
  rescue StandardError => e
    Rails.logger.error("[SmTaskAttachment] ##{id}: Failed to cascade delete auto-attached documents: #{e.message}")
  end

  # Compute the folder path for File Warehouse
  # SSoT: Reads template from WarehouseProvider (full paths, no derivation)
  # Template: Tasks/{{TaskId}}/{{TaskName}}/Attachments (or Responses)
  #
  # FRC (Jan 2026): No hardcoded fallback - fail fast if config is wrong
  # If path is blank, it's immediately visible in UI and can be fixed
  #
  # ⚠️ FRC (Jan 2026): Must use for_tenant(), not instance
  # Model callbacks run without ActsAsTenant context set, so instance raises
  # TenantNotFoundError. Always get tenant from sm_task association.
  def compute_task_folder_path
    task = sm_task
    return "Tasks/Unknown" unless task

    # FRC: Use for_tenant with explicit tenant from task, not instance
    # (model callbacks don't have ActsAsTenant.current_tenant set)
    config = WarehouseProvider.for_tenant(task.tenant) rescue nil
    unless config
      Rails.logger.warn("[SmTaskAttachment] ##{id}: No WarehouseProvider found for tenant #{task.tenant_id}")
      return "Tasks/Unknown"
    end

    # SSoT: task_attachments/task_responses inherit from task parent (WAREHOUSE_TYPE_PARENTS)
    # FRC: "Response" = category="response" OR has action_item_id (linked to question)
    folder_type = is_response_attachment? ? :task_responses : :task_attachments

    # Use config template - resolves {{JobName}}, {{TaskId}}, and {{TaskName}}
    # Template: Task/{{JobName}}/{{TaskId}}{{TaskName}}/Task Attachments
    # FRC (Feb 2026): Must include JobName - tasks belong_to :job (optional)
    # If no job, omit JobName token - resolve_virtual_path strips it, skipping that folder level
    job = task.job
    tokens = {
      JobName: job&.display_name.presence || job&.job_code.presence || "Unassigned Job",
      JobCode: job&.job_code.presence || "No-Job",
      TaskId: task.id,
      TaskName: task.name&.parameterize || "task-#{task.id}"
    }
    folder = config.resolve_virtual_path(folder_type, tokens)

    if folder.blank?
      Rails.logger.warn("[SmTaskAttachment] ##{id}: resolve_virtual_path returned blank for #{folder_type}")
      return "Tasks/Unknown"
    end

    folder
  end
end
