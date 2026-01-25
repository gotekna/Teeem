# frozen_string_literal: true

module Api
  module V1
    class TeeemDocumentsController < ApplicationController
      before_action :set_document, only: [:show, :update, :destroy, :export, :save_to_warehouse]

      # GET /api/v1/teeem_documents
      # Optional params:
      #   - job_id: filter by job (returns documents attached to this job)
      #   - unattached: if "true", returns only documents not attached to any job
      def index
        documents = current_user.teeem_documents.user_documents.recent

        # Filter by job if specified
        if params[:job_id].present?
          documents = documents.for_job(params[:job_id])
        elsif params[:unattached] == "true"
          documents = documents.unattached
        end

        render json: {
          success: true,
          data: documents.map { |d| document_summary(d) }
        }
      end

      # GET /api/v1/teeem_documents/:id
      def show
        render json: {
          success: true,
          data: document_detail(@document)
        }
      end

      # POST /api/v1/teeem_documents
      def create
        document = current_user.teeem_documents.build(document_params)

        if document.save
          render json: {
            success: true,
            data: document_detail(document)
          }, status: :created
        else
          render json: {
            success: false,
            error: document.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/teeem_documents/:id
      def update
        if @document.update(document_params)
          render json: {
            success: true,
            data: document_detail(@document)
          }
        else
          render json: {
            success: false,
            error: @document.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/teeem_documents/:id
      def destroy
        @document.destroy
        render json: { success: true }
      end

      # GET /api/v1/teeem_documents/:id/export
      # Exports document to DOCX format
      def export
        # For now, return the HTML content
        # TODO: Implement proper DOCX export using docx gem
        html_content = @document.data["content"] || "<p></p>"

        send_data html_content,
          filename: "#{@document.name.parameterize}.html",
          type: "text/html",
          disposition: "attachment"
      end

      # POST /api/v1/teeem_documents/:id/save_to_warehouse
      # Saves document to File Warehouse (S3) as HTML (Word-compatible)
      def save_to_warehouse
        html_content = @document.data["content"] || "<p></p>"

        # Wrap HTML content with basic Word-compatible structure
        word_html = <<~HTML
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>#{@document.name}</title>
            <style>
              body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; }
              p { margin: 0 0 12pt 0; }
              h1 { font-size: 24pt; margin: 24pt 0 12pt 0; }
              h2 { font-size: 18pt; margin: 18pt 0 12pt 0; }
              h3 { font-size: 14pt; margin: 14pt 0 12pt 0; }
            </style>
          </head>
          <body>
            #{html_content}
          </body>
          </html>
        HTML

        begin
          # SSoT (Jan 2026): Use tenant for storage provider
          provider = DocumentProviders.for_tenant(current_tenant)

          folder_path = @document.warehouse_folder_path
          filename = "#{@document.safe_filename}.html"

          result = provider.upload_file(
            folder_path,
            word_html,
            filename,
            content_type: "text/html",
            overwrite: true
          )

          # Update storage tracking
          @document.update_columns(
            storage_path: "#{folder_path}/#{filename}",
            storage_provider: "s3_compatible"
          )

          render json: {
            success: true,
            message: "Saved to File Warehouse",
            path: "#{folder_path}/#{filename}"
          }
        rescue StandardError => e
          Rails.logger.error "[TeeemDocument] Save to warehouse failed: #{e.message}"
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end
      end

      private

      def set_document
        @document = current_user.teeem_documents.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Document not found" }, status: :not_found
      end

      def document_params
        params.require(:teeem_document).permit(:name, :is_template, :job_id, :description, :storage_path, :storage_provider, data: {})
      end

      def document_summary(document)
        {
          id: document.id,
          name: document.name,
          description: document.description,
          isTemplate: document.is_template,
          jobId: document.job_id,
          jobName: document.job&.name,
          storagePath: document.storage_path,
          storageProvider: document.storage_provider,
          updatedAt: document.updated_at.iso8601,
          createdAt: document.created_at.iso8601
        }
      end

      def document_detail(document)
        {
          id: document.id,
          name: document.name,
          description: document.description,
          isTemplate: document.is_template,
          data: document.data,
          jobId: document.job_id,
          jobName: document.job&.name,
          storagePath: document.storage_path,
          storageProvider: document.storage_provider,
          updatedAt: document.updated_at.iso8601,
          createdAt: document.created_at.iso8601
        }
      end
    end
  end
end
