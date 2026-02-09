# frozen_string_literal: true

# BackfillWarehousePathsJob - Compute folder_path for all existing documents
#
# Two-phase backfill:
#   Phase 0: Resolve warehouse_folder_document_type_id FK (enables child folder matching)
#   Phase 1: Compute folder_path using FK chain (now finds correct child folders)
#
# Without Phase 0, documents only resolve to ROOT folders (e.g., "Contacts/7 Eleven").
# With Phase 0, documents resolve to CHILD folders (e.g., "Contacts/7 Eleven/Financial/Bills").
#
# Runs in batches of 1000, idempotent, safe to re-run.
# Self-chains: queues next batch automatically until all documents are processed.
#
# Usage:
#   BackfillWarehousePathsJob.perform_later           # All tenants
#   BackfillWarehousePathsJob.perform_later(tenant_id) # Specific tenant
#
class BackfillWarehousePathsJob < ApplicationJob
  queue_as :low_priority

  BATCH_SIZE = 1000

  def perform(tenant_id = nil, batch_offset = 0)
    scope = WarehouseDocument.where(folder_path: nil).order(:id)
    scope = scope.where(tenant_id: tenant_id) if tenant_id

    documents = scope.limit(BATCH_SIZE).offset(batch_offset)
    return if documents.empty?

    computer = WarehousePathComputer.new
    updated_count = 0
    fk_set_count = 0
    error_count = 0

    documents.find_each do |doc|
      result = computer.compute(doc)

      # Phase 0: Persist the resolved FK if the computer found one
      # This enables future path computations to find the correct child folder directly
      updates = {
        folder_path: result[:folder_path],
        warehouse_folder_id: result[:warehouse_folder_id],
        path_template_version: result[:path_template_version],
        updated_at: Time.current
      }

      if computer.resolved_wfdt && doc.warehouse_folder_document_type_id.nil?
        updates[:warehouse_folder_document_type_id] = computer.resolved_wfdt.id
        fk_set_count += 1
      end

      doc.update_columns(updates)
      updated_count += 1
    rescue StandardError => e
      error_count += 1
      Rails.logger.warn "[BackfillWarehousePathsJob] Error for doc##{doc.id}: #{e.message}"
    end

    Rails.logger.info "[BackfillWarehousePathsJob] Batch #{batch_offset}: " \
                      "#{updated_count} updated, #{fk_set_count} FKs set, #{error_count} errors" \
                      "#{tenant_id ? " (tenant##{tenant_id})" : ""}"

    # Queue next batch if this batch was full
    if documents.size == BATCH_SIZE
      self.class.perform_later(tenant_id, batch_offset + BATCH_SIZE)
    else
      remaining = WarehouseDocument.where(folder_path: nil)
      remaining = remaining.where(tenant_id: tenant_id) if tenant_id
      Rails.logger.info "[BackfillWarehousePathsJob] Complete! #{remaining.count} documents still without paths"
    end
  end
end
