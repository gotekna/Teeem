# frozen_string_literal: true

module Api
  module V1
    class DocumentsController < ApplicationController
      before_action :set_document, only: [ :show, :update, :destroy, :download, :preview ]

      # GET /api/v1/documents/all
      # Returns file counts for the entire warehouse (fast)
      # Used by the File Warehouse page
      # SSoT: Counts ALL file types - documents, emails, attachments, tasks
      # NOTE: Scope keys match StorageConfiguration.SCOPE_FOLDERS for consistency
      def all
        # Document counts (records with actual files)
        job_count = JobDocument.where.not(file_name: [nil, ""]).count
        corp_count = CorporateCompanyDocument.where.not(file_name: [nil, ""]).count
        people_count = PeopleDocument.where.not(title: [nil, ""]).count

        # Email counts (EML files stored)
        email_eml_count = EmailWarehouse.where.not(sharepoint_email_path: [nil, ""]).count

        # Email attachment counts (files stored)
        email_attachment_count = EmailAttachment.where.not(sharepoint_path: [nil, ""]).count

        # Task attachment counts - documents uploaded against task IDs
        # These are CorporateCompanyDocuments linked via SmTaskAttachment
        task_attachment_ids = SmTaskAttachment.where(attachable_type: 'CorporateCompanyDocument').distinct.pluck(:attachable_id) rescue []
        task_doc_count = task_attachment_ids.size

        # Document templates (Word/Excel templates stored in SharePoint)
        template_count = DocumentTemplate.where.not(sharepoint_path: [nil, ""]).count rescue 0

        # Pricebook images (product photos)
        pricebook_image_count = PricebookItem.where.not(image_file_id: nil).count rescue 0

        # Active Storage files (Rails attachments)
        active_storage_count = ActiveStorage::Blob.count rescue 0

        # Notes attachments (notebook page files)
        notes_count = NotebookPageAttachment.count rescue 0

        # Excel spreadsheets (TeeemXL)
        excel_count = TeeemSpreadsheet.count rescue 0

        # Word documents (TeeemWord)
        word_count = TeeemDocument.count rescue 0

        # PowerPoint presentations (TeeemPowerPoint)
        powerpoint_count = TeeemPresentation.count rescue 0

        # User files from S3 (MyDocs folder)
        # SSoT: Path matches StorageConfiguration.SCOPE_FOLDERS["my_docs"] = "Users/MyDocs"
        # Note: list_folder returns an array of items directly, not a hash
        my_docs_count = begin
          organization = Organization.first
          provider = DocumentProviders::S3Compatible.for_organization(organization)
          items = provider.list_folder("Users/MyDocs", recursive: false) rescue []
          # Count only files (items with :type == :file), not folders
          items.is_a?(Array) ? items.count { |item| item[:type] == :file } : 0
        rescue => e
          Rails.logger.warn "[Documents] Could not count MyDocs: #{e.message}"
          0
        end

        total = job_count + corp_count + people_count + email_eml_count + email_attachment_count + task_doc_count + template_count + pricebook_image_count + notes_count + excel_count

        # Fetch task documents with their task associations
        # SSoT: Task documents are CorporateCompanyDocuments linked via SmTaskAttachment
        task_documents = if task_attachment_ids.any?
          CorporateCompanyDocument
            .where(id: task_attachment_ids)
            .includes(:corporate_company, sm_task_attachments: :sm_task)
            .map { |doc| serialize_task_doc(doc) }
        else
          []
        end

        render json: {
          success: true,
          data: {
            job_documents: [],
            corporate_documents: [],
            people_documents: [],
            task_documents: task_documents
          },
          counts: {
            # Primary document scopes
            jobs: job_count,
            corporate: corp_count,
            people: people_count,
            contacts: people_count,  # Alias for people
            # Email scopes
            emails: email_eml_count,
            email_attachments: email_attachment_count,
            attachments: email_attachment_count,  # Legacy alias
            # User scopes (files stored per user in S3)
            users: my_docs_count,  # Total for parent folder
            user_photos: 0,
            user_contracts: 0,
            my_docs: my_docs_count,
            # Warehouse scopes
            warehousing: 0,
            tasks: task_doc_count,
            bill_inbox: 0,
            pricebook_photos: pricebook_image_count,
            pricebook_images: pricebook_image_count,  # Legacy alias
            chat: 0,
            # Templates
            templates: template_count,
            bank_statements: 0,
            contracts: 0,
            # Document creation tools
            notes: notes_count,
            excel_documents: excel_count,
            word_documents: word_count,
            powerpoint_documents: powerpoint_count,
            # System storage
            active_storage: active_storage_count,
            # Total
            total: total
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

      # POST /api/v1/documents
      # Upload a file to the user's document folder in S3
      # Params:
      #   file: The file to upload (multipart)
      #   folder: Optional folder path (default: "MyDocs")
      # SSoT: Paths match StorageConfiguration.SCOPE_FOLDERS (Users/MyDocs, Users/Photos, etc.)
      def create
        unless params[:file].present?
          return render json: { success: false, error: "No file provided" }, status: :bad_request
        end

        file = params[:file]
        # SSoT: Folder names match StorageConfiguration.SCOPE_FOLDERS
        folder = params[:folder].presence || "MyDocs"
        user = current_user

        # Build S3 path: Users/MyDocs/{filename}
        # Note: Files are organized by folder, not by user ID (shared namespace)
        safe_filename = file.original_filename.gsub(/[^\w\.\-]/, "_")
        s3_key = "Users/#{folder}/#{safe_filename}"

        begin
          # Upload to S3
          organization = Organization.first
          provider = DocumentProviders::S3Compatible.for_organization(organization)

          result = provider.upload_file(
            "Users/#{folder}",
            file.read,
            safe_filename,
            content_type: file.content_type,
            overwrite: true
          )

          # For user "My Documents" uploads, we store in S3 but don't create a
          # CorporateCompanyDocument record (which requires company/contact/job/task owner).
          # Files are accessible directly via S3 path: Users/{user_id}/{folder}/{filename}
          render json: {
            success: true,
            document: {
              id: result[:id],
              file_name: file.original_filename,
              display_name: file.original_filename,
              mime_type: file.content_type,
              file_size: file.size,
              folder: folder,
              storage_path: "/#{s3_key}",
              filed_by: user.name || user.email,
              uploaded_at: Time.current.iso8601
            },
            message: "File uploaded successfully"
          }
        rescue StandardError => e
          Rails.logger.error "[Documents] Upload failed: #{e.message}"
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/documents/user_files
      # Lists files in user folder from S3
      # Used by File Warehouse "MyDocs" section
      # SSoT: Paths match StorageConfiguration.SCOPE_FOLDERS
      def user_files
        # SSoT: Folder names match StorageConfiguration.SCOPE_FOLDERS
        # Supports two modes:
        # 1. ?folder=MyDocs (legacy) -> Users/MyDocs
        # 2. ?path=Users/MyDocs (generic) -> exact path
        folder = params[:folder].presence || "MyDocs"
        s3_path = params[:path].presence || "Users/#{folder}"

        begin
          organization = Organization.first
          provider = DocumentProviders::S3Compatible.for_organization(organization)
          # Note: list_folder returns an array directly, not a hash
          items = provider.list_folder(s3_path, recursive: false) || []

          # Filter to files only (exclude folders) and generate presigned download URLs
          files = items.select { |item| item[:type] == :file }.map do |item|
            file_key = item[:key] || item[:name]
            file_name = File.basename(file_key || "")

            # Generate presigned URL for download
            url = if file_key.present?
              provider.presigned_url(file_key, expires_in: 3600) rescue item[:web_url]
            else
              item[:web_url]
            end

            {
              name: file_name,
              path: file_key,
              size: item[:size] || 0,
              content_type: item[:content_type] || MiniMime.lookup_by_filename(file_name)&.content_type || "application/octet-stream",
              last_modified: item[:last_modified]&.iso8601,
              url: url
            }
          end

          render json: {
            success: true,
            files: files,
            folder: folder,
            path: s3_path,
            count: files.size
          }
        rescue StandardError => e
          Rails.logger.error "[Documents] User files list failed for '#{s3_path}': #{e.message}"
          render json: { success: false, error: e.message, files: [], folder: folder, path: s3_path }, status: :ok
        end
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

      # GET /api/v1/documents/:id/download
      # Human-readable download endpoint - redirects to S3 presigned URL
      # URL: /api/v1/documents/123/download → 302 redirect to S3
      def download
        url = generate_download_url(@document)

        unless url.present?
          return render json: { success: false, error: "File not available" }, status: :not_found
        end

        redirect_to url, allow_other_host: true
      end

      # GET /api/v1/documents/:id/preview
      # Universal document preview - returns structured data for Excel/Word/PDF
      # SSoT: Uses DocumentStorageService for all storage providers
      def preview
        # SSoT: Download via DocumentStorageService (handles S3, SharePoint, ActiveStorage)
        service = DocumentStorageService.new
        result = service.download(@document)

        unless result[:success]
          return render json: { success: false, error: result[:error] }, status: result[:status] || :not_found
        end

        file_content = result[:content]

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

      # POST /api/v1/documents/rename
      # Rename a file in S3 storage
      # Params:
      #   path: The current S3 path (e.g., "Tasks/123/Attachments/old-name.pdf")
      #   new_name: The new filename (e.g., "Invoice-2024.pdf")
      #   document_id: Optional - the CorporateCompanyDocument ID to update
      #   source: Optional - the document source type (job, corporate, people, task)
      def rename
        path = params[:path]
        new_name = params[:new_name]

        unless path.present? && new_name.present?
          return render json: { success: false, error: "Missing path or new_name parameter" }, status: :bad_request
        end

        # Sanitize new filename (remove dangerous characters)
        safe_new_name = new_name.gsub(/[<>:"|?*\\\/]/, "_").strip
        if safe_new_name.blank?
          return render json: { success: false, error: "Invalid filename" }, status: :bad_request
        end

        begin
          organization = Organization.first
          provider = DocumentProviders::S3Compatible.for_organization(organization)

          # Rename in S3 (copy + delete)
          result = provider.rename_file(path, safe_new_name)

          # Update database record if document_id provided
          if params[:document_id].present?
            update_document_record(params[:document_id], params[:source], safe_new_name, result[:path])
          else
            # Try to find and update by storage_path
            find_and_update_document_by_path(path, safe_new_name, result[:path])
          end

          render json: {
            success: true,
            message: "File renamed successfully",
            new_name: safe_new_name,
            new_path: result[:path],
            file: result
          }
        rescue DocumentProviders::NotFoundError => e
          render json: { success: false, error: "File not found: #{e.message}" }, status: :not_found
        rescue StandardError => e
          Rails.logger.error "[Documents] Rename failed: #{e.message}"
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end
      end

      private

      # Update document record after S3 rename
      def update_document_record(document_id, source, new_filename, new_path)
        case source
        when "job"
          doc = JobDocument.find_by(id: document_id)
          doc&.update(file_name: new_filename, storage_path: new_path)
        when "corporate", "task"
          doc = CorporateCompanyDocument.find_by(id: document_id)
          doc&.update(file_name: new_filename, storage_path: new_path)
        when "people"
          doc = PeopleDocument.find_by(id: document_id)
          doc&.update(file_name: new_filename, storage_path: new_path)
        end
      end

      # Find document by storage_path and update
      def find_and_update_document_by_path(old_path, new_filename, new_path)
        # Normalize path for comparison (remove leading slash)
        normalized_old = old_path.sub(%r{^/}, "")

        # Try each document type
        [CorporateCompanyDocument, JobDocument, PeopleDocument].each do |klass|
          next unless klass.column_names.include?("storage_path")

          doc = klass.find_by("storage_path = ? OR storage_path = ?", old_path, normalized_old)
          if doc
            doc.update(file_name: new_filename, storage_path: new_path)
            Rails.logger.info "[Documents] Updated #{klass.name}##{doc.id} after rename"
            return
          end
        end
      end

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

      # Serialize task documents (CorporateCompanyDocuments attached to tasks)
      def serialize_task_doc(doc)
        # Get the task this document is attached to
        task_attachment = doc.sm_task_attachments.first
        task = task_attachment&.sm_task

        {
          id: doc.id,
          source: "task",
          fileName: doc.file_name,
          displayName: doc.display_name || doc.file_name,
          mimeType: doc.mime_type || "application/octet-stream",
          fileSize: doc.file_size || 0,
          fileUrl: generate_download_url(doc),
          folderPath: doc.storage_path,
          storageProvider: doc.storage_provider,
          createdAt: doc.created_at&.iso8601,
          # Task info
          taskId: task&.id,
          taskName: task&.name,
          taskNumber: task&.task_number,
          # Job info (if task is part of a job)
          jobId: task&.job_id,
          jobNumber: task&.job&.job_number,
          # Document type
          documentTypeId: doc.document_type_id,
          documentTypeName: doc.document_type_record&.name,
          # Metadata
          isImage: image_file?(doc.file_name)
        }
      end

      def image_file?(filename)
        return false unless filename.present?
        %w[.jpg .jpeg .png .gif .webp .heic .tiff .bmp].any? { |ext| filename.downcase.end_with?(ext) }
      end

      # Generate a download URL for a document
      # SSoT: Delegates to DocumentStorageService for all storage providers
      def generate_download_url(doc)
        return nil unless doc.present?

        service = DocumentStorageService.new
        result = service.download_url(doc)
        result[:success] ? result[:url] : nil
      end
    end
  end
end
