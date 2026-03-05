module Api
  module V1
    class JobPhotosController < ApplicationController
      # POST /api/v1/jobs/:job_id/photos/upload
      # Upload a photo to blob storage (SSoT: WarehouseDocumentCreator)
      # Blob-only storage (Mar 2026): No legacy S3 folder creation.
      def upload
        job = Job.find(params[:job_id])

        uploaded_file = params[:file]
        unless uploaded_file
          return render_error("No file provided", status: :bad_request)
        end

        filename = params[:filename].presence || uploaded_file.original_filename
        file_content = uploaded_file.read
        content_type = uploaded_file.content_type

        Rails.logger.info "[JobPhotos] Starting upload for job #{job.id}, filename: #{filename}"

        doc = WarehouseDocumentCreator.create_with_content!(
          content: file_content,
          filename: filename,
          content_type: content_type,
          source_type: "job",
          linkable: job,
          warehouse_folder_id: params[:warehouse_folder_id],
          metadata: { "source" => "photo_upload" },
          user: current_user
        )

        Rails.logger.info "[JobPhotos] Created WarehouseDocument #{doc.id} for #{filename}"

        JobActivity.log_document_uploaded(
          job,
          document_name: filename,
          document_url: doc.storage_blob&.presigned_url,
          user: current_user
        )

        render json: {
          success: true,
          message: "Photo uploaded successfully",
          file: {
            id: doc.id,
            name: filename,
            size: file_content.bytesize
          }
        }

      rescue ActiveRecord::RecordNotFound => e
        render_error("Job not found", status: :not_found)
      rescue StandardError => e
        Rails.logger.error "[JobPhotos] Upload error: #{e.message}"
        Rails.logger.error e.backtrace.first(10).join("\n")
        render_error("Failed to upload photo: #{e.message}", status: :internal_server_error)
      end
    end
  end
end
