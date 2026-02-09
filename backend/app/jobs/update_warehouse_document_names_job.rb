# frozen_string_literal: true

# UpdateWarehouseDocumentNamesJob - Sync ui_name when templates change
#
# SSoT (Feb 2026): When a WarehouseFolderDocumentType's template changes,
# this job updates the ui_name for all linked WarehouseDocuments.
#
# This ensures the File Warehouse UI stays consistent with current templates.
# Also materializes download_name (Feb 2026) since it's now stored on save.
#
# Usage:
#   UpdateWarehouseDocumentNamesJob.perform_later(warehouse_folder_document_type_id)
#
class UpdateWarehouseDocumentNamesJob < ApplicationJob
  queue_as :default

  # Don't retry if the WFDT was deleted
  discard_on ActiveRecord::RecordNotFound

  def perform(wfdt_id)
    wfdt = WarehouseFolderDocumentType.find(wfdt_id)
    template = wfdt.effective_ui_name_template

    return if template.blank?

    updated_count = 0
    error_count = 0

    resolver = SendNameResolver.new

    wfdt.warehouse_documents.find_each(batch_size: 100) do |wd|
      begin
        # Build context for template expansion
        context = build_context(wd)

        # Expand template for ui_name
        new_ui_name = expand_template(template, context)

        # Re-resolve download_name from templates/fallbacks
        # Clear download_name in-memory so SendNameResolver doesn't short-circuit
        original_download_name = wd.download_name
        wd.download_name = nil
        new_download_name = resolver.resolve(wd)
        new_download_name = nil if new_download_name == "document"

        # Build update hash for changed columns
        updates = {}
        updates[:ui_name] = new_ui_name if new_ui_name.present? && new_ui_name != wd.ui_name
        updates[:download_name] = new_download_name if new_download_name.present? && new_download_name != original_download_name

        if updates.any?
          wd.update_columns(updates)
          updated_count += 1
        end
      rescue StandardError => e
        error_count += 1
        Rails.logger.warn "[UpdateWarehouseDocumentNamesJob] Error updating wd##{wd.id}: #{e.message}"
      end
    end

    Rails.logger.info "[UpdateWarehouseDocumentNamesJob] WFDT##{wfdt_id}: updated #{updated_count}, errors #{error_count}"
  end

  private

  # Build context for template expansion (similar to SendNameResolver)
  def build_context(wd)
    context = {}
    documentable = wd.documentable

    # Date tokens
    doc_date = wd.created_at || Time.current
    context[:date] = doc_date.strftime("%d-%m-%Y")
    context[:ddmmyyyy] = doc_date.strftime("%d-%m-%Y")
    context[:yyyymmdd] = doc_date.strftime("%Y-%m-%d")

    # Original filename tokens
    if wd.original_filename.present?
      context[:original_file_name] = File.basename(wd.original_filename, ".*")
      context[:file_extension] = File.extname(wd.original_filename).delete_prefix(".")
    end

    return context unless documentable

    # Job context
    if documentable.respond_to?(:job) && documentable.job
      job = documentable.job
      context[:job_code] = job.job_code
      context[:job_name] = job.title
      context[:job_title] = job.title
    end

    # Contact context
    if documentable.respond_to?(:contact) && documentable.contact
      contact = documentable.contact
      context[:name] = contact.display_name
      context[:contact_name] = contact.display_name
    end

    # Company context
    if documentable.respond_to?(:corporate) && documentable.corporate
      company = documentable.corporate
      context[:company_code] = company.company_code
      context[:company_name] = company.name
    end

    # Document type context
    doc_type = documentable.try(:document_type_record) || documentable.try(:document_type)
    if doc_type.respond_to?(:name)
      context[:doc_type_name] = doc_type.name
      context[:doc_type_code] = doc_type.try(:abbreviation)
    end

    # Email context
    if documentable.respond_to?(:subject)
      context[:subject] = documentable.subject
    end

    context
  end

  # Expand template with context values
  # Supports both {Token} and {{Token}} syntax
  def expand_template(template, context)
    return nil if template.blank?

    result = template.dup

    # Replace tokens (case-insensitive matching)
    context.each do |key, value|
      next unless value.present?

      # Convert key to various formats
      pascal_key = key.to_s.split("_").map(&:capitalize).join
      snake_key = key.to_s

      result.gsub!("{#{pascal_key}}", value.to_s)
      result.gsub!("{{#{pascal_key}}}", value.to_s)
      result.gsub!("{#{snake_key}}", value.to_s)
      result.gsub!("{{#{snake_key}}}", value.to_s)
    end

    # Clean up unreplaced tokens
    result.gsub!(/\s*\{\{?[^}]+\}?\}\s*/, " ")

    # Clean up extra spaces
    result.gsub(/\s+/, " ").strip.presence
  end
end
