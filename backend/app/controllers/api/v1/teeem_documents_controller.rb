# frozen_string_literal: true

module Api
  module V1
    class TeeemDocumentsController < ApplicationController
      before_action :set_document, only: [:show, :update, :destroy, :export]

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
