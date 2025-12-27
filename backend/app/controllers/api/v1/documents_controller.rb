# frozen_string_literal: true

module Api
  module V1
    class DocumentsController < ApplicationController
      before_action :set_document, only: [ :show, :update, :destroy, :preview ]

      # GET /api/v1/documents
      # Returns documents with folder structure for the documents page
      def index
        documents = CorporateCompanyDocument.includes(:corporate_company, :user, :document_type_record)
                                   .order(created_at: :desc)
                                   .limit(params[:limit] || 100)

        # Filter by folder if provided
        documents = documents.by_folder(params[:folder]) if params[:folder].present?

        # Get unique folders
        folders = CorporateCompanyDocument.where.not(folder: [ nil, "" ])
                                 .group(:folder)
                                 .pluck(:folder)
                                 .map.with_index do |folder_name, index|
          {
            id: (index + 1).to_s,
            name: folder_name.titleize,
            path: "/#{folder_name.downcase}",
            documents_count: CorporateCompanyDocument.by_folder(folder_name).count
          }
        end

        render json: {
          success: true,
          documents: documents.map { |doc| document_to_json(doc) },
          folders: folders
        }
      end

      # GET /api/v1/documents/:id
      def show
        render json: {
          success: true,
          document: document_to_json(@document)
        }
      end

      # PATCH /api/v1/documents/:id
      def update
        if @document.update(document_params)
          render json: {
            success: true,
            document: document_to_json(@document)
          }
        else
          render json: {
            success: false,
            errors: @document.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/documents/:id
      def destroy
        @document.destroy
        render json: { success: true, message: "Document deleted successfully" }
      end

      # GET /api/v1/documents/:id/preview
      # Universal document preview - returns structured data for Excel/Word/PDF
      def preview
        unless @document.file_url.present?
          return render json: { success: false, error: "No file attached" }, status: :not_found
        end

        # Download file from SharePoint
        file_content = download_document_content(@document)
        unless file_content
          return render json: { success: false, error: "Could not download file" }, status: :unprocessable_entity
        end

        # Use UniversalDocumentReader to parse
        begin
          temp_file = Tempfile.new([ "doc", File.extname(@document.file_name || ".bin") ])
          temp_file.binmode
          temp_file.write(file_content)
          temp_file.close

          reader = UniversalDocumentReader.new(temp_file.path, filename: @document.file_name)

          render json: {
            success: true,
            data: {
              type: reader.file_type.to_s,
              filename: @document.file_name,
              content: reader.read,
              metadata: reader.metadata
            }
          }
        rescue UniversalDocumentReader::UnsupportedFileTypeError => e
          render json: { success: false, error: e.message, type: "unsupported" }, status: :unprocessable_entity
        rescue UniversalDocumentReader::ReadError => e
          render json: { success: false, error: e.message, type: "read_error" }, status: :unprocessable_entity
        ensure
          temp_file&.unlink
        end
      end

      # POST /api/v1/documents/preview_upload
      # Preview an uploaded file (for email attachments, etc.)
      def preview_upload
        unless params[:file].present?
          return render json: { success: false, error: "No file provided" }, status: :bad_request
        end

        file = params[:file]
        reader = UniversalDocumentReader.new(file, filename: file.original_filename)

        unless reader.supported?
          return render json: {
            success: false,
            error: "Unsupported file type: #{file.original_filename}",
            type: "unsupported",
            metadata: reader.metadata
          }, status: :unprocessable_entity
        end

        render json: {
          success: true,
          data: {
            type: reader.file_type.to_s,
            filename: file.original_filename,
            content: reader.read,
            metadata: reader.metadata
          }
        }
      rescue UniversalDocumentReader::ReadError => e
        render json: { success: false, error: e.message, type: "read_error" }, status: :unprocessable_entity
      end

      # POST /api/v1/documents/analyze
      # AI analysis of document content
      def analyze
        document = CorporateCompanyDocument.find(params[:document_id])

        # Return mock suggestion for now - can integrate with AI service later
        suggestion = {
          display_title: document.display_title || document.title,
          document_type_id: document.document_type_id,
          fiscal_year: document.year&.to_s,
          confidence: 0.85,
          reasoning: "Based on filename pattern and content analysis"
        }

        render json: { success: true, suggestion: suggestion }
      end

      private

      def set_document
        @document = CorporateCompanyDocument.find(params[:id])
      end

      def document_params
        params.permit(
          :display_title,
          :document_type_id,
          :fiscal_year,
          :verified,
          :title,
          :folder
        )
      end

      def download_document_content(document)
        # Try file_url (SharePoint) first
        if document.file_url.present?
          begin
            response = HTTParty.get(document.file_url, timeout: 30)
            return response.body if response.success?
          rescue => e
            Rails.logger.warn "[DocumentsController] SharePoint download failed: #{e.message}"
          end
        end

        # Fallback to ActiveStorage if available
        if document.respond_to?(:file) && document.file.attached?
          return document.file.download
        end

        nil
      end

      def document_to_json(doc)
        {
          id: doc.id,
          name: doc.file_name,
          display_title: doc.display_name || doc.file_name,
          type: doc.mime_type || "application/octet-stream",
          size: doc.file_size || 0,
          url: doc.file_url,
          job_title: nil, # CorporateCompanyDocuments aren't linked to jobs
          job_id: nil,
          uploaded_at: doc.created_at&.iso8601,
          uploaded_by: doc.user&.name || "Unknown",
          folder_path: doc.folder,
          document_type: doc.document_type_record ? {
            id: doc.document_type_record.id,
            name: doc.document_type_record.name,
            abbreviation: doc.document_type_record.abbreviation || doc.document_type_record.name[0..2].upcase
          } : nil,
          fiscal_year: doc.financial_years&.first&.to_s,
          company_name: doc.corporate_company&.name,
          verified: doc.ai_verification_status == "verified",
          verified_at: doc.user_validated_at&.iso8601,
          verified_by: doc.user_validated_by&.name
        }
      end
    end
  end
end
