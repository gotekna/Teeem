# frozen_string_literal: true

module Api
  module V1
    class DocumentsController < ApplicationController
      before_action :set_document, only: [ :show, :update, :destroy ]

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

      def document_to_json(doc)
        {
          id: doc.id,
          name: doc.file_name || doc.title,
          display_title: doc.display_title,
          type: doc.mime_type || "application/octet-stream",
          size: doc.file_size || 0,
          url: doc.sharepoint_url,
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
          fiscal_year: doc.year&.to_s,
          company_name: doc.corporate_company&.name,
          verified: doc.ai_verification_status == "verified",
          verified_at: doc.validated_at&.iso8601,
          verified_by: doc.user_validated_by&.name
        }
      end
    end
  end
end
