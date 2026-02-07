# frozen_string_literal: true

# RecomputeDocumentPathsJob - Recompute folder_path for documents linked to a changed record
#
# Triggered when source data changes (e.g., job status, contact name, company code).
# Scoped: only updates documents linked to the specific changed record.
# Fast: typically 50-500 documents per record, completes in milliseconds.
# Idempotent: safe to retry or run multiple times.
#
# Usage:
#   RecomputeDocumentPathsJob.perform_later("Job", job.id)
#   RecomputeDocumentPathsJob.perform_later("Contact", contact.id)
#   RecomputeDocumentPathsJob.perform_later("CorporateCompany", company.id)
#
class RecomputeDocumentPathsJob < ApplicationJob
  queue_as :default

  # Don't retry if the record was deleted
  discard_on ActiveRecord::RecordNotFound

  def perform(linkable_type, linkable_id)
    documents = WarehouseDocument.where(
      linkable_type: linkable_type,
      linkable_id: linkable_id
    )

    # Also check documentable (some older docs use documentable instead of linkable)
    documentable_docs = WarehouseDocument.where(
      documentable_type: linkable_type,
      documentable_id: linkable_id
    )

    all_doc_ids = (documents.pluck(:id) + documentable_docs.pluck(:id)).uniq
    return if all_doc_ids.empty?

    computer = WarehousePathComputer.new
    updated_count = 0
    error_count = 0

    WarehouseDocument.where(id: all_doc_ids).find_each(batch_size: 100) do |doc|
      result = computer.compute(doc)

      # Only update if path actually changed
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
      Rails.logger.warn "[RecomputeDocumentPathsJob] Error recomputing doc##{doc.id}: #{e.message}"
    end

    Rails.logger.info "[RecomputeDocumentPathsJob] #{linkable_type}##{linkable_id}: " \
                      "#{all_doc_ids.size} docs checked, #{updated_count} updated, #{error_count} errors"
  end
end
