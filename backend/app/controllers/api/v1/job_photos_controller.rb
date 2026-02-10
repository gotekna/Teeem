module Api
  module V1
    class JobPhotosController < ApplicationController
      include DocumentProviderAware

      # POST /api/v1/jobs/:job_id/photos/upload
      # Upload a photo directly to a job's storage folder
      # SSoT: Uses DocumentProviderAware for provider-agnostic storage (Wasabi, SharePoint, S3)
      # Params:
      #   - file: The photo file (multipart)
      #   - folder_path: The relative folder path (e.g., "06 Photo/01 SITE")
      def upload
        job = Job.find(params[:job_id])

        # SSoT: Setup provider using WarehouseProvider
        begin
          setup_default_provider!
        rescue DocumentProviders::NotConnectedError => e
          return render json: {
            success: false,
            error: "Storage not connected: #{e.message}"
          }, status: :unauthorized
        end

        uploaded_file = params[:file]
        folder_path = params[:folder_path] || "06 Photo"

        # FRC (Feb 2026): folder_path from WarehouseFolder is full_folder_path which includes
        # the warehouse_type template prefix (e.g., "Jobs/{{JobCode}}/Photo/Site").
        # Since build_job_folder_path already resolves the job's root folder, we need just the
        # relative path WITHIN the job folder (e.g., "Photo/Site").
        if folder_path.match?(/\{\{/)
          # New-style path from WarehouseFolder - strip warehouse_type template prefix
          warehouse_type = WarehouseType.find_by(code: "job")
          prefix_segment_count = warehouse_type&.folder_path_template&.split('/')&.length || 0
          segments = folder_path.split('/')
          folder_path = segments.drop(prefix_segment_count).join('/')
        end
        folder_path = folder_path.gsub(/^\/+/, "")

        # Use provided filename or fallback to original
        filename = params[:filename].presence || uploaded_file&.original_filename

        unless uploaded_file
          return render json: { success: false, error: "No file provided" }, status: :bad_request
        end

        begin
          Rails.logger.info "[JobPhotos] Starting upload for job #{job.id}, folder_path: #{folder_path}, filename: #{filename}, provider: #{current_provider_type}"

          # Build full path to target folder
          job_folder_path = build_job_folder_path(job)
          target_folder_path = folder_path.present? ? "#{job_folder_path}/#{folder_path}" : job_folder_path

          Rails.logger.info "[JobPhotos] Target folder path: #{target_folder_path}"

          # Ensure job folder and subfolder exist
          unless folder_exists_in_provider?(job_folder_path)
            Rails.logger.info "[JobPhotos] Job folder not found, creating structure..."
            get_or_create_folder_path(job_folder_path)
          end

          # Create target subfolder if different from job folder
          if folder_path.present?
            get_or_create_folder_path(target_folder_path)
          end

          # Read file content before upload (upload_to_provider consumes the stream)
          file_content = uploaded_file.read
          content_type = uploaded_file.content_type

          # Upload the file
          Rails.logger.info "[JobPhotos] Uploading file to #{target_folder_path}"
          result = upload_to_provider(target_folder_path, file_content, filename, content_type: content_type)

          Rails.logger.info "[JobPhotos] Successfully uploaded #{filename} to #{target_folder_path}"

          # SSoT: Create StorageBlob + WarehouseDocument via standard service
          begin
            doc = WarehouseDocumentCreator.create_with_content!(
              content: file_content,
              filename: filename,
              content_type: content_type,
              source_type: "job",
              linkable: job,
              warehouse_folder_id: params[:warehouse_folder_id],
              metadata: { "source" => "s3_upload" },
              user: current_user
            )

            Rails.logger.info "[JobPhotos] Created WarehouseDocument #{doc.id} for #{filename}"
          rescue StandardError => e
            # Non-fatal: photo is uploaded to storage, just missing DB tracking
            Rails.logger.error "[JobPhotos] Failed to create WarehouseDocument: #{e.message}"
          end

          # SSoT: Use JobActivity for consistent activity logging across the job
          JobActivity.log_document_uploaded(
            job,
            document_name: filename,
            document_url: result[:web_url] || result[:path],
            user: current_user
          )

          render json: {
            success: true,
            message: "Photo uploaded successfully",
            file: {
              id: result[:id],
              name: result[:name] || filename,
              web_url: result[:web_url] || result[:path],
              size: result[:size],
              folder_path: folder_path
            },
            provider: current_provider_type.to_s
          }

        rescue DocumentProviders::AuthenticationError => e
          Rails.logger.error "[JobPhotos] Auth error: #{e.message}"
          render json: { success: false, error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue DocumentProviders::Error => e
          Rails.logger.error "[JobPhotos] Storage error: #{e.message}"
          render json: { success: false, error: "Storage error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "[JobPhotos] Upload error: #{e.message}"
          Rails.logger.error e.backtrace.first(10).join("\n")
          render json: { success: false, error: "Failed to upload photo: #{e.message}" }, status: :internal_server_error
        end
      end

      private

      # Build job folder path using SSoT pattern from WarehouseProvider
      # SSoT: Uses job_number (job_code), NOT job.id
      def build_job_folder_path(job)
        storage_config&.job_path(job.job_code) || begin
          # Fallback: Build manually (should not happen if WarehouseProvider is set up)
          base_folder = scope_folder_path(:job)
          job_folder_name = job.job_code
          "/#{base_folder}/#{job_folder_name}"
        end
      end
    end
  end
end
