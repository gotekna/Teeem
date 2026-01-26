# frozen_string_literal: true

module Bpmn
  module Tasks
    # SyncToStorageTask - Provider-agnostic document sync (SSoT compliant)
    #
    # ╔═══════════════════════════════════════════════════════════════════╗
    # ║  SSoT: Uses DocumentStorageService → StorageConfiguration          ║
    # ║  Works with Wasabi, S3, SharePoint, or Local storage              ║
    # ╚═══════════════════════════════════════════════════════════════════╝
    #
    # This task replaces the legacy SyncToSharepointTask which hardcoded SharePoint.
    # It uses DocumentStorageService to upload documents, respecting the tenant's
    # configured storage provider (from StorageConfiguration.provider_type).
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
      include DocumentProviderAware

      def execute
        source = @config["source"] || {}
        destination_path = get_config("destination_path", interpolate_value: true)

        log_info("Syncing documents to storage: #{destination_path}")

        # SSoT: Setup provider from StorageConfiguration
        begin
          setup_default_provider!
        rescue DocumentProviders::NotConnectedError => e
          raise "Storage not connected: #{e.message}. Please configure storage in Admin > System > Connections."
        end

        log_info("Using storage provider: #{current_provider_type}")

        files_synced = []

        case source["type"]
        when "subject_documents"
          # Sync all documents attached to the subject
          if @subject.respond_to?(:documents)
            @subject.documents.each do |doc|
              result = sync_document(doc, destination_path)
              files_synced << result if result
            end
          end

        when "variable"
          # Sync a specific file from a variable
          file_data = @variables[source["variable_name"]]
          if file_data.present?
            result = sync_file_data(file_data, destination_path)
            files_synced << result if result
          end

        when "generated_document"
          # Sync the most recently generated document
          doc_var = @variables[@config["document_variable"]]
          if doc_var.present?
            result = sync_file_data(doc_var, destination_path)
            files_synced << result if result
          end
        end

        # Store results
        if @config["store_results_as"]
          set_variable(@config["store_results_as"], {
            files_synced: files_synced,
            destination: destination_path,
            provider: current_provider_type.to_s,
            synced_at: Time.current.iso8601
          })
        end

        {
          files_synced: files_synced.count,
          destination_path: destination_path,
          provider: current_provider_type.to_s,
          synced_at: Time.current.iso8601
        }
      end

      private

      # Sync an ActiveRecord document model
      def sync_document(doc, destination_path)
        # Get file content from the document
        content = nil
        filename = nil

        # SSoT: StorageBlob is THE ONE source - no fallback to storage_path
        if doc.respond_to?(:storage_blob) && doc.storage_blob.present?
          content = download_from_provider(doc.storage_blob.storage_path)
          filename = doc.respond_to?(:file_name) ? doc.file_name : doc.storage_blob.original_filename
        elsif doc.respond_to?(:warehouse_document) && doc.warehouse_document&.storage_blob.present?
          content = download_from_provider(doc.warehouse_document.storage_blob.storage_path)
          filename = doc.respond_to?(:file_name) ? doc.file_name : doc.warehouse_document.storage_blob.original_filename
        else
          log_warn("Cannot get content for document #{doc.id}: no storage_blob - needs migration")
          return nil
        end

        return nil unless content && filename

        # Upload to destination
        result = upload_to_provider(destination_path, content, filename)

        log_info("Synced: #{filename} -> #{result[:path]}")
        { name: filename, path: result[:path], id: result[:id] }
      rescue StandardError => e
        log_error("Failed to sync document #{doc.id}: #{e.message}")
        nil
      end

      # Sync raw file data (from a workflow variable)
      def sync_file_data(file_data, destination_path)
        filename = file_data[:filename] || file_data["filename"] || "document"
        content = file_data[:content] || file_data["content"]

        return nil unless content

        result = upload_to_provider(destination_path, content, filename)

        log_info("Synced: #{filename} -> #{result[:path]}")
        { name: filename, path: result[:path], id: result[:id] }
      rescue StandardError => e
        log_error("Failed to sync file: #{e.message}")
        nil
      end
    end
  end
end
