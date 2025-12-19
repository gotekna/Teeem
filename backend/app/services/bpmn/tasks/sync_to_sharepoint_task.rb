module Bpmn
  module Tasks
    class SyncToSharepointTask < BaseTask
      def execute
        source = @config["source"]
        destination_path = get_config("destination_path", interpolate_value: true)

        log_info("Syncing to SharePoint: #{destination_path}")

        # Get OneDrive service
        org = @subject.try(:organization) || Organization.current
        onedrive = OnedriveService.new(org)

        raise "SharePoint not connected" unless onedrive.connected?

        files_synced = []

        case source["type"]
        when "subject_documents"
          # Sync all documents attached to the subject
          if @subject.respond_to?(:documents)
            @subject.documents.each do |doc|
              result = onedrive.upload_file(
                file: doc,
                path: destination_path
              )
              files_synced << { name: doc.filename, path: result["webUrl"] }
            end
          end
        when "variable"
          # Sync a specific file from a variable
          file_data = @variables[source["variable_name"]]
          if file_data.present?
            result = onedrive.upload_file(
              file: file_data,
              path: destination_path
            )
            files_synced << { name: file_data[:filename], path: result["webUrl"] }
          end
        when "generated_document"
          # Sync the most recently generated document
          doc_var = @variables[@config["document_variable"]]
          if doc_var.present?
            result = onedrive.upload_file(
              file: doc_var,
              path: destination_path
            )
            files_synced << { name: doc_var[:filename], path: result["webUrl"] }
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
    end
  end
end
