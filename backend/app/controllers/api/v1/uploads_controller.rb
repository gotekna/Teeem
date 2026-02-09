# frozen_string_literal: true

module Api
  module V1
    # UploadsController - THE ONE SSoT for presigned URL uploads
    #
    # All file uploads in the app should use this controller to get presigned URLs
    # for direct browser-to-S3 uploads. This bypasses Heroku's 30-second timeout.
    #
    # Usage:
    #   1. POST /api/v1/uploads/presign - Get presigned URL
    #   2. PUT to presigned URL - Upload file directly to S3
    #   3. POST /api/v1/uploads/confirm - Confirm upload and create record
    #
    # Scopes determine where the file is stored and what record type is created:
    #   - documents: WarehouseDocument (corporate documents)
    #   - user_documents: UserDocument (personal documents)
    #   - job_documents: Job attachments
    #   - task_attachments: SmTaskAttachment (use SmTasksController instead)
    #   - imports: Temporary import files
    #   - chat: Chat message attachments
    #
    class UploadsController < ApplicationController

      # POST /api/v1/uploads/presign
      # Get a presigned URL for direct S3 upload
      #
      # Params:
      #   - filename: Original filename
      #   - content_type: MIME type (optional, will detect from filename)
      #   - scope: Upload scope (documents, user_documents, job_documents, imports, chat)
      #   - metadata: Optional metadata hash (job_id, folder_path, etc.)
      #
      def presign
        filename = params[:filename]
        content_type = params[:content_type] || detect_content_type(filename)
        scope = params[:scope] || "documents"
        metadata = params[:metadata] || {}

        unless filename.present?
          return render json: { success: false, error: "Filename required" }, status: :bad_request
        end

        unless valid_scope?(scope)
          return render json: { success: false, error: "Invalid scope: #{scope}" }, status: :bad_request
        end

        begin
          Rails.logger.info "[UploadsController#presign] Starting presign for scope=#{scope}, filename=#{filename}"
          provider = DocumentProviders::S3Compatible.for_organization(current_organization)
          Rails.logger.info "[UploadsController#presign] Got provider"

          # Build storage path based on scope
          folder_path = build_folder_path(scope, metadata)
          safe_filename = sanitize_filename(filename)
          temp_key = "#{folder_path}/#{Time.current.to_i}_#{SecureRandom.hex(4)}_#{safe_filename}"
          Rails.logger.info "[UploadsController#presign] Built temp_key=#{temp_key}"

          # Get presigned upload URL
          upload_url = provider.presigned_upload_url(
            "",  # folder_path already included in temp_key
            temp_key,
            expires_in: 3600,
            content_type: content_type
          )
          Rails.logger.info "[UploadsController#presign] Got presigned URL"

          render json: {
            success: true,
            upload_url: upload_url,
            key: temp_key,
            filename: filename,
            content_type: content_type,
            scope: scope,
            expires_in: 3600
          }
        rescue DocumentProviders::NotConnectedError => e
          Rails.logger.error "[UploadsController#presign] Not connected: #{e.message}"
          render json: { success: false, error: "Storage not configured: #{e.message}" }, status: :service_unavailable
        rescue => e
          Rails.logger.error "[UploadsController#presign] Failed: #{e.class} - #{e.message}"
          Rails.logger.error e.backtrace.first(5).join("\n")
          # Return actual error message for debugging (internal API)
          render json: { success: false, error: "Failed to generate upload URL: #{e.message}" }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/uploads/confirm
      # Confirm upload and create the appropriate record
      #
      # Params:
      #   - key: S3 key from presign response
      #   - filename: Original filename
      #   - content_type: MIME type
      #   - scope: Upload scope (must match presign scope)
      #   - metadata: Scope-specific metadata (job_id, document_type, etc.)
      #
      def confirm
        key = params[:key]
        filename = params[:filename]
        content_type = params[:content_type] || "application/octet-stream"
        scope = params[:scope] || "documents"
        metadata = params[:metadata] || {}

        unless key.present? && filename.present?
          return render json: { success: false, error: "Key and filename required" }, status: :bad_request
        end

        begin
          provider = DocumentProviders::S3Compatible.for_organization(current_organization)

          # Verify file exists in S3
          file_info = provider.get_file(key)
          file_size = file_info[:size] || 0

          # Create the appropriate record based on scope
          result = create_record_for_scope(scope, key, filename, content_type, file_size, metadata, provider)

          if result[:success]
            render json: result
          else
            render json: { success: false, error: result[:error] }, status: :unprocessable_entity
          end
        rescue DocumentProviders::NotFoundError
          render json: { success: false, error: "File not found in storage. Upload may have failed." }, status: :not_found
        rescue => e
          Rails.logger.error "[UploadsController#confirm] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
          render json: { success: false, error: "Failed to confirm upload: #{e.message}" }, status: :unprocessable_entity
        end
      end

      private

      VALID_SCOPES = %w[documents user_documents job_documents imports chat transactions].freeze

      def valid_scope?(scope)
        VALID_SCOPES.include?(scope)
      end

      # SSoT: Uses WarehouseProvider for base folders (Jan 2026)
      def build_folder_path(scope, metadata)
        storage_config = WarehouseProvider.instance

        case scope
        when "documents"
          "Documents/Uploads"
        when "user_documents"
          "UserDocuments/#{current_user.id}"
        when "job_documents"
          job_id = metadata[:job_id] || metadata["job_id"]
          job = Job.find_by(id: job_id)
          jobs_folder = storage_config&.path_for(:jobs) || "Jobs"
          job ? "#{jobs_folder}/#{job.job_code}/Documents" : "#{jobs_folder}/Uploads"
        when "imports"
          "Imports/#{Time.current.strftime('%Y/%m')}"
        when "chat"
          "Chat/#{Time.current.strftime('%Y/%m')}"
        when "transactions"
          "Transactions/#{Time.current.strftime('%Y/%m')}"
        else
          "Uploads"
        end
      end

      def create_record_for_scope(scope, key, filename, content_type, file_size, metadata, provider)
        case scope
        when "documents"
          create_corporate_document(key, filename, content_type, file_size, metadata, provider)
        when "user_documents"
          create_user_document(key, filename, content_type, file_size, metadata, provider)
        when "job_documents"
          create_job_document(key, filename, content_type, file_size, metadata, provider)
        when "imports"
          # Imports don't create a record - just return the key for processing
          { success: true, key: key, filename: filename, size: file_size }
        when "chat"
          # Chat attachments are handled by ChatMessage creation
          { success: true, key: key, filename: filename, size: file_size }
        when "transactions"
          # Transaction receipts are handled by Transaction update
          { success: true, key: key, filename: filename, size: file_size }
        else
          { success: false, error: "Unknown scope: #{scope}" }
        end
      end

      # SSoT: Uses WarehouseDocument directly
      def create_corporate_document(key, filename, content_type, file_size, metadata, provider)
        # Get company from metadata or current user's default
        company_id = metadata[:company_id] || metadata["company_id"]
        company = company_id ? Corporate.find_by(id: company_id) : current_user.corporates.first
        return { success: false, error: "Company required for corporate documents" } unless company

        # Move to permanent location with content-hash deduplication
        blob = find_or_create_blob(key, filename, content_type, file_size, provider)

        doc = WarehouseDocument.create!(
          source_type: "corporate",
          ui_name: filename,
          original_filename: filename,
          content_type: content_type,
          file_size: file_size,
          storage_blob: blob,
          linkable: company,
          metadata: {
            document_type: metadata[:document_type] || metadata["document_type"] || "other",
            company_code: company.company_code,
            source: "manual",
            uploaded_by_id: current_user&.id
          }
        )

        { success: true, document: { id: doc.id, file_name: doc.ui_name, uiName: doc.ui_name } }
      end

      def create_user_document(key, filename, content_type, file_size, metadata, provider)
        blob = find_or_create_blob(key, filename, content_type, file_size, provider)

        doc = UserDocument.create!(
          file_name: filename,
          storage_blob: blob,
          storage_path: blob.storage_path,
          file_size: file_size,
          content_type: content_type,
          user: current_user,
          category: metadata[:category] || metadata["category"] || "my_docs",
          folder: metadata[:folder] || metadata["folder"]
        )

        { success: true, document: { id: doc.id, file_name: doc.file_name, display_name: doc.ui_name } }
      end

      # SSoT: Uses WarehouseDocument directly
      def create_job_document(key, filename, content_type, file_size, metadata, provider)
        job_id = metadata[:job_id] || metadata["job_id"]
        job = Job.find_by(id: job_id)
        return { success: false, error: "Job not found" } unless job

        blob = find_or_create_blob(key, filename, content_type, file_size, provider)

        doc = WarehouseDocument.create!(
          source_type: "job",
          ui_name: filename,
          original_filename: filename,
          content_type: content_type,
          file_size: file_size,
          storage_blob: blob,
          linkable: job,
          metadata: {
            job_code: job.job_code,
            document_type: metadata[:document_type] || metadata["document_type"],
            storage_provider: "s3_compatible",
            source: "manual"
          }
        )

        { success: true, document: { id: doc.id, file_name: doc.ui_name, uiName: doc.ui_name } }
      end

      def find_or_create_blob(temp_key, filename, content_type, file_size, provider)
        # Download file to compute hash
        content = provider.download_file(temp_key)
        computed_hash = Digest::SHA256.hexdigest(content)

        # Check for existing blob with same hash (deduplication)
        existing_blob = StorageBlob.find_by(content_hash: computed_hash)
        if existing_blob
          # Delete temp file, reuse existing blob
          provider.delete_file(temp_key) rescue nil
          existing_blob.increment_reference!
          return existing_blob
        end

        # Move to permanent Blobs location
        extension = File.extname(filename)
        permanent_key = "Blobs/#{computed_hash[0, 2]}/#{computed_hash}#{extension}"

        provider.native_client.copy_object(
          bucket: provider.instance_variable_get(:@bucket),
          copy_source: "#{provider.instance_variable_get(:@bucket)}/#{temp_key}",
          key: permanent_key
        )
        provider.delete_file(temp_key) rescue nil

        # Create blob record
        blob = StorageBlob.create!(
          content_hash: computed_hash,
          storage_path: permanent_key,
          file_size: file_size,
          content_type: content_type,
          original_filename: filename,
          reference_count: 1
        )

        blob
      end

      def document_to_json(doc)
        {
          id: doc.id,
          file_name: doc.file_name,
          display_name: doc.ui_name || doc.file_name,
          document_type: doc.document_type,
          file_url: doc.file_url,
          file_size: doc.file_size,
          created_at: doc.created_at
        }
      end

      def sanitize_filename(filename)
        filename.to_s.gsub(/[^a-zA-Z0-9._-]/, "_").strip
      end

      # SSoT: ContentTypeDetector (lib/utils/content_type_detector.rb)
      def detect_content_type(filename)
        ContentTypeDetector.detect(filename)
      end
    end
  end
end
