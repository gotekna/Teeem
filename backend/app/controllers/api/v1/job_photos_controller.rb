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

        # SSoT: Strip {{JobCode}} placeholder if present
        # The folder_path comes from EntityTab.effective_sharepoint_path which may contain {{JobCode}}
        # Since we're already navigating inside the job folder, strip the {{JobCode}} prefix entirely
        # e.g., "{{JobCode}}/Site Photo" becomes "Site Photo"
        folder_path = folder_path.gsub(/\{\{JobCode\}\}\s*\/?/, "").gsub(/^\/+/, "")

        # Use provided filename or fallback to original
        filename = params[:filename].presence || uploaded_file&.original_filename

        unless uploaded_file
          return render json: { success: false, error: "No file provided" }, status: :bad_request
        end

        begin
          Rails.logger.info "[JobPhotos] Starting upload for job #{job.id}, folder_path: #{folder_path}, filename: #{filename}"
          client = MicrosoftGraphClient.new(credential)
          Rails.logger.info "[JobPhotos] MicrosoftGraphClient created successfully"

          # Find or create the job folder
          job_folder = client.find_job_folder(job)
          Rails.logger.info "[JobPhotos] find_job_folder result: #{job_folder&.slice('id', 'name', 'webUrl')}"

          # If job folder doesn't exist or has no valid ID, create it
          unless job_folder && job_folder["id"].present?
            Rails.logger.info "[JobPhotos] Job folder not found, creating structure..."
            template = FolderTemplate.where(is_system_default: true, is_active: true).first
            if template
              job_folder = client.create_job_folder_structure(job, template)
            else
              # No template - create a simple job folder
              job_code = job.id.to_s.rjust(3, "0")
              job_folder_name = "#{job_code} - #{job.title || job.name}"

              # Get or create root folder
              root_id = credential.root_folder_id
              unless root_id
                # Try to find TEEEM Jobs folder
                jobs_folder_name = CorporateCompanySetting.instance&.sharepoint_jobs_path || "TEEEM Jobs"
                root_results = client.get("#{client.send(:drive_path)}/root/children")
                jobs_folder = root_results["value"]&.find { |item| item["folder"] && item["name"] == jobs_folder_name }
                root_id = jobs_folder&.dig("id")
              end

              if root_id
                job_folder = client.create_folder(job_folder_name, parent_id: root_id)
              else
                return render json: {
                  success: false,
                  error: "Cannot create job folder: SharePoint jobs folder not found"
                }, status: :unprocessable_entity
              end
            end
          end

          # Navigate to the photo folder within the job folder
          # folder_path can be like "06 Photo/01 SITE" or just "Photo"
          Rails.logger.info "[JobPhotos] Navigating to folder_path: #{folder_path} within job_folder_id: #{job_folder['id']}"
          target_folder = find_or_create_folder_path(client, credential, job_folder["id"], folder_path)
          Rails.logger.info "[JobPhotos] target_folder result: #{target_folder.inspect}"

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
        return { "id" => parent_folder_id } if path.blank?

        # Split path and navigate/create each folder
        path_parts = path.split("/").reject(&:blank?)
        current_folder_id = parent_folder_id
        drive_path = credential.drive_id.present? ? "/drives/#{credential.drive_id}" : "/me/drive"

        path_parts.each do |folder_name|
          begin
            # List children of current folder
            response = client.list_folder_items(current_folder_id)
            items = response["value"] || []

            # Find folder by name (case-insensitive)
            folder = items.find { |item| item["folder"] && item["name"]&.downcase == folder_name.downcase }

            if folder
              current_folder_id = folder["id"]
            else
              # Create the folder
              new_folder = client.post("#{drive_path}/items/#{current_folder_id}/children", {
                name: folder_name,
                folder: {},
                "@microsoft.graph.conflictBehavior" => "rename"
              })
              current_folder_id = new_folder["id"]
              Rails.logger.info "[JobPhotos] Created folder: #{folder_name}"
            end
          rescue MicrosoftGraphClient::APIError => e
            # If listing fails (404), the parent folder might not exist - try creating it
            if e.message.include?("404") || e.message.include?("itemNotFound")
              Rails.logger.warn "[JobPhotos] Parent folder not found, creating #{folder_name}"
              begin
                new_folder = client.post("#{drive_path}/items/#{current_folder_id}/children", {
                  name: folder_name,
                  folder: {},
                  "@microsoft.graph.conflictBehavior" => "rename"
                })
                current_folder_id = new_folder["id"]
                Rails.logger.info "[JobPhotos] Created folder: #{folder_name}"
              rescue StandardError => create_error
                Rails.logger.error "[JobPhotos] Failed to create folder #{folder_name}: #{create_error.message}"
                return nil
              end
            else
              Rails.logger.error "[JobPhotos] Failed to navigate to folder #{folder_name}: #{e.message}"
              return nil
            end
          rescue StandardError => e
            Rails.logger.error "[JobPhotos] Failed to create folder #{folder_name}: #{e.message}"
            return nil
          end
        end

        # Return the final folder info
        { "id" => current_folder_id }
      end
    end
  end
end
