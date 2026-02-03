# frozen_string_literal: true

# SyncNotebookToWarehouseJob - Background job to sync notebook pages to File Warehouse
#
# Exports notebook page content as HTML and creates/updates a WarehouseDocument entry.
# Uses StorageBlob for content-hash deduplication (same content = same blob).
#
# Usage:
#   SyncNotebookToWarehouseJob.perform_later(notebook_page_id)
#
# Architecture:
#   NotebookPage -> NotebookExportService (HTML) -> StorageBlob (deduplicated) -> WarehouseDocument
#
class SyncNotebookToWarehouseJob < ApplicationJob
  queue_as :low
  sidekiq_options retry: 3

  def perform(notebook_page_id)
    page = NotebookPage.find_by(id: notebook_page_id)

    unless page
      Rails.logger.warn "[SyncNotebookToWarehouseJob] Page #{notebook_page_id} not found, skipping"
      return
    end

    # Skip archived pages
    if page.archived?
      Rails.logger.debug "[SyncNotebookToWarehouseJob] Page #{notebook_page_id} is archived, skipping"
      return
    end

    # Get notebook and tenant context
    notebook = page.notebook
    unless notebook
      Rails.logger.warn "[SyncNotebookToWarehouseJob] Page #{notebook_page_id} has no notebook, skipping"
      return
    end

    tenant = find_tenant_for_page(page)
    unless tenant
      Rails.logger.warn "[SyncNotebookToWarehouseJob] Could not determine tenant for page #{notebook_page_id}, skipping"
      return
    end

    # Run within tenant context
    ActsAsTenant.with_tenant(tenant) do
      sync_page_to_warehouse(page, notebook)
    end
  end

  private

  def find_tenant_for_page(page)
    # Try to get tenant from notebook owner
    if page.notebook&.owner&.respond_to?(:tenant) && page.notebook.owner.tenant.present?
      return page.notebook.owner.tenant
    end

    # Try ActsAsTenant current tenant
    return ActsAsTenant.current_tenant if ActsAsTenant.current_tenant.present?

    # Fallback to first tenant (should be improved based on notebook's actual tenant)
    Tenant.first
  end

  def sync_page_to_warehouse(page, notebook)
    # Generate HTML content
    service = NotebookExportService.new
    html_content = service.export_html(page)

    if html_content.blank?
      Rails.logger.warn "[SyncNotebookToWarehouseJob] No content generated for page #{page.id}"
      return
    end

    # Create/update StorageBlob with deduplication
    filename = sanitize_filename("#{page.title}.html")
    blob = StorageBlob.find_or_create_for_content!(
      html_content,
      filename: filename,
      content_type: "text/html"
    )

    # Find or create WarehouseDocument
    warehouse_doc = WarehouseDocument.find_or_initialize_by(
      documentable_type: "NotebookPage",
      documentable_id: page.id
    )

    # Compute folder path
    folder_path = compute_folder_path(page, notebook)

    # Update warehouse document
    warehouse_doc.assign_attributes(
      source_type: "notebook",
      display_name: page.title,
      original_filename: filename,
      storage_blob: blob,
      tenant_id: ActsAsTenant.current_tenant&.id,
      metadata: {
        notebook_id: notebook.id,
        notebook_name: notebook.name,
        section_id: page.section_id,
        section_name: page.section&.name,
        word_count: page.word_count,
        char_count: page.char_count,
        updated_at: page.updated_at&.iso8601
      }.compact
    )

    # Handle reference counting for blob changes
    if warehouse_doc.storage_blob_id_changed?
      old_blob_id = warehouse_doc.storage_blob_id_was
      StorageBlob.find_by(id: old_blob_id)&.decrement_reference! if old_blob_id
      blob.increment_reference!
    elsif warehouse_doc.new_record?
      blob.increment_reference!
    end

    warehouse_doc.save!

    Rails.logger.info "[SyncNotebookToWarehouseJob] Synced page #{page.id} '#{page.title}' to warehouse (doc: #{warehouse_doc.id}, blob: #{blob.id})"
  rescue StandardError => e
    Rails.logger.error "[SyncNotebookToWarehouseJob] Failed to sync page #{page.id}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    raise # Re-raise to trigger retry
  end

  def compute_folder_path(page, notebook)
    # Format: Notes/NotebookName/Year
    year = (page.updated_at || Time.current).year.to_s
    notebook_name = sanitize_folder_name(notebook.name)

    "Notes/#{notebook_name}/#{year}"
  end

  def sanitize_filename(name)
    return "untitled.html" if name.blank?

    # Remove invalid filename characters
    clean = name.to_s.gsub(/[:\/*?"<>|\\]/, " ")
    clean = clean.gsub(/\s+/, " ").strip
    clean = clean[0..200] if clean.length > 200

    # Ensure .html extension
    clean = "#{clean}.html" unless clean.end_with?(".html")
    clean
  end

  def sanitize_folder_name(name)
    return "Unnamed" if name.blank?

    # Remove invalid folder characters
    clean = name.to_s.gsub(/[:\/*?"<>|\\]/, " ")
    clean.gsub(/\s+/, " ").strip
  end
end
