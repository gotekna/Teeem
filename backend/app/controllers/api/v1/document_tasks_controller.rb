# frozen_string_literal: true

# SSoT (Jan 2026): Document Tasks Controller
#
# Provides document task data per job + document type category.
# Originally backed by JobDocument table (dropped), now uses WarehouseDocument.
#
module Api
  module V1
    class DocumentTasksController < ApplicationController
      before_action :set_job

      # GET /api/v1/jobs/:job_id/document_tasks?category=:document_type_id
      def index
        category_id = params[:category]

        # Get warehouse documents for this job, optionally filtered by document type
        docs = WarehouseDocument.where(linkable_type: "Job", linkable_id: @job.id)
          .or(WarehouseDocument.where(source_type: "job", documentable_type: "Job", documentable_id: @job.id))
          .includes(:storage_blob)

        # Filter by document type if category provided
        if category_id.present?
          doc_type = DocumentType.find_by(id: category_id)
          if doc_type
            docs = docs.where("metadata->>'document_type' = ? OR metadata->>'document_type_id' = ?",
                              doc_type.name, category_id.to_s)
          end
        end

        tasks = docs.map do |doc|
          blob = doc.storage_blob
          {
            id: doc.id,
            name: doc.ui_name || doc.original_filename || "Untitled",
            file_name: doc.original_filename || doc.ui_name,
            file_size: doc.file_size || blob&.file_size || 0,
            content_type: blob&.content_type || doc.content_type,
            folder_path: doc.folder_path,
            document_type_id: category_id,
            document_type_name: doc.document_type_name,
            status: "uploaded",
            uploaded_at: doc.created_at&.iso8601,
            download_url: doc.download_url
          }
        end

        render json: {
          success: true,
          data: tasks,
          total: tasks.size,
          category_id: category_id
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end
    end
  end
end
