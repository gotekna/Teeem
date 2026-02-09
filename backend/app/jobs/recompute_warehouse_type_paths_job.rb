# frozen_string_literal: true

# RecomputeWarehouseTypePathsJob - Recompute folder_path for ALL documents of a warehouse type
#
# Triggered when an admin changes the folder template structure (e.g., renames
# a folder segment, restructures parent hierarchy, changes folder_path_template).
#
# Broad: updates ALL documents of that warehouse type for the tenant.
# Batched: processes 1000 documents per batch with progress tracking.
# Idempotent: safe to retry or run multiple times.
#
# Usage:
#   RecomputeWarehouseTypePathsJob.perform_later(warehouse_type_id, tenant_id)
#
class RecomputeWarehouseTypePathsJob < ApplicationJob
  queue_as :default

  # Don't retry if warehouse type was deleted
  discard_on ActiveRecord::RecordNotFound

  BATCH_SIZE = 1000

  def perform(warehouse_type_id, tenant_id, batch_offset = 0)
    warehouse_type = WarehouseType.find(warehouse_type_id)

    # Map warehouse type code to source_types
    source_types = source_types_for_warehouse_type(warehouse_type.code)
    return if source_types.empty?

    documents = WarehouseDocument
      .where(tenant_id: tenant_id, source_type: source_types)
      .order(:id)
      .limit(BATCH_SIZE)
      .offset(batch_offset)

    return if documents.empty?

    computer = WarehousePathComputer.new
    updated_count = 0
    error_count = 0

    documents.find_each do |doc|
      result = computer.compute(doc)

      if result[:folder_path] != doc.folder_path
        doc.update_columns(
          folder_path: result[:folder_path],
          warehouse_folder_id: result[:warehouse_folder_id],
          path_template_version: result[:path_template_version],
          updated_at: Time.current
        )
        updated_count += 1
      end
    rescue StandardError => e
      error_count += 1
      Rails.logger.warn "[RecomputeWarehouseTypePathsJob] Error for doc##{doc.id}: #{e.message}"
    end

    Rails.logger.info "[RecomputeWarehouseTypePathsJob] WT##{warehouse_type_id} tenant##{tenant_id} " \
                      "batch #{batch_offset}: #{updated_count} updated, #{error_count} errors"

    # Queue next batch if this batch was full
    if documents.size == BATCH_SIZE
      self.class.perform_later(warehouse_type_id, tenant_id, batch_offset + BATCH_SIZE)
    end
  end

  private

  # Map warehouse type code to document source_types
  # A warehouse type may correspond to multiple source_types
  def source_types_for_warehouse_type(code)
    case code
    when "job" then %w[job compliance]
    when "corporate" then %w[corporate xero financial asset]
    when "contact" then %w[contact people]
    when "email" then %w[email]
    when "email_attachments" then %w[email_attachment]
    when "task", "task_attachments" then %w[task]
    when "case" then %w[case]
    when "notebook" then %w[notebook]
    when "bank_statement" then %w[xero]
    else [code]
    end
  end
end
