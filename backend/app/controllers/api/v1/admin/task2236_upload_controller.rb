# frozen_string_literal: true

# TEMPORARY CONTROLLER - Delete after Task #2236 files are uploaded
# Accepts file uploads via curl and re-uploads to correct S3 location
#
# Usage from local machine:
#   curl -X POST https://teeem-production.../api/v1/admin/task2236_upload \
#     -H "X-Admin-Key: TASK2236_SECRET_KEY" \
#     -F "doc_id=19934" \
#     -F "file=@/path/to/file.pdf"

module Api
  module V1
    module Admin
      class Task2236UploadController < ApplicationController
        skip_before_action :verify_authenticity_token
        skip_before_action :require_login, raise: false
        before_action :verify_admin_key

        # Document ID to expected filename mapping
        ALLOWED_DOCS = {
          19934 => "Standard Balance Sheet 2019 HFT.pdf",
          19974 => "Deed of Gift - Rachel - 15.03.21.pdf",
          19975 => "Deed of Gift - Sophie - 15.03.21.pdf",
          19976 => "Deed of Gift - Jared - 15.03.21.pdf",
          19977 => "Walan Settlement.pdf",
          19978 => "Deed of Gift - Grace - 15.03.21.pdf",
          19980 => "24fy Rachel Paying Loan and Interest.pdf",
          19981 => "FY 25 Rachel Paying Interest and Loan.pdf",
          19982 => "Rachel Receiving Gen2612.pdf"
        }.freeze

        def create
          doc_id = params[:doc_id].to_i
          file = params[:file]

          unless ALLOWED_DOCS.key?(doc_id)
            return render json: { success: false, error: "Invalid doc_id: #{doc_id}" }, status: :forbidden
          end

          unless file.present?
            return render json: { success: false, error: "No file provided" }, status: :bad_request
          end

          # Set tenant context from Task #2236
          task = SmTask.unscoped.find_by(id: 2236)
          unless task&.tenant_id
            return render json: { success: false, error: "Task #2236 not found" }, status: :not_found
          end

          tenant = Tenant.find_by(id: task.tenant_id)
          ActsAsTenant.current_tenant = tenant

          # Find the document
          doc = CorporateCompanyDocument.find_by(id: doc_id)
          unless doc
            return render json: { success: false, error: "Document #{doc_id} not found" }, status: :not_found
          end

          begin
            content = file.read
            content_type = file.content_type || Marcel::MimeType.for(Pathname.new(file.original_filename))

            # Create new StorageBlob with content-addressed storage
            blob = StorageBlob.find_or_create_for_content!(
              content,
              filename: doc.file_name,
              content_type: content_type
            )

            # Update document to use new blob
            doc.storage_blob&.decrement_reference! if doc.storage_blob_id.present?
            doc.storage_blob = blob
            doc.content_hash = blob.content_hash
            doc.file_size = content.bytesize
            doc.storage_path = blob.storage_path
            doc.save!
            blob.increment_reference!

            # Update warehouse_document if exists
            if doc.warehouse_document
              doc.warehouse_document.update!(storage_blob: blob)
            end

            render json: {
              success: true,
              doc_id: doc_id,
              filename: doc.file_name,
              storage_path: blob.storage_path,
              file_size: content.bytesize
            }
          rescue => e
            Rails.logger.error("Task2236 upload error: #{e.message}")
            render json: { success: false, error: e.message }, status: :internal_server_error
          end
        end

        private

        def verify_admin_key
          expected_key = ENV["TASK2236_ADMIN_KEY"] || "task2236_upload_#{Rails.application.secret_key_base[0..15]}"
          provided_key = request.headers["X-Admin-Key"]

          unless provided_key == expected_key
            render json: { success: false, error: "Unauthorized" }, status: :unauthorized
          end
        end
      end
    end
  end
end
