# frozen_string_literal: true

module Api
  module V1
    # UserDocumentsController - CRUD for personal user documents (My Docs)
    #
    # SSoT: UserDocument model with WarehouseDocument for universal metadata
    # Storage: Uses StorageBlob for content-hash deduplication
    # Folder structure: Users/{{UserName}}/{{Folder}} via WarehouseProvider
    class UserDocumentsController < ApplicationController
      before_action :set_document, only: [:show, :update, :destroy, :download, :save_to_job]

      # GET /api/v1/user_documents
      # List current user's documents with folder tree
      def index
        documents = UserDocument.for_user(current_user.id)
                               .my_docs  # Only "my_docs" category
                               .includes(:storage_blob, :warehouse_document)
                               .order(created_at: :desc)

        # Filter by folder
        if params[:folder].present?
          documents = documents.where("folder LIKE ?", "#{params[:folder]}%")
        end

        # Search
        if params[:search].present?
          search_term = "%#{params[:search].downcase}%"
          documents = documents.where("LOWER(file_name) LIKE ?", search_term)
        end

        # Pagination
        limit = (params[:limit] || 100).to_i.clamp(1, 500)
        offset = (params[:offset] || 0).to_i
        total_count = documents.count
        documents = documents.limit(limit).offset(offset)

        # Get unique folders for tree display
        all_folders = UserDocument.for_user(current_user.id)
                                  .my_docs
                                  .where.not(folder: [nil, ""])
                                  .distinct
                                  .pluck(:folder)
                                  .compact
                                  .sort

        # Cache provider for all documents in this request (avoids N+1 provider lookups)
        @document_provider = fetch_document_provider

        render json: {
          success: true,
          documents: documents.map { |doc| document_to_json(doc) },
          folders: build_folder_tree(all_folders),
          pagination: {
            total: total_count,
            limit: limit,
            offset: offset,
            has_more: (offset + limit) < total_count
          }
        }
      end

      # GET /api/v1/user_documents/:id
      def show
        @document_provider = fetch_document_provider

        render json: {
          success: true,
          document: document_to_json(@document)
        }
      end

      # POST /api/v1/user_documents
      # Upload a new document
      def create
        unless params[:file].present?
          return render json: { success: false, error: "No file provided" }, status: :unprocessable_entity
        end

        file = params[:file]
        folder = params[:folder].presence

        # Create StorageBlob for content-hash deduplication
        content = file.read
        blob = StorageBlob.find_or_create_for_content!(
          content,
          filename: file.original_filename,
          content_type: file.content_type
        )

        # Create UserDocument
        document = UserDocument.new(
          user: current_user,
          file_name: file.original_filename,
          file_size: content.bytesize,
          content_type: file.content_type,
          category: "my_docs",
          folder: folder,
          storage_blob: blob,
          storage_provider: WarehouseProvider.instance.storage_provider_for_new_documents
        )

        if document.save
          blob.increment_reference!

          # Create WarehouseDocument for universal metadata
          WarehouseDocument.create!(
            documentable: document,
            source_type: "user",
            display_name: document.file_name,
            original_filename: document.file_name,
            folder: document.virtual_folder_path,
            content_type: document.content_type,
            file_size: document.file_size,
            storage_blob: blob
          )

          @document_provider = fetch_document_provider

          render json: {
            success: true,
            document: document_to_json(document),
            message: "Document uploaded successfully"
          }, status: :created
        else
          render json: {
            success: false,
            errors: document.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/user_documents/:id
      def update
        updates = {}
        updates[:folder] = params[:folder] if params.key?(:folder)
        updates[:file_name] = params[:file_name] if params.key?(:file_name)

        if @document.update(updates)
          # Update WarehouseDocument folder path
          @document.warehouse_document&.update(
            folder: @document.virtual_folder_path,
            display_name: @document.file_name
          )

          @document_provider = fetch_document_provider

          render json: {
            success: true,
            document: document_to_json(@document),
            message: "Document updated successfully"
          }
        else
          render json: {
            success: false,
            errors: @document.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/user_documents/:id
      def destroy
        @document.destroy
        render json: { success: true, message: "Document deleted successfully" }
      end

      # GET /api/v1/user_documents/:id/download
      def download
        unless @document.storage_blob&.storage_path.present?
          return render json: { success: false, error: "File not available" }, status: :not_found
        end

        provider = fetch_document_provider
        unless provider
          return render json: { success: false, error: "Storage provider not configured" }, status: :service_unavailable
        end

        begin
          url = provider.download_url(
            @document.storage_blob.storage_path,
            expires_in: 3600,
            filename: @document.file_name
          )
          render json: { success: true, url: url }
        rescue => e
          Rails.logger.error "[UserDocuments] Failed to generate download URL: #{e.message}"
          render json: { success: false, error: "Failed to generate download URL" }, status: :service_unavailable
        end
      end

      # POST /api/v1/user_documents/:id/save_to_job
      # Link document to a job (same file, new reference - SSoT deduplication)
      def save_to_job
        job_id = params[:job_id]
        unless job_id.present?
          return render json: { success: false, error: "Job ID required" }, status: :unprocessable_entity
        end

        job = Job.find_by(id: job_id)
        unless job
          return render json: { success: false, error: "Job not found" }, status: :not_found
        end

        # SSoT (Jan 2026): Create WarehouseDocument directly (no legacy JobDocument)
        # Same StorageBlob = deduplication (same file, new reference)
        folder_path = params[:folder_path].presence || "From My Docs"

        warehouse_doc = WarehouseDocument.new(
          source_type: "job",
          linkable: job,
          display_name: @document.file_name,
          original_filename: @document.file_name,
          folder: folder_path,
          content_type: @document.content_type,
          file_size: @document.file_size,
          storage_blob: @document.storage_blob,
          metadata: {
            job_code: job.job_code,
            storage_provider: @document.storage_provider,
            source: "linked_from_my_docs"
          }
        )

        if warehouse_doc.save
          # Increment blob reference count (same file, new reference)
          @document.storage_blob&.increment_reference!

          render json: {
            success: true,
            message: "Document linked to job #{job.job_code}",
            job_document_id: warehouse_doc.id
          }
        else
          render json: {
            success: false,
            errors: warehouse_doc.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/user_documents/create_folder
      # Create a virtual folder (no physical storage - just updates folder path)
      def create_folder
        folder_name = params[:name]
        parent_folder = params[:parent]

        unless folder_name.present?
          return render json: { success: false, error: "Folder name required" }, status: :unprocessable_entity
        end

        # Sanitize folder name
        sanitized_name = folder_name.gsub(/[<>:"|?*\\\/]/, "-").strip
        full_path = parent_folder.present? ? "#{parent_folder}/#{sanitized_name}" : sanitized_name

        # Check for existing documents with this folder
        existing_count = UserDocument.for_user(current_user.id)
                                     .my_docs
                                     .where(folder: full_path)
                                     .count

        render json: {
          success: true,
          folder: {
            name: sanitized_name,
            path: full_path,
            documentCount: existing_count
          },
          message: "Folder created successfully"
        }
      end

      private

      def set_document
        @document = UserDocument.for_user(current_user.id).find_by(id: params[:id])
        unless @document
          render json: { success: false, error: "Document not found" }, status: :not_found
        end
      end

      # Fetch document provider with defensive error handling
      # Returns nil if storage is not configured, avoiding exceptions in document listing
      def fetch_document_provider
        return nil unless current_tenant

        DocumentProviders.for_tenant(current_tenant)
      rescue DocumentProviders::NotConnectedError => e
        Rails.logger.warn "[UserDocuments] Storage not connected: #{e.message}"
        nil
      rescue TenantNotFoundError => e
        Rails.logger.warn "[UserDocuments] Tenant not found: #{e.message}"
        nil
      rescue => e
        Rails.logger.error "[UserDocuments] Failed to get document provider: #{e.class} - #{e.message}"
        nil
      end

      def document_to_json(doc)
        blob = doc.storage_blob
        download_url = nil

        if blob&.storage_path.present? && @document_provider
          begin
            download_url = @document_provider.download_url(blob.storage_path, expires_in: 3600, filename: doc.file_name)
          rescue => e
            Rails.logger.warn "[UserDocuments] Failed to get download URL for doc #{doc.id}: #{e.message}"
          end
        end

        {
          id: doc.id,
          fileName: doc.file_name,
          displayName: doc.file_name,
          folder: doc.folder,
          virtualPath: doc.virtual_folder_path,
          mimeType: doc.content_type,
          fileSize: doc.file_size,
          fileUrl: download_url,
          storageBlobId: blob&.id,
          createdAt: doc.created_at&.iso8601,
          updatedAt: doc.updated_at&.iso8601,
          isImage: image_file?(doc.file_name)
        }
      end

      def image_file?(filename)
        return false unless filename
        %w[.jpg .jpeg .png .gif .webp .svg .bmp .tiff].include?(File.extname(filename).downcase)
      end

      def build_folder_tree(folders)
        tree = {}

        folders.each do |folder_path|
          parts = folder_path.split("/")
          current = tree

          parts.each_with_index do |part, index|
            current[part] ||= { children: {} }
            current = current[part][:children] if index < parts.length - 1
          end
        end

        # Convert to array format
        hash_to_tree_array(tree, "")
      end

      def hash_to_tree_array(hash, parent_path)
        hash.map do |name, data|
          full_path = parent_path.empty? ? name : "#{parent_path}/#{name}"
          {
            name: name,
            path: full_path,
            children: data[:children].any? ? hash_to_tree_array(data[:children], full_path) : []
          }
        end
      end
    end
  end
end
