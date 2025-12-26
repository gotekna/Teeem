module Api
  module V1
    class JobPhotosController < ApplicationController
      # POST /api/v1/jobs/:job_id/photos/upload
      # Upload a photo directly to a job's SharePoint photo folder
      # Params:
      #   - file: The photo file (multipart)
      #   - folder_path: The relative folder path (e.g., "06 Photo/01 SITE")
      def upload
        job = Job.find(params[:job_id])

        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: {
            success: false,
            error: "SharePoint not connected. Please connect in Admin > System > Connections."
          }, status: :unauthorized
        end

        uploaded_file = params[:file]
        folder_path = params[:folder_path] || "06 Photo"
        # Use provided filename or fallback to original
        filename = params[:filename].presence || uploaded_file&.original_filename

        unless uploaded_file
          return render json: { success: false, error: "No file provided" }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Find or create the job folder
          job_folder = client.find_job_folder(job)

          unless job_folder
            # Create job folder structure if it doesn't exist
            template = FolderTemplate.where(is_system_default: true, is_active: true).first
            if template
              job_folder = client.create_job_folder_structure(job, template)
            else
              return render json: {
                success: false,
                error: "Job folder not found and no folder template available"
              }, status: :unprocessable_entity
            end
          end

          # Navigate to the photo folder within the job folder
          # folder_path can be like "06 Photo/01 SITE" or just "Photo"
          target_folder = find_or_create_folder_path(client, credential, job_folder["id"], folder_path)

          unless target_folder
            return render json: {
              success: false,
              error: "Could not find or create photo folder: #{folder_path}"
            }, status: :unprocessable_entity
          end

          # Upload the file with the specified filename
          result = client.upload_file(uploaded_file, target_folder["id"], filename)

          # Log the activity
          Activity.create(
            subject: job,
            user: current_user,
            action: "photo_uploaded",
            description: "Photo #{filename} uploaded to #{folder_path}"
          )

          render json: {
            success: true,
            message: "Photo uploaded successfully",
            file: {
              name: result["name"],
              web_url: result["webUrl"],
              size: result["size"],
              folder_path: folder_path
            }
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          Rails.logger.error "[JobPhotos] Auth error: #{e.message}"
          render json: { success: false, error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          Rails.logger.error "[JobPhotos] API error: #{e.message}"
          render json: { success: false, error: "SharePoint API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "[JobPhotos] Upload error: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { success: false, error: "Failed to upload photo: #{e.message}" }, status: :internal_server_error
        end
      end

      private

      # Navigate through a folder path and find or create each folder
      # Returns the final folder item or nil if failed
      def find_or_create_folder_path(client, credential, parent_folder_id, path)
        return nil if path.blank?

        # Split path and navigate/create each folder
        path_parts = path.split("/").reject(&:blank?)
        current_folder_id = parent_folder_id

        path_parts.each do |folder_name|
          # List children of current folder
          response = client.list_folder_items(current_folder_id)
          items = response["value"] || []

          # Find folder by name (case-insensitive)
          folder = items.find { |item| item["folder"] && item["name"]&.downcase == folder_name.downcase }

          if folder
            current_folder_id = folder["id"]
          else
            # Create the folder
            begin
              drive_path = credential.drive_id.present? ? "/drives/#{credential.drive_id}" : "/me/drive"
              new_folder = client.post("#{drive_path}/items/#{current_folder_id}/children", {
                name: folder_name,
                folder: {},
                "@microsoft.graph.conflictBehavior" => "rename"
              })
              current_folder_id = new_folder["id"]
              Rails.logger.info "[JobPhotos] Created folder: #{folder_name}"
            rescue StandardError => e
              Rails.logger.error "[JobPhotos] Failed to create folder #{folder_name}: #{e.message}"
              return nil
            end
          end
        end

        # Return the final folder info
        { "id" => current_folder_id }
      end
    end
  end
end
