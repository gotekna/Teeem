# frozen_string_literal: true

module Bpmn
  module Tasks
    # SyncToStorageTask - Provider-agnostic document sync (SSoT compliant)
    #
    # ╔═══════════════════════════════════════════════════════════════════╗
    # ║  SSoT: Uses DocumentStorageService → WarehouseProvider          ║
    # ║  Works with Wasabi, S3, SharePoint, or Local storage              ║
    # ╚═══════════════════════════════════════════════════════════════════╝
    #
    # This task replaces the legacy SyncToSharepointTask which hardcoded SharePoint.
    # It uses DocumentStorageService to upload documents, respecting the tenant's
    # configured storage provider (from WarehouseProvider.provider_type).
    #
    # Config:
    #   source:
    #     type: "subject_documents" | "variable" | "generated_document"
    #     variable_name: "name_of_variable" (for type: variable)
    #   destination_path: "{{JobCode}}/Documents" (template)
    #   store_results_as: "sync_result" (optional)
    #
    # Example workflow config:
    #   {
    #     "task_type": "sync_to_storage",
    #     "source": { "type": "subject_documents" },
    #     "destination_path": "Jobs/{{JobCode}}/{{TabName}}"
    #   }
    #
    class SyncToStorageTask < BaseTask
      def execute
        source = @config["source"] || {}
        destination_path = get_config("destination_path", interpolate_value: true)

        log_info("Syncing documents to storage: #{destination_path}")

        files_synced = []

        case source["type"]
        when "subject_documents"
          # Sync all documents attached to the subject
          if @subject.respond_to?(:documents)
            @subject.documents.each do |doc|
              result = sync_document(doc)
              files_synced << result if result
            end
          end

        when "variable"
          # Sync a specific file from a variable
          file_data = @variables[source["variable_name"]]
          if file_data.present?
            result = sync_file_data(file_data)
            files_synced << result if result
          end

        when "generated_document"
          # Sync the most recently generated document
          doc_var = @variables[@config["document_variable"]]
          if doc_var.present?
            result = sync_file_data(doc_var)
            files_synced << result if result
          end
        end

        # Store results
        if @config["store_results_as"]
          set_variable(@config["store_results_as"], {
            files_synced: files_synced,
            destination: destination_path,
            synced_at: Time.current.iso8601
          })
        end

        {
          files_synced: files_synced.count,
          destination_path: destination_path,
          synced_at: Time.current.iso8601
        }
      end

      private

      # Sync an ActiveRecord document model — blob-only (Mar 2026)
      # Creates a WarehouseDocument referencing the existing blob (no S3 re-upload)
      def sync_document(doc)
        blob = if doc.respond_to?(:storage_blob) && doc.storage_blob.present?
          doc.storage_blob
        elsif doc.respond_to?(:warehouse_document) && doc.warehouse_document&.storage_blob.present?
          doc.warehouse_document.storage_blob
        end

        unless blob
          log_warn("Cannot sync document #{doc.id}: no storage_blob - needs migration")
          return nil
        end

        filename = doc.respond_to?(:file_name) ? doc.file_name : blob.original_filename
        return nil unless filename

        # Create WarehouseDocument for destination (blob already exists, just link it)
        WarehouseDocumentCreator.create!(
          filename: filename, source_type: "job", linkable: @subject,
          storage_blob: blob, content_type: blob.content_type,
          file_size: blob.file_size
        )
        blob.increment_reference!

        log_info("Synced: #{filename}")
        { name: filename, blob_id: blob.id }
      rescue StandardError => e
        log_error("Failed to sync document #{doc.id}: #{e.message}")
        nil
      end

      # Sync raw file data (from a workflow variable) — blob-only (Mar 2026)
      def sync_file_data(file_data)
        filename = file_data[:filename] || file_data["filename"] || "document"
        content = file_data[:content] || file_data["content"]
        return nil unless content

        blob = StorageBlob.find_or_create_for_content!(
          content, filename: filename, content_type: "application/pdf"
        )

        WarehouseDocumentCreator.create!(
          filename: filename, source_type: "job", linkable: @subject,
          storage_blob: blob, file_size: content.bytesize, content_type: "application/pdf"
        )

        log_info("Synced: #{filename}")
        { name: filename, blob_id: blob.id }
      rescue StandardError => e
        log_error("Failed to sync file: #{e.message}")
        nil
      end
    end
  end
end
