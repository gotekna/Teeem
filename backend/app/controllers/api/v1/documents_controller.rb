# frozen_string_literal: true

module Api
  module V1
    class DocumentsController < ApplicationController
      before_action :set_document, only: [ :show, :update, :destroy, :preview ]

      # GET /api/v1/documents/all
      # Returns all documents across JobDocument, CorporateCompanyDocument, and PeopleDocument
      # Used by the unified "All Documents" page
      def all
        # Fetch from all three document sources with eager loading
        job_docs = JobDocument.includes(:job, :document_type, :contact, :company)
                              .where.not(file_name: nil)
                              .order(created_at: :desc)
                              .limit(5000)

        corp_docs = CorporateCompanyDocument.includes(:corporate_company, :document_type_record, :contact)
                                            .where.not(file_name: nil)
                                            .order(created_at: :desc)
                                            .limit(5000)

        people_docs = PeopleDocument.includes(:contact, :document_type_record)
                                    .where.not(title: nil)
                                    .order(created_at: :desc)
                                    .limit(1000)

        render json: {
          success: true,
          data: {
            job_documents: job_docs.map { |d| serialize_job_doc(d) },
            corporate_documents: corp_docs.map { |d| serialize_corp_doc(d) },
            people_documents: people_docs.map { |d| serialize_people_doc(d) }
          },
          counts: {
            jobs: job_docs.size,
            corporate: corp_docs.size,
            people: people_docs.size,
            total: job_docs.size + corp_docs.size + people_docs.size
          }
        }
      end

      # GET /api/v1/documents
      # Returns documents with folder structure for the documents page
      # Params:
      #   search: Full-text search query (uses PostgreSQL tsvector + GIN index)
      #   folder: Filter by folder path
      #   limit: Max results (default: 100)
      def index
        documents = CorporateCompanyDocument.includes(:corporate_company, :user, :document_type_record)
                                   .order(created_at: :desc)
                                   .limit(params[:limit] || 100)

        # Full-text search using Searchable concern (GIN-indexed tsvector)
        if params[:search].present?
          documents = documents.search_text(params[:search])
        end

        # Filter by folder if provided
        documents = documents.by_folder(params[:folder]) if params[:folder].present?

        # Get unique folders with counts in a single query (avoids N+1)
        # Performance: 1 query instead of N queries for N folders
        folder_counts = CorporateCompanyDocument.where.not(folder: [ nil, "" ])
                                                .group(:folder)
                                                .count

        folders = folder_counts.keys.sort.map.with_index do |folder_name, index|
          {
            id: (index + 1).to_s,
            name: folder_name.titleize,
            path: "/#{folder_name.downcase}",
            documents_count: folder_counts[folder_name]
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

      # Serializers for all documents endpoint
      def serialize_job_doc(doc)
        {
          id: doc.id,
          source: "job",
          fileName: doc.file_name,
          displayName: doc.file_name,  # JobDocument doesn't have display_name
          mimeType: doc.mime_type || "application/octet-stream",
          fileSize: doc.file_size || 0,
          fileUrl: generate_download_url(doc),  # S3: presigned URL, SharePoint: web_url
          folderPath: doc.folder_path,
          storageProvider: doc.storage_provider,
          createdAt: doc.created_at&.iso8601,
          # Parent info
          jobId: doc.job_id,
          jobNumber: doc.job&.job_number,
          jobTitle: doc.job&.title,
          # Optional links
          contactId: doc.contact_id,
          contactName: doc.contact&.name,
          companyId: doc.company_id,
          companyName: doc.company&.name,
          # Document type
          documentTypeId: doc.document_type_id,
          documentTypeName: doc.document_type&.name,
          # Metadata
          isImage: doc.file_type == "image"
        }
      end

      def serialize_corp_doc(doc)
        {
          id: doc.id,
          source: "corporate",
          fileName: doc.file_name,
          displayName: doc.display_name || doc.file_name,
          mimeType: doc.mime_type || "application/octet-stream",
          fileSize: doc.file_size || 0,
          fileUrl: generate_download_url(doc),  # S3: presigned URL, SharePoint: file_url
          folderPath: doc.folder,
          storageProvider: doc.storage_provider,
          createdAt: doc.created_at&.iso8601,
          # Parent info
          companyId: doc.company_id,
          companyName: doc.corporate_company&.name,
          # Optional links
          contactId: doc.contact_id,
          contactName: doc.contact&.name,
          # Document type
          documentTypeId: doc.document_type_id,
          documentTypeName: doc.document_type_record&.name,
          # Metadata
          isImage: image_file?(doc.file_name)
        }
      end

      def serialize_people_doc(doc)
        {
          id: doc.id,
          source: "people",
          fileName: doc.file_name || doc.title,
          displayName: doc.title,
          mimeType: doc.mime_type || "application/octet-stream",
          fileSize: doc.file_size || 0,
          fileUrl: nil,  # PeopleDocument doesn't have file_url - use download endpoint
          folderPath: nil,
          storageProvider: doc.storage_provider,
          createdAt: doc.created_at&.iso8601,
          # Parent info
          contactId: doc.contact_id,
          contactName: doc.contact&.name,
          # Document type
          documentType: doc.document_type,
          documentTypeId: doc.document_type_id,
          documentTypeName: doc.document_type_record&.name || doc.formatted_document_type,
          # Metadata
          expiryDate: doc.expiry_date&.iso8601,
          isExpired: doc.expired?,
          isImage: image_file?(doc.file_name)
        }
      end

      def image_file?(filename)
        return false unless filename.present?
        %w[.jpg .jpeg .png .gif .webp .heic .tiff .bmp].any? { |ext| filename.downcase.end_with?(ext) }
      end

      # Generate a download URL for a document based on its storage provider
      # For S3 documents, generates a presigned URL
      # For SharePoint documents, returns the web_url column
      def generate_download_url(doc)
        return nil unless doc.present?

        if doc.storage_provider == 's3_compatible' && doc.storage_item_id.present?
          # Generate presigned S3 URL (1 hour expiry)
          begin
            organization = Organization.first # Single-tenant
            provider = DocumentProviders::S3Compatible.for_organization(organization)
            provider.download_url(doc.storage_item_id, expires_in: 3600)
          rescue => e
            Rails.logger.warn "[Documents] Failed to generate S3 URL for #{doc.class.name}##{doc.id}: #{e.message}"
            nil
          end
        else
          # SharePoint - use stored URL column
          # JobDocument uses web_url, CorporateCompanyDocument uses file_url
          doc.respond_to?(:web_url) ? doc.web_url : doc.file_url
        end
      end
    end
  end
end
