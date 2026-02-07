# frozen_string_literal: true

# ReconcileWarehousePathsJob - Nightly safety net for stale materialized paths
#
# Finds and fixes documents whose path_template_version is behind their
# warehouse folder's template_version. This catches anything the event
# triggers missed (e.g., race conditions, failed jobs, manual DB changes).
#
# Self-healing: idempotent, safe to run any time.
#
# Schedule: Run nightly via cron/scheduler
#
# Usage:
#   ReconcileWarehousePathsJob.perform_later
#   ReconcileWarehousePathsJob.perform_later(tenant_id) # Scope to one tenant
#
class ReconcileWarehousePathsJob < ApplicationJob
  queue_as :low_priority

  BATCH_SIZE = 1000

  def perform(tenant_id = nil)
    total_fixed = 0
    total_errors = 0

    # Find stale documents: path_template_version < warehouse_folder.template_version
    # OR folder_path is NULL (never materialized)
    scope = WarehouseDocument.left_joins(:warehouse_folder)
    scope = scope.where(tenant_id: tenant_id) if tenant_id

    # Documents that need recomputation
    stale_docs = scope.where(
      "warehouse_documents.folder_path IS NULL " \
      "OR (warehouse_folders.template_version IS NOT NULL " \
      "AND warehouse_documents.path_template_version < warehouse_folders.template_version)"
    )

    stale_count = stale_docs.count
    Rails.logger.info "[ReconcileWarehousePathsJob] Found #{stale_count} stale documents" \
                      "#{tenant_id ? " for tenant##{tenant_id}" : ""}"

    return if stale_count.zero?

    computer = WarehousePathComputer.new

    stale_docs.find_each(batch_size: BATCH_SIZE) do |doc|
      result = computer.compute(doc)

      doc.update_columns(
        folder_path: result[:folder_path],
        warehouse_folder_id: result[:warehouse_folder_id],
        path_template_version: result[:path_template_version],
        updated_at: Time.current
      )
      total_fixed += 1
    rescue StandardError => e
      total_errors += 1
      Rails.logger.warn "[ReconcileWarehousePathsJob] Error for doc##{doc.id}: #{e.message}"
    end

    Rails.logger.info "[ReconcileWarehousePathsJob] Complete: #{total_fixed} fixed, #{total_errors} errors"
  end
end
