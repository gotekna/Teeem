# frozen_string_literal: true

# RecomputeWarehouseFoldersJob - SSoT for folder path updates
#
# Triggered when StorageConfiguration.warehouse_folders templates change.
# Updates all WarehouseDocument.folder values to match new templates.
#
# This ensures File Warehouse always reflects current template configuration,
# making StorageConfiguration the TRUE SSoT for folder structure.
#
# Usage:
#   RecomputeWarehouseFoldersJob.perform_later(tenant_id, ["task", "task_attachments"])
#
class RecomputeWarehouseFoldersJob < ApplicationJob
  queue_as :default

  # Map source_type to warehouse_type for template lookup
  # Some source_types map to different warehouse template keys
  SOURCE_TYPE_TO_WAREHOUSE_TYPE = {
    "task" => "task_attachments",  # Task docs use task_attachments template
    "email" => "email",
    "email_attachment" => "email_attachments",
    "corporate" => "corporate",
    "job" => "job",
    "contact" => "contact",
    "xero" => "bank_statement",
    "case" => "case"
  }.freeze

  def perform(tenant_id, changed_warehouse_types)
    tenant = Tenant.find(tenant_id)
    ActsAsTenant.with_tenant(tenant) do
      config = StorageConfiguration.instance

      changed_warehouse_types.each do |warehouse_type|
        recompute_folders_for_type(config, warehouse_type)
      end
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error "[RecomputeWarehouseFoldersJob] Tenant not found: #{e.message}"
  end

  private

  def recompute_folders_for_type(config, warehouse_type)
    # Find matching source_types for this warehouse_type
    source_types = SOURCE_TYPE_TO_WAREHOUSE_TYPE.select { |_, v| v == warehouse_type }.keys
    source_types << warehouse_type if source_types.empty?  # Fallback to same name

    template = config.root_folder_for(warehouse_type)
    return unless template.present?

    updated_count = 0
    error_count = 0

    WarehouseDocument.where(source_type: source_types).find_each do |doc|
      new_folder = compute_folder_for_document(config, doc, warehouse_type)
      next if new_folder.blank? || doc.folder == new_folder

      if doc.update_column(:folder, new_folder)
        updated_count += 1
      end
    rescue StandardError => e
      error_count += 1
      Rails.logger.debug "[RecomputeWarehouseFoldersJob] Error updating doc #{doc.id}: #{e.message}"
    end

    Rails.logger.info "[RecomputeWarehouseFoldersJob] Updated #{updated_count} documents for #{warehouse_type} (#{error_count} errors)"
  end

  def compute_folder_for_document(config, doc, warehouse_type)
    tokens = extract_tokens_for_document(doc)
    config.resolve_virtual_path(warehouse_type.to_sym, tokens)
  end

  # Extract token values from document and its documentable
  def extract_tokens_for_document(doc)
    tokens = {}
    documentable = doc.documentable

    # Task context
    if documentable.respond_to?(:id) && doc.source_type == "task"
      tokens[:TaskId] = documentable.id
    end

    # Job context
    if documentable.respond_to?(:job) && documentable.job
      tokens[:JobCode] = documentable.job.job_code
    elsif documentable.respond_to?(:job_code)
      tokens[:JobCode] = documentable.job_code
    end

    # Contact context
    if documentable.respond_to?(:contact) && documentable.contact
      tokens[:ContactName] = documentable.contact.display_name.presence || "Contact-#{documentable.contact.id}"
      tokens[:ContactId] = documentable.contact.id
    end

    # Corporate company context
    if documentable.respond_to?(:corporate_company) && documentable.corporate_company
      tokens[:CompanyCode] = documentable.corporate_company.company_code
      tokens[:CompanyName] = documentable.corporate_company.name
      tokens[:CompanyGroup] = documentable.corporate_company.company_group.presence || "Default"
    end

    # Case context
    if documentable.respond_to?(:case_number)
      tokens[:CaseId] = documentable.case_number
    end

    # Email context
    if doc.source_type.in?(%w[email email_attachment])
      tokens[:Mailbox] = doc.meta("mailbox") || "Unknown"
      received_at = doc.email_received_at || doc.created_at
      tokens[:Year] = received_at&.year.to_s
      tokens[:Month] = received_at&.strftime("%m")
    end

    # Date tokens
    date = doc.created_at || Time.current
    tokens[:Year] ||= date.year.to_s
    tokens[:Month] ||= date.strftime("%m")

    tokens
  end
end
