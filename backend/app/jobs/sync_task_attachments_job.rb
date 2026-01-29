# frozen_string_literal: true

# Weekly sync of task attachments to File Warehouse
# Creates missing WarehouseDocument entries for SmTaskAttachments
#
# SSoT: SmTaskAttachment.after_create should create warehouse entries automatically,
# but this job catches any that slip through (race conditions, failed callbacks, etc.)
#
# Runs weekly on Sundays at 5am (after backups, before work week)
#
class SyncTaskAttachmentsJob < ApplicationJob
  queue_as :low

  def perform
    Rails.logger.info "[SyncTaskAttachmentsJob] Starting weekly task attachment sync..."

    total_created = 0
    total_skipped = 0
    total_errors = 0

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        config = StorageConfiguration.instance rescue nil
        next unless config

        created, skipped, errors = sync_tenant_attachments(tenant, config)
        total_created += created
        total_skipped += skipped
        total_errors += errors
      end
    end

    Rails.logger.info "[SyncTaskAttachmentsJob] Complete: created=#{total_created}, skipped=#{total_skipped}, errors=#{total_errors}"

    {
      created: total_created,
      skipped: total_skipped,
      errors: total_errors
    }
  end

  private

  def sync_tenant_attachments(tenant, config)
    created = 0
    skipped = 0
    errors = 0

    # Find SmTaskAttachments without corresponding WarehouseDocument
    SmTaskAttachment.includes(:sm_task, :attachable, :warehouse_document).find_each do |att|
      # Skip if already has warehouse document
      if att.warehouse_document.present?
        skipped += 1
        next
      end

      begin
        result = create_warehouse_entry(att, config)
        if result
          created += 1
        else
          errors += 1
        end
      rescue StandardError => e
        errors += 1
        Rails.logger.error "[SyncTaskAttachmentsJob] SmTaskAttachment ##{att.id}: #{e.message}"
      end
    end

    if created > 0
      Rails.logger.info "[SyncTaskAttachmentsJob] Tenant #{tenant.name}: created=#{created}, skipped=#{skipped}, errors=#{errors}"
    end

    [created, skipped, errors]
  end

  def create_warehouse_entry(att, config)
    task = att.sm_task
    unless task
      Rails.logger.warn "[SyncTaskAttachmentsJob] SmTaskAttachment ##{att.id}: No task found"
      return false
    end

    # Get the storage blob from the attachable
    blob = get_storage_blob(att)
    unless blob
      Rails.logger.warn "[SyncTaskAttachmentsJob] SmTaskAttachment ##{att.id}: No storage blob"
      return false
    end

    # Determine folder based on category
    folder_type = att.category == "response" ? :task_responses : :task_attachments
    folder = config.resolve_virtual_path(folder_type, { TaskId: task.id })

    # Get display name
    display_name = att.read_attribute(:display_name).presence ||
                   att.attachable&.try(:display_name) ||
                   att.attachable&.try(:subject) ||
                   "Attachment"

    # Create the warehouse document
    att.create_warehouse_document!(
      source_type: "task",
      folder: folder,
      display_name: display_name,
      original_filename: att.attachable&.try(:original_filename) || att.attachable&.try(:file_name),
      storage_blob: blob,
      linkable_type: "SmTask",
      linkable_id: task.id,
      metadata: {
        task_id: task.id,
        task_name: task.name,
        category: att.category,
        attachable_type: att.attachable_type,
        attachable_id: att.attachable_id
      }
    )

    true
  end

  def get_storage_blob(att)
    if att.attachable.is_a?(WarehouseDocument)
      att.attachable.storage_blob
    elsif att.attachable.respond_to?(:storage_blob)
      att.attachable.storage_blob
    elsif att.attachable&.warehouse_document&.storage_blob
      att.attachable.warehouse_document.storage_blob
    end
  end
end
