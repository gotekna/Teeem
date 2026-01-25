# frozen_string_literal: true

module Api
  module V1
    class DocumentsController < ApplicationController
      before_action :set_document, only: [ :show, :update, :destroy, :download, :preview, :move ]

      # GET /api/v1/documents/all
      # Returns file counts for the entire warehouse (fast)
      # Used by the File Warehouse page
      # SSoT: Counts ALL file types - documents, emails, attachments, tasks
      # NOTE: Scope keys match StorageConfiguration.SCOPE_FOLDERS for consistency
      #
      # Phase 3: Now uses WarehouseDocument as SSoT for migrated documents
      def all
        # Phase 3: WarehouseDocument counts by source_type (SSoT for migrated docs)
        warehouse_counts = WarehouseDocument.group(:source_type).count
        warehouse_total = WarehouseDocument.count

        # Legacy counts (for documents not yet migrated or for comparison)
        job_count = warehouse_counts["job"] || JobDocument.where.not(file_name: [nil, ""]).count
        corp_count = warehouse_counts["corporate"] || CorporateCompanyDocument.where.not(file_name: [nil, ""]).count
        people_count = warehouse_counts["people"] || PeopleDocument.where.not(title: [nil, ""]).count

        # Email counts - use warehouse_document counts (source_type: "email" covers both)
        email_total = warehouse_counts["email"] || 0
        # Split between EML files and attachments based on documentable_type
        email_eml_count = WarehouseDocument.where(source_type: "email", documentable_type: "SyncedEmail").count
        email_attachment_count = WarehouseDocument.where(source_type: "email", documentable_type: "EmailAttachment").count
        # Fallback to legacy counts if no warehouse documents
        email_eml_count = SyncedEmail.where.not(storage_email_path: [nil, ""]).count if email_eml_count == 0
        email_attachment_count = EmailAttachment.where.not(storage_path: [nil, ""]).count if email_attachment_count == 0

        # Task attachment counts - documents uploaded against task IDs
        # These are CorporateCompanyDocuments linked via SmTaskAttachment
        task_attachment_ids = SmTaskAttachment.where(attachable_type: 'CorporateCompanyDocument').distinct.pluck(:attachable_id) rescue []
        task_doc_count = task_attachment_ids.size

        # Document templates (Word/Excel templates stored in storage)
        template_count = DocumentTemplate.where.not(storage_path: [nil, ""]).count rescue 0

        # Pricebook images (product photos)
        pricebook_image_count = PricebookItem.where.not(image_file_id: nil).count rescue 0

        # Active Storage REMOVED (Jan 2026) - SSoT is now StorageBlob
        active_storage_count = 0  # Legacy field for API compatibility

        # Notes attachments (notebook page files)
        notes_count = NotebookPageAttachment.count rescue 0

        # Excel spreadsheets (TeeemXL)
        excel_count = TeeemSpreadsheet.count rescue 0

        # Word documents (TeeemWord)
        word_count = TeeemDocument.count rescue 0

        # PowerPoint presentations (TeeemPowerPoint)
        powerpoint_count = TeeemPresentation.count rescue 0

        # PDF documents (TeeemPdf)
        pdf_count = TeeemPdf.count rescue 0

        # Warehouse total (all Teeem document types stored in S3/Warehouse)
        warehousing_count = excel_count + word_count + powerpoint_count + pdf_count + notes_count

        # User files from S3 (MyDocs folder)
        # SSoT: Path matches StorageConfiguration.SCOPE_FOLDERS["my_docs"] = "Users/MyDocs"
        # Note: list_folder returns an array of items directly, not a hash
        my_docs_count = begin
          # SSoT (Jan 2026): Use tenant for storage provider
          provider = DocumentProviders.for_tenant(current_tenant)
          items = provider.list_folder("Users/MyDocs", recursive: false) rescue []
          # Count only files (items with :type == :file), not folders
          items.is_a?(Array) ? items.count { |item| item[:type] == :file } : 0
        rescue => e
          Rails.logger.warn "[Documents] Could not count MyDocs: #{e.message}"
          0
        end

        total = job_count + corp_count + people_count + email_eml_count + email_attachment_count + task_doc_count + template_count + pricebook_image_count + notes_count + excel_count + word_count + powerpoint_count + pdf_count

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
            warehousing: warehousing_count,
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
            pdf_documents: pdf_count,
            # System storage
            active_storage: active_storage_count,
            # Phase 3: Warehouse document counts (SSoT)
            warehouse_total: warehouse_total,
            warehouse_by_source: warehouse_counts,
            # Total
            total: total
          }
        }
      end

      # GET /api/v1/documents/warehouse
      # Phase 3: Unified endpoint for ALL warehouse documents
      # SSoT: Queries WarehouseDocument table (universal metadata)
      # Params:
      #   source_type: Filter by source (corporate, job, email, people, contact)
      #   folder: Filter by virtual folder path
      #   search: Full-text search on display_name
      #   documentable_type: Filter by underlying model (SyncedEmail, EmailAttachment, etc.)
      #   limit: Max results (default: 100)
      #   offset: Pagination offset
      def warehouse
        documents = WarehouseDocument.includes(:documentable, :storage_blob)
                                     .order(created_at: :desc)

        # Filter by source_type
        if params[:source_type].present?
          documents = documents.where(source_type: params[:source_type])
        end

        # Filter by documentable_type
        if params[:documentable_type].present?
          documents = documents.where(documentable_type: params[:documentable_type])
        end

        # Filter by folder
        if params[:folder].present?
          documents = documents.where("folder LIKE ?", "#{params[:folder]}%")
        end

        # Full-text search on display_name
        if params[:search].present?
          search_term = "%#{params[:search].downcase}%"
          documents = documents.where("LOWER(display_name) LIKE ? OR LOWER(original_filename) LIKE ?", search_term, search_term)
        end

        # Pagination
        limit = (params[:limit] || 100).to_i.clamp(1, 500)
        offset = (params[:offset] || 0).to_i
        total_count = documents.count
        documents = documents.limit(limit).offset(offset)

        # Get folder counts for this query
        folder_counts = WarehouseDocument.where(source_type: params[:source_type])
                                         .where.not(folder: [nil, ""])
                                         .group(:folder)
                                         .count

        render json: {
          success: true,
          documents: documents.map { |doc| warehouse_document_to_json(doc) },
          folders: folder_counts.keys.sort.map { |f| { name: f, count: folder_counts[f] } },
          pagination: {
            total: total_count,
            limit: limit,
            offset: offset,
            has_more: (offset + limit) < total_count
          }
        }
      end

      # GET /api/v1/documents/live_folder_tree
      # Phase 5: Universal Live Folder Tree - computed from DB relationships
      # Returns folder tree computed LIVE from source tables (SSoT)
      #
      # Key insight: The folder structure IS the document metadata relationships.
      # We don't store folder paths - we compute them from existing DB relationships.
      #
      # Benefits:
      # - Instant template changes (no migration needed)
      # - Always accurate (reads from SSoT)
      # - Single GROUP BY query per folder level (fast)
      #
      # Params:
      #   scope: The scope to query (email, corporate, job, contact, people, task)
      #   path: Optional path to drill down (e.g., "inbox@tekna.com.au/2025/01")
      #
      # Returns:
      #   folders: Array of { name, path, count } for subfolders
      #   files: Array of file objects at this level (only at leaf level)
      #   template: The template used for this scope
      def live_folder_tree
        scope = params[:scope].to_s.downcase
        path = params[:path].to_s.strip.gsub(%r{^/+|/+$}, "")
        path_segments = path.present? ? path.split("/") : []

        # Get template from StorageConfiguration
        config = StorageConfiguration.instance
        template = config.template_for(scope) rescue nil

        # Build live folder tree based on scope
        result = build_live_folder_tree(scope, path_segments)

        render json: {
          success: true,
          scope: scope,
          path: path,
          template: template,
          folders: result[:folders],
          files: result[:files] || [],
          count: {
            folders: result[:folders].size,
            files: (result[:files] || []).size,
            total: result[:folders].size + (result[:files] || []).size
          }
        }
      rescue StandardError => e
        Rails.logger.error "[Documents] live_folder_tree failed for scope=#{scope}, path=#{path}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
        render json: {
          success: false,
          error: e.message,
          scope: scope,
          path: path,
          folders: [],
          files: []
        }, status: :ok
      end

      # GET /api/v1/documents/virtual_tree
      # Phase 4: Virtual File Warehouse - Database-driven folder tree
      # Returns folder tree from WarehouseDocument.folder instead of S3
      #
      # When a scope is marked as virtual in StorageConfiguration:
      # - Folder tree renders from database (instant)
      # - Reorganization is instant (bulk DB update)
      # - Physical storage stays at Blobs/{hash}.ext (never moves)
      #
      # Params:
      #   scope: The scope to query (email, email_attachments, task, etc.)
      #   path: Optional base path to filter (e.g., "robert@tekna.com.au/Email Body/2025")
      #   search: Optional search term for display_name
      #
      # Returns:
      #   folders: Array of { name, path, count } for subfolders
      #   files: Array of warehouse_document_to_json for files at this level
      #   count: { folders, files, total }
      def virtual_tree
        scope = params[:scope].to_s
        base_path = params[:path].to_s.strip.gsub(%r{^/+|/+$}, "")

        # Verify scope is virtual (configured in admin UI)
        config = StorageConfiguration.instance
        unless config.virtual_scope?(scope)
          return render json: {
            success: false,
            error: "Scope '#{scope}' is not configured as virtual",
            path: base_path,
            folders: [],
            files: []
          }, status: :bad_request
        end

        # Query WarehouseDocument by source_type
        documents = WarehouseDocument.where(source_type: scope)
                                     .includes(:documentable, :storage_blob)

        # Filter by base path if provided
        if base_path.present?
          documents = documents.where("folder LIKE ?", "#{base_path}%")
        end

        # Search filter
        if params[:search].present?
          search_term = "%#{params[:search].downcase}%"
          documents = documents.where("LOWER(display_name) LIKE ? OR LOWER(original_filename) LIKE ?", search_term, search_term)
        end

        # Build folder tree from unique folder paths
        folder_tree = build_virtual_folder_tree(documents, base_path)

        # Get files at EXACTLY this level (folder matches base_path exactly)
        files_at_level = if base_path.present?
          documents.where(folder: base_path).limit(500)
        else
          documents.where(folder: [nil, ""]).limit(500)
        end

        render json: {
          success: true,
          path: base_path,
          scope: scope,
          folders: folder_tree[:folders],
          files: files_at_level.map { |doc| warehouse_document_to_json(doc) },
          count: {
            folders: folder_tree[:folders].size,
            files: files_at_level.size,
            total: folder_tree[:folders].size + files_at_level.size
          }
        }
      rescue StandardError => e
        Rails.logger.error "[Documents] virtual_tree failed for scope=#{scope}, path=#{base_path}: #{e.message}"
        render json: {
          success: false,
          error: e.message,
          path: base_path,
          folders: [],
          files: []
        }, status: :ok
      end

      # GET /api/v1/documents
      # Returns documents with folder structure for the documents page
      # Params:
      #   search: Full-text search query (uses PostgreSQL tsvector + GIN index)
      #   folder: Filter by folder path
      #   limit: Max results (default: 100)
      #   sources: Comma-separated source types to search (default: "corporate")
      #            Options: corporate, user, job, contact, task
      def index
        limit = (params[:limit] || 100).to_i
        search_term = params[:search].presence
        sources = (params[:sources] || "corporate").split(",").map(&:strip)

        results = []

        # Corporate docs (existing behavior)
        if sources.include?("corporate")
          results += search_corporate_documents(search_term, limit)
        end

        # User's personal docs
        if sources.include?("user")
          results += search_user_documents(search_term, limit)
        end

        # Warehouse documents (job, contact, task - non-email sources)
        warehouse_sources = sources & %w[job contact task]
        if warehouse_sources.any?
          results += search_warehouse_documents(search_term, warehouse_sources, limit)
        end

        # Sort merged results by created_at desc and limit
        results = results.sort_by { |r| r[:uploaded_at] || "" }.reverse.first(limit)

        # Only include folders for corporate-only queries (backward compatibility)
        folders = if sources == ["corporate"]
          folder_counts = CorporateCompanyDocument.where.not(folder: [ nil, "" ])
                                                  .group(:folder)
                                                  .count
          folder_counts.keys.sort.map.with_index do |folder_name, index|
            {
              id: (index + 1).to_s,
              name: folder_name.titleize,
              path: "/#{folder_name.downcase}",
              documents_count: folder_counts[folder_name]
            }
          end
        else
          []
        end

        render json: {
          success: true,
          documents: results,
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
          # SSoT (Jan 2026): Use tenant for storage provider
          provider = DocumentProviders.for_tenant(current_tenant)

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
        # 3. ?recursive=true -> list all files in subfolders (for Warehousing folders)
        folder = params[:folder].presence || "MyDocs"
        s3_path = params[:path].presence || "Users/#{folder}"
        recursive = params[:recursive] == "true"

        begin
          # SSoT (Jan 2026): Use tenant for storage provider
          provider = DocumentProviders.for_tenant(current_tenant)
          # Note: list_folder returns an array directly, not a hash
          # Use recursive for warehouse folders (files nested in user/year subfolders)
          items = provider.list_folder(s3_path, recursive: recursive) || []

          # Filter to files only (exclude folders) and generate presigned download URLs
          files = items.select { |item| item[:type] == :file }.map do |item|
            # Get full S3 key path (stored in :id by S3 provider)
            file_key = item[:id] || item[:key] || item[:name]
            file_name = File.basename(file_key || "")

            # Generate presigned URL for download
            # SSoT: Method is download_url (not presigned_url) on all document providers
            url = if file_key.present?
              provider.download_url(file_key, expires_in: 3600) rescue item[:web_url]
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

      # GET /api/v1/documents/s3_folders
      # SSoT: OneDrive-like folder browser - lists actual S3 folders and files
      # This mirrors the exact Wasabi folder structure for the Documents page
      # Used for desktop sync compatibility - must match actual storage structure
      #
      # Params:
      #   path: The S3 path to list (e.g., "Jobs", "Jobs/J49", "Corporate/Group A")
      #         Empty/nil returns root folders from StorageConfiguration.SCOPE_FOLDERS
      #
      # Returns:
      #   folders: Array of { name, path } for subfolders
      #   files: Array of { name, path, size, url, content_type } for files
      def s3_folders
        path = params[:path].to_s.strip
        path = path.gsub(%r{^/+|/+$}, "") # Remove leading/trailing slashes

        begin
          # Phase 3: After StorageBlob migration, all browsing uses virtual folders
          # Actual S3 only has Blobs/ folder (content-addressed storage)
          # All user-facing folders are virtual (stored in warehouse_documents.folder column)
          render_virtual_folders(path)
        rescue StandardError => e
          Rails.logger.error "[Documents] Virtual folder list failed for '#{path}': #{e.message}"
          render json: {
            success: false,
            error: e.message,
            path: path,
            folders: [],
            files: [],
            count: { folders: 0, files: 0, total: 0 }
          }, status: :ok
        end
      end

      # Phase 3: Render virtual folders from WarehouseDocument computed paths
      # SSoT: Uses computed_folder_path (not stored folder column) for dynamic folder structure
      # This enables instant reorganization when templates change in Entity Config - no migration needed
      #
      # @param path [String] The folder path to list (e.g., "" for root, "Contacts", "Contacts/Acme")
      def render_virtual_folders(path = "")
        path = path.to_s.strip.gsub(%r{^/+|/+$}, "")

        # Cache the full folder tree for 1 hour (invalidated by template changes)
        # Pre-warm with: rails warehouse:warmup_cache
        cache_key = "warehouse_folder_tree_v2"

        # Check if tree is already cached
        folder_tree = Rails.cache.read(cache_key)

        if folder_tree.nil?
          # Cache not built - return message telling user to wait
          # Admin should run: heroku run rails warehouse:warmup_cache
          return render json: {
            success: true,
            loading: true,
            message: "Folder index is being built. Please refresh in a minute.",
            path: path,
            folders: [],
            files: [],
            count: { folders: 0, files: 0, total: 0 }
          }
        end

        if path.blank?
          # Root level: return top-level folders with counts
          folders = folder_tree[:root_folders].map do |name, count|
            { name: name, path: name, count: count }
          end.sort_by { |f| f[:name].downcase }

          files = []
        else
          # Subfolder: compute subfolders and files at this path
          path_depth = path.count("/") + 1
          subfolder_counts = Hash.new(0)
          file_ids_at_path = []

          folder_tree[:paths].each do |doc_id, computed_path|
            next if computed_path.blank?
            next unless computed_path.start_with?(path)

            # Check if exact match or starts with path/
            remaining = computed_path[path.length..]
            next unless remaining.blank? || remaining.start_with?("/")

            folder_parts = computed_path.split("/")

            if folder_parts.length > path_depth
              # Has subfolders - count the immediate subfolder
              subfolder_name = folder_parts[path_depth]
              subfolder_counts[subfolder_name] += 1
            elsif computed_path == path
              # File at this exact path
              file_ids_at_path << doc_id
            end
          end

          folders = subfolder_counts.map do |name, count|
            { name: name, path: "#{path}/#{name}", count: count }
          end.sort_by { |f| f[:name].downcase }

          # Fetch full document records for files at this path
          files = if file_ids_at_path.any?
            WarehouseDocument.where(id: file_ids_at_path).includes(:storage_blob).map do |doc|
              blob = doc.storage_blob
              url = doc.download_url rescue nil

              {
                name: doc.display_name || doc.original_filename || "Document #{doc.id}",
                path: blob&.storage_path,
                size: doc.file_size || blob&.file_size || 0,
                content_type: doc.content_type || blob&.content_type || "application/octet-stream",
                last_modified: doc.updated_at&.iso8601,
                url: url,
                id: doc.id,
                warehouse_document_id: doc.id
              }
            end.sort_by { |f| f[:name].to_s.downcase }
          else
            []
          end
        end

        render json: {
          success: true,
          path: path,
          folders: folders,
          files: files,
          count: {
            folders: folders.size,
            files: files.size,
            total: folders.size + files.size
          }
        }
      end

      # Build a complete folder tree by computing paths for all warehouse documents
      # This is cached to avoid O(n) computation on every request
      # Called by: rails warehouse:warmup_cache
      #
      # @return [Hash] { root_folders: { name => count }, paths: { doc_id => computed_path } }
      def self.build_folder_tree
        tree = { root_folders: Hash.new(0), paths: {} }

        # Use find_each for memory efficiency with large datasets
        WarehouseDocument.includes(:documentable).find_each(batch_size: 1000) do |doc|
          computed_path = doc.computed_folder_path rescue nil
          next if computed_path.blank?

          # Store the computed path for this document
          tree[:paths][doc.id] = computed_path

          # Count root folders
          root = computed_path.split("/").first
          tree[:root_folders][root] += 1
        end

        # Convert root_folders to regular hash (Hash.new(0) doesn't serialize well)
        tree[:root_folders] = tree[:root_folders].to_h

        tree
      end

      # GET /api/v1/documents/folder_files
      # SSoT: Unified endpoint for fetching files from EntityTab folders
      # Used by File Warehouse to display subfolder contents for ALL scopes
      # Supports: job, corporate/corporate_entity/corp, contact/people
      def folder_files
        entity_tab_id = params[:entity_tab_id]
        scope = params[:scope] || "corporate"

        unless entity_tab_id.present?
          return render json: { success: false, error: "entity_tab_id required", files: [] }, status: :bad_request
        end

        entity_tab = EntityTab.find_by(id: entity_tab_id)
        unless entity_tab
          return render json: { success: false, error: "EntityTab not found", files: [] }, status: :not_found
        end

        # SSoT: Route to correct document model based on scope
        files = case scope.to_s.downcase
                when "job"
                  fetch_job_documents(entity_tab)
                when "corporate", "corporate_entity", "corp"
                  fetch_corporate_documents(entity_tab)
                when "contact", "people"
                  fetch_people_documents(entity_tab)
                else
                  []
                end

        render json: {
          success: true,
          files: files,
          folder: entity_tab.display_name,
          scope: scope,
          count: files.size
        }
      end

      # Backwards compatibility alias
      alias_method :corporate_folder_files, :folder_files

      # GET /api/v1/documents/warehouse_files
      # SSoT: List warehouse documents (TeeemSpreadsheet, TeeemDocument, TeeemPresentation, TeeemPdf)
      # Used by File Warehouse to display warehouse document subfolders
      def warehouse_files
        doc_type = params[:type] || "all"

        files = case doc_type.to_s.downcase
                when "excel", "spreadsheet"
                  fetch_warehouse_spreadsheets
                when "word", "document"
                  fetch_warehouse_documents
                when "powerpoint", "presentation"
                  fetch_warehouse_presentations
                when "pdf"
                  fetch_warehouse_pdfs
                else
                  fetch_warehouse_spreadsheets + fetch_warehouse_documents + fetch_warehouse_presentations + fetch_warehouse_pdfs
                end

        render json: {
          success: true,
          files: files,
          type: doc_type,
          count: files.size
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

      # GET /api/v1/documents/:id/download
      # Human-readable download endpoint
      #
      # Modes:
      # - Default: 302 redirect to S3 presigned URL (fastest for large files)
      # - preview=true: Stream content directly with proper headers (required for <img> tags)
      #
      # Why streaming for preview?
      # Browser security (ORB - Opaque Response Blocking) blocks cross-origin redirects
      # when loading images via <img src="...">. Streaming the content directly from
      # our domain with proper Content-Type headers avoids this issue.
      #
      # URL: /api/v1/documents/123/download → 302 redirect to S3
      # URL: /api/v1/documents/123/download?preview=true → 200 with binary content
      def download
        # For preview mode (images in <img> tags), stream content directly to avoid ORB
        if params[:preview].present?
          service = DocumentStorageService.new
          result = service.download(@document)

          unless result[:success]
            return render json: { success: false, error: result[:error] || "File not available" }, status: result[:status] || :not_found
          end

          # Determine content type from file extension or stored mime type
          content_type = @document.respond_to?(:content_type) && @document.content_type.present? ?
            @document.content_type :
            Mime::Type.lookup_by_extension(File.extname(@document.file_name.to_s).delete(".")).to_s.presence || "application/octet-stream"

          # Stream with proper headers for browser image rendering
          send_data result[:content],
            type: content_type,
            disposition: "inline",
            filename: @document.file_name
          return
        end

        # Default: redirect to presigned URL (faster for large files/downloads)
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

      # GET /api/v1/documents/scope_hierarchy
      # SSoT: Returns folder hierarchy for a scope that matches StorageConfiguration.SCOPE_TEMPLATES
      # Used by File Warehouse to build tree structure that mirrors storage paths
      # Example: scope=corporate → CompanyGroup/CompanyCode/TabName hierarchy
      def scope_hierarchy
        scope = params[:scope]&.to_s || "corporate"
        config = StorageConfiguration.instance
        template = config.template_for(scope)

        hierarchy = build_hierarchy_for_scope(scope, template)

        render json: {
          success: true,
          scope: scope,
          template: template,
          hierarchy: hierarchy
        }
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
          # SSoT (Jan 2026): Use tenant for storage provider
          provider = DocumentProviders.for_tenant(current_tenant)

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

      # PATCH /api/v1/documents/:id/move
      # Move a document to a different folder (virtual - DB only, no S3 move needed)
      # SSoT: Blob architecture uses virtual folders, files stay in Blobs/
      def move
        new_folder_path = params[:folder_path]

        unless new_folder_path.present?
          return render json: { success: false, error: "Missing folder_path parameter" }, status: :bad_request
        end

        begin
          @document.update!(folder: new_folder_path)

          render json: {
            success: true,
            message: "Document moved successfully",
            document: document_to_json(@document)
          }
        rescue ActiveRecord::RecordInvalid => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error "[Documents] Move failed: #{e.message}"
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end
      end

      private

      # ========================================
      # Multi-Source Search Helpers (AttachmentPicker)
      # ========================================

      # Search corporate documents (CorporateCompanyDocument)
      def search_corporate_documents(search_term, limit)
        scope = CorporateCompanyDocument.includes(:corporate_company, :user, :document_type_record)
                                        .order(created_at: :desc)
                                        .limit(limit)

        scope = scope.search_text(search_term) if search_term.present?

        scope.map do |doc|
          {
            id: doc.id,
            name: doc.file_name,
            display_title: doc.display_name || doc.file_name,
            source_type: "corporate",
            document_type: doc.document_type_record ? {
              id: doc.document_type_record.id,
              name: doc.document_type_record.name,
              abbreviation: doc.document_type_record.abbreviation || doc.document_type_record.name[0..2].upcase
            } : nil,
            url: doc.storage_url || doc.file_url,
            file_url: doc.storage_url || doc.file_url,
            uploaded_at: doc.created_at&.iso8601
          }
        end
      end

      # Search user's personal documents (UserDocument)
      def search_user_documents(search_term, limit)
        scope = UserDocument.where(user: current_user)
                           .order(created_at: :desc)
                           .limit(limit)

        if search_term.present?
          search_pattern = "%#{search_term.downcase}%"
          scope = scope.where("LOWER(file_name) LIKE ?", search_pattern)
        end

        scope.map do |doc|
          {
            id: doc.id,
            name: doc.file_name,
            display_title: doc.display_name || doc.file_name,
            source_type: "user",
            document_type: nil,
            url: doc.file_url,
            file_url: doc.file_url,
            uploaded_at: doc.created_at&.iso8601
          }
        end
      end

      # Search warehouse documents (job, contact, task - excludes email)
      def search_warehouse_documents(search_term, source_types, limit)
        scope = WarehouseDocument.includes(:storage_blob)
                                 .where(source_type: source_types)
                                 .order(created_at: :desc)
                                 .limit(limit)

        if search_term.present?
          search_pattern = "%#{search_term.downcase}%"
          scope = scope.where("LOWER(display_name) LIKE ? OR LOWER(original_filename) LIKE ?",
                             search_pattern, search_pattern)
        end

        # SSoT (Jan 2026): Use tenant for storage provider
        provider = DocumentProviders.for_tenant(current_tenant) rescue nil

        scope.map do |wd|
          blob = wd.storage_blob
          download_url = if blob&.storage_path.present? && provider
            provider.download_url(blob.storage_path, expires_in: 3600, filename: wd.download_filename) rescue nil
          end

          {
            id: wd.id,
            name: wd.original_filename || wd.display_name,
            display_title: wd.display_name,
            source_type: wd.source_type,
            document_type: nil,
            url: download_url,
            file_url: download_url,
            uploaded_at: wd.created_at&.iso8601
          }
        end
      end

      # Phase 5: Build live folder tree from DB relationships (SSoT)
      # Computes folder structure from source tables instead of stored paths
      #
      # @param scope [String] The document scope (email, corporate, job, contact, people, task)
      # @param path_segments [Array<String>] Path segments to drill down
      # @return [Hash] { folders: [{ name, path, count }...], files: [...] }
      def build_live_folder_tree(scope, path_segments)
        case scope
        when "email", "emails"
          build_email_live_tree(path_segments)
        when "corporate", "corporate_entity", "corp"
          build_corporate_live_tree(path_segments)
        when "job", "jobs"
          build_job_live_tree(path_segments)
        when "contact", "contacts"
          build_contact_live_tree(path_segments)
        when "people"
          build_people_live_tree(path_segments)
        when "task", "tasks"
          build_task_live_tree(path_segments)
        else
          { folders: [], files: [] }
        end
      end

      # Email structure: {{Mailbox}}/{{Year}}/Email Body|Attachments/{{Month}}/files
      # Level 0: Mailboxes
      # Level 1: Years
      # Level 2: "Email Body" and "Attachments" folders
      # Level 3: Months
      # Level 4: Files
      def build_email_live_tree(path_segments)
        depth = path_segments.size

        case depth
        when 0
          # Root: Show unique mailboxes
          mailboxes = SyncedEmail.where.not(mailbox_owner_email: [nil, ""])
                                 .group(:mailbox_owner_email)
                                 .count

          folders = mailboxes.map do |email, count|
            { name: email, path: email, count: count }
          end.sort_by { |f| f[:name].to_s.downcase }

          { folders: folders, files: [] }

        when 1
          # Level 1: Mailbox selected, show years
          mailbox = path_segments[0]

          years = SyncedEmail.where(mailbox_owner_email: mailbox)
                             .where.not(received_at: nil)
                             .group("EXTRACT(YEAR FROM received_at)::INTEGER")
                             .count

          folders = years.map do |year, count|
            year_str = year.to_i.to_s
            { name: year_str, path: "#{mailbox}/#{year_str}", count: count }
          end.sort_by { |f| -f[:name].to_i }  # Newest first

          { folders: folders, files: [] }

        when 2
          # Level 2: Year selected, show "Email Body" and "Attachments" folders
          mailbox = path_segments[0]
          year = path_segments[1].to_i

          email_count = SyncedEmail.where(mailbox_owner_email: mailbox)
                                   .where("EXTRACT(YEAR FROM received_at) = ?", year)
                                   .count

          # Count attachments from synced_email_attachments
          attachment_count = SyncedEmailAttachment.joins(:synced_email)
                                                  .where(synced_emails: { mailbox_owner_email: mailbox })
                                                  .where("EXTRACT(YEAR FROM synced_emails.received_at) = ?", year)
                                                  .count

          folders = [
            { name: "Email Body", path: "#{mailbox}/#{year}/Email Body", count: email_count },
            { name: "Attachments", path: "#{mailbox}/#{year}/Attachments", count: attachment_count }
          ]

          { folders: folders, files: [] }

        when 3
          # Level 3: Show months for selected year and folder type
          mailbox = path_segments[0]
          year = path_segments[1].to_i
          folder_type = path_segments[2]  # "Email Body" or "Attachments"

          if folder_type == "Attachments"
            # Count attachments by month
            months = SyncedEmailAttachment.joins(:synced_email)
                                          .where(synced_emails: { mailbox_owner_email: mailbox })
                                          .where("EXTRACT(YEAR FROM synced_emails.received_at) = ?", year)
                                          .group("EXTRACT(MONTH FROM synced_emails.received_at)::INTEGER")
                                          .count
          else
            # Count emails by month
            months = SyncedEmail.where(mailbox_owner_email: mailbox)
                                .where("EXTRACT(YEAR FROM received_at) = ?", year)
                                .group("EXTRACT(MONTH FROM received_at)::INTEGER")
                                .count
          end

          month_names = %w[Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec]
          folders = months.map do |month, count|
            month_name = month_names[month.to_i - 1] || month.to_s.rjust(2, "0")
            month_str = month.to_s.rjust(2, "0")
            { name: "#{month_str} - #{month_name}", path: "#{mailbox}/#{year}/#{folder_type}/#{month_str}", count: count }
          end.sort_by { |f| -f[:name].to_i }  # Newest first

          { folders: folders, files: [] }

        else
          # Level 4+: Show actual files
          mailbox = path_segments[0]
          year = path_segments[1].to_i
          folder_type = path_segments[2]  # "Email Body" or "Attachments"
          month = path_segments[3].to_i

          if folder_type == "Attachments"
            # Show email attachments
            attachments = SyncedEmailAttachment.joins(:synced_email)
                                               .where(synced_emails: { mailbox_owner_email: mailbox })
                                               .where("EXTRACT(YEAR FROM synced_emails.received_at) = ?", year)
                                               .where("EXTRACT(MONTH FROM synced_emails.received_at) = ?", month)
                                               .order("synced_emails.received_at DESC")
                                               .limit(500)

            files = attachments.map do |att|
              {
                id: att.id,
                name: att.filename || "(Unknown)",
                type: "attachment",
                mimeType: att.content_type || "application/octet-stream",
                fileSize: att.file_size,
                receivedAt: att.synced_email&.received_at&.iso8601,
                emailSubject: att.synced_email&.subject
              }
            end
          else
            # Show emails
            emails = SyncedEmail.where(mailbox_owner_email: mailbox)
                                .where("EXTRACT(YEAR FROM received_at) = ?", year)
                                .where("EXTRACT(MONTH FROM received_at) = ?", month)
                                .order(received_at: :desc)
                                .limit(500)

            files = emails.map do |email|
              {
                id: email.id,
                name: email.subject || "(No Subject)",
                type: "email",
                mimeType: "message/rfc822",
                receivedAt: email.received_at&.iso8601,
                from: email.from_email,
                fromName: email.from_name,
                hasAttachments: email.has_attachments,
                attachmentCount: email.attachment_count
              }
            end
          end

          { folders: [], files: files }
        end
      end

      # Corporate scope: {{CompanyGroup}}/{{CompanyCode}}/{{Tab}}
      # Level 0: Company Groups (group by corporate_groups.name)
      # Level 1: Companies in group (group by company_code)
      # Level 2: Document types/tabs (group by document_type)
      # Level 3: Files
      def build_corporate_live_tree(path_segments)
        depth = path_segments.size

        case depth
        when 0
          # Root: Show company groups
          groups = CorporateGroup.order(:name).map do |group|
            count = CorporateCompanyDocument
              .joins("INNER JOIN corporate_companies cc ON cc.id = corporate_company_documents.company_id")
              .where("cc.company_group_id = ?", group.id)
              .count

            { name: group.name, path: group.name, count: count, groupId: group.id }
          end

          { folders: groups.select { |g| g[:count] > 0 }, files: [] }

        when 1
          # Level 1: Show companies in selected group
          group_name = path_segments[0]
          group = CorporateGroup.find_by(name: group_name)
          return { folders: [], files: [] } unless group

          companies = CorporateCompany.where(company_group_id: group.id).order(:name).map do |company|
            count = CorporateCompanyDocument.where(company_id: company.id).count
            display_name = company.company_code.present? ? "#{company.company_code} - #{company.name}" : company.name
            { name: display_name, path: "#{group_name}/#{company.company_code || company.id}", count: count, companyId: company.id }
          end

          { folders: companies.select { |c| c[:count] > 0 }, files: [] }

        when 2
          # Level 2: Show document types for selected company
          group_name = path_segments[0]
          company_code = path_segments[1]

          company = CorporateCompany.find_by(company_code: company_code) ||
                    CorporateCompany.find_by(id: company_code)
          return { folders: [], files: [] } unless company

          # Group by document_type (using document_type_id for proper grouping)
          doc_types = CorporateCompanyDocument.where(company_id: company.id)
                                              .joins("LEFT JOIN document_types ON document_types.id = corporate_company_documents.document_type_id")
                                              .group("COALESCE(document_types.name, corporate_company_documents.document_type, 'Uncategorized')")
                                              .count

          folders = doc_types.map do |type_name, count|
            safe_name = type_name || "Uncategorized"
            { name: safe_name, path: "#{group_name}/#{company_code}/#{safe_name}", count: count }
          end.sort_by { |f| f[:name].to_s.downcase }

          { folders: folders, files: [] }

        else
          # Level 3+: Show files for selected document type
          group_name = path_segments[0]
          company_code = path_segments[1]
          doc_type_name = path_segments[2]

          company = CorporateCompany.find_by(company_code: company_code) ||
                    CorporateCompany.find_by(id: company_code)
          return { folders: [], files: [] } unless company

          documents = CorporateCompanyDocument
            .where(company_id: company.id)
            .joins("LEFT JOIN document_types ON document_types.id = corporate_company_documents.document_type_id")
            .where("COALESCE(document_types.name, corporate_company_documents.document_type, 'Uncategorized') = ?", doc_type_name)
            .includes(:document_type_record)
            .order(created_at: :desc)
            .limit(500)

          files = documents.map do |doc|
            {
              id: doc.id,
              name: doc.display_name || doc.file_name || "Untitled",
              type: "corporate",
              mimeType: doc.mime_type || "application/octet-stream",
              fileSize: doc.file_size || 0,
              createdAt: doc.created_at&.iso8601,
              url: doc.storage_url || doc.file_url
            }
          end

          { folders: [], files: files }
        end
      end

      # Job scope: {{JobCode}}/{{Tab}}
      # Level 0: Jobs (group by job_code)
      # Level 1: Document types/tabs (group by document_type)
      # Level 2: Files
      def build_job_live_tree(path_segments)
        depth = path_segments.size

        case depth
        when 0
          # Root: Show jobs with documents
          jobs = JobDocument.joins(:job)
                            .group("jobs.job_code", "jobs.id", "jobs.name")
                            .count

          folders = jobs.map do |(job_code, job_id, job_name), count|
            display = job_code.present? ? job_code : "Job-#{job_id}"
            { name: display, path: display, count: count, jobId: job_id, jobName: job_name }
          end.sort_by { |f| f[:name].to_s.downcase }

          { folders: folders, files: [] }

        when 1
          # Level 1: Show document types for selected job
          job_code = path_segments[0]
          job = Job.find_by(job_code: job_code) || Job.find_by(id: job_code.sub(/^Job-/, ""))
          return { folders: [], files: [] } unless job

          doc_types = JobDocument.where(job_id: job.id)
                                 .joins("LEFT JOIN document_types ON document_types.id = job_documents.document_type_id")
                                 .group("COALESCE(document_types.name, 'Uncategorized')")
                                 .count

          folders = doc_types.map do |type_name, count|
            safe_name = type_name || "Uncategorized"
            { name: safe_name, path: "#{job_code}/#{safe_name}", count: count }
          end.sort_by { |f| f[:name].to_s.downcase }

          { folders: folders, files: [] }

        else
          # Level 2+: Show files
          job_code = path_segments[0]
          doc_type_name = path_segments[1]

          job = Job.find_by(job_code: job_code) || Job.find_by(id: job_code.sub(/^Job-/, ""))
          return { folders: [], files: [] } unless job

          documents = JobDocument.where(job_id: job.id)
                                 .joins("LEFT JOIN document_types ON document_types.id = job_documents.document_type_id")
                                 .where("COALESCE(document_types.name, 'Uncategorized') = ?", doc_type_name)
                                 .order(created_at: :desc)
                                 .limit(500)

          files = documents.map do |doc|
            {
              id: doc.id,
              name: doc.display_title || doc.file_name || "Untitled",
              type: "job",
              mimeType: doc.mime_type || "application/octet-stream",
              fileSize: doc.file_size || 0,
              createdAt: doc.created_at&.iso8601,
              url: doc.storage_url || doc.web_url
            }
          end

          { folders: [], files: files }
        end
      end

      # Contact scope: {{ContactName}}/{{Tab}}
      # Uses ContactDocument (Xero invoices/bills)
      def build_contact_live_tree(path_segments)
        depth = path_segments.size

        case depth
        when 0
          # Root: Show contacts with documents
          contacts = ContactDocument.joins(:contact)
                                    .group("contacts.name", "contacts.id")
                                    .count

          folders = contacts.map do |(contact_name, contact_id), count|
            display = contact_name.presence || "Unknown Contact"
            { name: display, path: display, count: count, contactId: contact_id }
          end.sort_by { |f| f[:name].to_s.downcase }

          { folders: folders, files: [] }

        when 1
          # Level 1: Show document types for selected contact
          contact_name = path_segments[0]
          contact = Contact.find_by(name: contact_name) || Contact.find_by(display_name: contact_name)
          return { folders: [], files: [] } unless contact

          doc_types = ContactDocument.where(contact_id: contact.id)
                                     .joins("LEFT JOIN document_types ON document_types.id = contact_documents.document_type_id")
                                     .group("COALESCE(document_types.name, 'Uncategorized')")
                                     .count

          folders = doc_types.map do |type_name, count|
            safe_name = type_name || "Uncategorized"
            { name: safe_name, path: "#{contact_name}/#{safe_name}", count: count }
          end.sort_by { |f| f[:name].to_s.downcase }

          { folders: folders, files: [] }

        else
          # Level 2+: Show files
          contact_name = path_segments[0]
          doc_type_name = path_segments[1]

          contact = Contact.find_by(name: contact_name) || Contact.find_by(display_name: contact_name)
          return { folders: [], files: [] } unless contact

          documents = ContactDocument.where(contact_id: contact.id)
                                     .joins("LEFT JOIN document_types ON document_types.id = contact_documents.document_type_id")
                                     .where("COALESCE(document_types.name, 'Uncategorized') = ?", doc_type_name)
                                     .order(created_at: :desc)
                                     .limit(500)

          files = documents.map do |doc|
            {
              id: doc.id,
              name: doc.display_name || doc.file_name || "Untitled",
              type: "contact",
              mimeType: doc.mime_type || "application/octet-stream",
              fileSize: doc.file_size || 0,
              createdAt: doc.created_at&.iso8601,
              url: doc.respond_to?(:storage_url) ? doc.storage_url : nil
            }
          end

          { folders: [], files: files }
        end
      end

      # People scope: {{ContactName}}/{{Tab}}
      # Uses PeopleDocument (employee documents)
      def build_people_live_tree(path_segments)
        depth = path_segments.size

        case depth
        when 0
          # Root: Show contacts with people documents
          contacts = PeopleDocument.joins(:contact)
                                   .group("contacts.name", "contacts.id")
                                   .count

          folders = contacts.map do |(contact_name, contact_id), count|
            display = contact_name.presence || "Unknown Person"
            { name: display, path: display, count: count, contactId: contact_id }
          end.sort_by { |f| f[:name].to_s.downcase }

          { folders: folders, files: [] }

        when 1
          # Level 1: Show document types for selected person
          contact_name = path_segments[0]
          contact = Contact.find_by(name: contact_name) || Contact.find_by(display_name: contact_name)
          return { folders: [], files: [] } unless contact

          doc_types = PeopleDocument.where(contact_id: contact.id)
                                    .joins("LEFT JOIN document_types ON document_types.id = people_documents.document_type_id")
                                    .group("COALESCE(document_types.name, people_documents.document_type, 'Uncategorized')")
                                    .count

          folders = doc_types.map do |type_name, count|
            safe_name = type_name || "Uncategorized"
            { name: safe_name, path: "#{contact_name}/#{safe_name}", count: count }
          end.sort_by { |f| f[:name].to_s.downcase }

          { folders: folders, files: [] }

        else
          # Level 2+: Show files
          contact_name = path_segments[0]
          doc_type_name = path_segments[1]

          contact = Contact.find_by(name: contact_name) || Contact.find_by(display_name: contact_name)
          return { folders: [], files: [] } unless contact

          documents = PeopleDocument.where(contact_id: contact.id)
                                    .joins("LEFT JOIN document_types ON document_types.id = people_documents.document_type_id")
                                    .where("COALESCE(document_types.name, people_documents.document_type, 'Uncategorized') = ?", doc_type_name)
                                    .order(created_at: :desc)
                                    .limit(500)

          files = documents.map do |doc|
            {
              id: doc.id,
              name: doc.title || doc.file_name || "Untitled",
              type: "people",
              mimeType: doc.mime_type || "application/octet-stream",
              fileSize: doc.file_size || 0,
              createdAt: doc.created_at&.iso8601,
              expiryDate: doc.expiry_date&.iso8601,
              isExpired: doc.respond_to?(:expired?) ? doc.expired? : false,
              url: doc.respond_to?(:storage_url) ? doc.storage_url : nil
            }
          end

          { folders: [], files: files }
        end
      end

      # Task scope: Tasks/{{TaskNumber}}
      # Uses SmTaskAttachment linked to CorporateCompanyDocument
      def build_task_live_tree(path_segments)
        depth = path_segments.size

        case depth
        when 0
          # Root: Show "Tasks" folder as entry point
          count = SmTaskAttachment.where(attachable_type: "CorporateCompanyDocument").distinct.count(:sm_task_id)
          { folders: [{ name: "Tasks", path: "Tasks", count: count }], files: [] }

        when 1
          # Level 1: Show tasks with attachments
          tasks = SmTaskAttachment.where(attachable_type: "CorporateCompanyDocument")
                                  .joins(:sm_task)
                                  .group("sm_tasks.task_number", "sm_tasks.id", "sm_tasks.name")
                                  .count

          folders = tasks.map do |(task_number, task_id, task_name), count|
            display = task_number.present? ? "#{task_number} - #{task_name}" : task_name
            { name: display || "Task #{task_id}", path: "Tasks/#{task_number || task_id}", count: count, taskId: task_id }
          end.sort_by { |f| f[:name].to_s.downcase }

          { folders: folders, files: [] }

        else
          # Level 2+: Show files for selected task
          task_identifier = path_segments[1]

          task = SmTask.find_by(task_number: task_identifier) || SmTask.find_by(id: task_identifier)
          return { folders: [], files: [] } unless task

          attachments = SmTaskAttachment.where(sm_task_id: task.id, attachable_type: "CorporateCompanyDocument")
                                        .includes(:attachable)

          files = attachments.map do |attachment|
            doc = attachment.attachable
            next unless doc

            {
              id: doc.id,
              name: doc.display_name || doc.file_name || "Untitled",
              type: "task",
              mimeType: doc.mime_type || "application/octet-stream",
              fileSize: doc.file_size || 0,
              createdAt: doc.created_at&.iso8601,
              taskId: task.id,
              taskNumber: task.task_number,
              url: doc.storage_url || doc.file_url
            }
          end.compact

          { folders: [], files: files }
        end
      end

      # Phase 4: Build virtual folder tree from WarehouseDocument.folder paths
      # Groups documents by folder path segments to create nested folder structure
      #
      # @param documents [ActiveRecord::Relation] WarehouseDocument query
      # @param base_path [String] Current path to get immediate children of
      # @return [Hash] { folders: [{ name, path, count }...], total_files: Integer }
      def build_virtual_folder_tree(documents, base_path)
        # Get all unique folder paths
        all_folders = documents.where.not(folder: [nil, ""])
                               .distinct
                               .pluck(:folder)

        # Find immediate child folders (one level deeper than base_path)
        child_folders = {}

        all_folders.each do |folder_path|
          next if folder_path.blank?

          # Get the relative path from base_path
          relative = if base_path.present?
            # Skip folders that don't start with base_path
            next unless folder_path.start_with?(base_path)
            # Get the part after base_path
            folder_path.sub("#{base_path}/", "")
          else
            folder_path
          end

          next if relative.blank? || relative == base_path

          # Get just the first segment (immediate child folder)
          first_segment = relative.split("/").first
          next if first_segment.blank?

          # Build full path for this child folder
          full_child_path = base_path.present? ? "#{base_path}/#{first_segment}" : first_segment

          # Count documents in this folder subtree
          child_folders[first_segment] ||= { name: first_segment, path: full_child_path, count: 0 }
          # Count documents whose folder starts with this child path
          child_folders[first_segment][:count] = documents.where("folder LIKE ?", "#{full_child_path}%").count
        end

        # Sort folders alphabetically
        sorted_folders = child_folders.values.sort_by { |f| f[:name].to_s.downcase }

        { folders: sorted_folders }
      end

      # SSoT: Build folder hierarchy matching StorageConfiguration.SCOPE_TEMPLATES
      # Template tokens ({{CompanyGroup}}, {{CompanyCode}}, {{TabName}}) define the tree structure
      def build_hierarchy_for_scope(scope, template)
        case scope.to_s
        when "corporate", "corporate_entity"
          build_corporate_hierarchy
        when "job", "jobs"
          build_job_hierarchy
        when "contact", "contacts"
          # SSoT: ContactDocument stores invoices/bills from Xero
          build_contact_hierarchy
        when "people"
          # SSoT: PeopleDocument stores people/employee documents
          build_people_hierarchy
        else
          []  # Other scopes return empty - can be extended as needed
        end
      end

      # SSoT: Corporate hierarchy follows template {{CompanyGroup}}/{{CompanyCode}}/{{TabName}}
      def build_corporate_hierarchy
        # Get document tabs for corporate scope
        tabs = EntityTab.for_scope("corporate_entity")
                        .where(tab_group: "documents")
                        .enabled
                        .ordered

        CorporateGroup.includes(:corporate_companies).order(:name).map do |group|
          {
            id: "group-#{group.id}",
            name: group.name,
            token: "CompanyGroup",
            type: "folder",
            children: group.corporate_companies.order(:name).map do |company|
              {
                id: "company-#{company.id}",
                name: company.company_code.present? ? "#{company.company_code} (#{company.name})" : company.name,
                token: "CompanyCode",
                type: "folder",
                companyId: company.id,
                companyCode: company.company_code,
                companyName: company.name,
                children: tabs.map do |tab|
                  # Count documents for this company+tab combination
                  doc_count = if tab.document_type_ids.present?
                    CorporateCompanyDocument
                      .where(company_id: company.id, document_type_id: tab.document_type_ids)
                      .count
                  else
                    0
                  end

                  {
                    id: "tab-#{company.id}-#{tab.id}",
                    name: tab.display_name,
                    token: "TabName",
                    type: "folder",
                    entityTabId: tab.id,
                    companyId: company.id,
                    fileCount: doc_count
                  }
                end
              }
            end
          }
        end
      end

      # SSoT: Contact hierarchy follows template {{ContactName}}/{{TabName}}
      # Uses ContactDocument model (for Xero invoices/bills)
      def build_contact_hierarchy
        # Get document tabs for contact scope (includes Invoices, Financial, etc.)
        tabs = EntityTab.for_scope("contact")
                        .where(tab_group: "documents")
                        .enabled
                        .ordered

        # Get contacts with ContactDocuments (includes Xero invoices)
        Contact.joins(:contact_documents)
               .distinct
               .order(:name)
               .limit(100)
               .map do |contact|
          {
            id: "contact-#{contact.id}",
            name: contact.display_name || contact.name,
            token: "ContactName",
            type: "folder",
            contactId: contact.id,
            children: tabs.map do |tab|
              doc_count = if tab.document_type_ids.present?
                ContactDocument
                  .where(contact_id: contact.id, document_type_id: tab.document_type_ids)
                  .count
              else
                ContactDocument.where(contact_id: contact.id).count
              end

              {
                id: "tab-#{contact.id}-#{tab.id}",
                name: tab.display_name,
                token: "TabName",
                type: "folder",
                entityTabId: tab.id,
                contactId: contact.id,
                fileCount: doc_count
              }
            end
          }
        end
      end

      # SSoT: Job hierarchy follows template {{JobCode}}/{{TabName}}
      def build_job_hierarchy
        # Get document tabs for job scope
        tabs = EntityTab.for_scope("job")
                        .where(tab_group: "documents")
                        .enabled
                        .ordered

        # Get recent jobs (limit for performance)
        Job.order(created_at: :desc).limit(100).map do |job|
          {
            id: "job-#{job.id}",
            name: job.job_number,
            token: "JobCode",
            type: "folder",
            jobId: job.id,
            jobTitle: job.title,
            children: tabs.map do |tab|
              doc_count = if tab.document_type_ids.present?
                JobDocument
                  .where(job_id: job.id, document_type_id: tab.document_type_ids)
                  .count
              else
                0
              end

              {
                id: "tab-#{job.id}-#{tab.id}",
                name: tab.display_name,
                token: "TabName",
                type: "folder",
                entityTabId: tab.id,
                jobId: job.id,
                fileCount: doc_count
              }
            end
          }
        end
      end

      # SSoT: People hierarchy follows template {{ContactName}}/{{TabName}}
      def build_people_hierarchy
        # Get document tabs for people scope
        tabs = EntityTab.for_scope("people")
                        .where(tab_group: "documents")
                        .enabled
                        .ordered

        # Get contacts with documents (limit for performance)
        Contact.joins(:people_documents)
               .distinct
               .order(:name)
               .limit(100)
               .map do |contact|
          {
            id: "contact-#{contact.id}",
            name: contact.display_name || contact.name,
            token: "ContactName",
            type: "folder",
            contactId: contact.id,
            children: tabs.map do |tab|
              doc_count = if tab.document_type_ids.present?
                PeopleDocument
                  .where(contact_id: contact.id, document_type_id: tab.document_type_ids)
                  .count
              else
                0
              end

              {
                id: "tab-#{contact.id}-#{tab.id}",
                name: tab.display_name,
                token: "TabName",
                type: "folder",
                entityTabId: tab.id,
                contactId: contact.id,
                fileCount: doc_count
              }
            end
          }
        end
      end

      # SSoT: Fetch job documents by EntityTab.document_type_ids
      def fetch_job_documents(entity_tab)
        return [] if entity_tab.document_type_ids.empty?

        JobDocument
          .where(document_type_id: entity_tab.document_type_ids)
          .includes(:job)
          .order(created_at: :desc)
          .limit(500)
          .map do |doc|
            {
              name: doc.display_title || doc.file_name || "Untitled",
              path: doc.storage_path || doc.folder_path || "",
              size: doc.file_size || 0,
              content_type: doc.mime_type || MiniMime.lookup_by_filename(doc.file_name || "")&.content_type || "application/octet-stream",
              last_modified: doc.updated_at&.iso8601,
              # SSoT: storage_url (from StorableDocument concern) is THE ONE way to get download URLs
              # Falls back to web_url (SharePoint) for backwards compatibility
              url: doc.storage_url || doc.web_url || "",
              id: doc.id,
              job_id: doc.job_id,
              job_number: doc.job&.job_number,
              job_title: doc.job&.title
            }
          end
      end

      # SSoT: Fetch corporate documents by EntityTab.document_type_ids
      def fetch_corporate_documents(entity_tab)
        return [] if entity_tab.document_type_ids.empty?

        CorporateCompanyDocument
          .where(document_type_id: entity_tab.document_type_ids)
          .includes(:corporate_company)
          .order(created_at: :desc)
          .limit(500)
          .map do |doc|
            {
              name: doc.display_name || doc.file_name || "Untitled",
              path: doc.storage_path || doc.expected_storage_path || "",
              size: doc.file_size || 0,
              content_type: doc.mime_type || MiniMime.lookup_by_filename(doc.file_name || "")&.content_type || "application/octet-stream",
              last_modified: doc.updated_at&.iso8601,
              # SSoT: storage_url (from StorableDocument concern) is THE ONE way to get download URLs
              # Falls back to legacy database columns for backwards compatibility
              url: doc.storage_url || doc.file_url || doc.storage_download_url || "",
              id: doc.id,
              company_name: doc.corporate_company&.name,
              company_code: doc.company_code
            }
          end
      end

      # SSoT: Fetch warehouse spreadsheets (TeeemSpreadsheet)
      def fetch_warehouse_spreadsheets
        TeeemSpreadsheet
          .includes(:user)
          .order(updated_at: :desc)
          .limit(500)
          .map do |doc|
            {
              name: doc.name || "Untitled Spreadsheet",
              path: doc.warehouse_path,
              size: 0,
              content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              last_modified: doc.updated_at&.iso8601,
              url: "/spreadsheets/#{doc.id}",  # Frontend URL to open
              id: doc.id,
              doc_type: "excel",
              user_name: doc.user&.name
            }
          end
      end

      # SSoT: Fetch warehouse documents (TeeemDocument)
      def fetch_warehouse_documents
        TeeemDocument
          .includes(:user)
          .order(updated_at: :desc)
          .limit(500)
          .map do |doc|
            {
              name: doc.name || "Untitled Document",
              path: doc.warehouse_path,
              size: 0,
              content_type: "text/html",
              last_modified: doc.updated_at&.iso8601,
              url: "/documents/#{doc.id}",  # Frontend URL to open
              id: doc.id,
              doc_type: "word",
              user_name: doc.user&.name
            }
          end
      end

      # SSoT: Fetch warehouse presentations (TeeemPresentation)
      def fetch_warehouse_presentations
        TeeemPresentation
          .includes(:user)
          .order(updated_at: :desc)
          .limit(500)
          .map do |doc|
            {
              name: doc.name || "Untitled Presentation",
              path: doc.warehouse_path,
              size: 0,
              content_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              last_modified: doc.updated_at&.iso8601,
              url: "/presentations/#{doc.id}",  # Frontend URL to open
              id: doc.id,
              doc_type: "powerpoint",
              user_name: doc.user&.name
            }
          end
      end

      # SSoT: Fetch warehouse PDFs (TeeemPdf)
      def fetch_warehouse_pdfs
        TeeemPdf
          .includes(:user)
          .order(updated_at: :desc)
          .limit(500)
          .map do |doc|
            {
              name: doc.name || "Untitled PDF",
              path: doc.warehouse_path,
              size: 0,
              content_type: "application/pdf",
              last_modified: doc.updated_at&.iso8601,
              url: "/pdfs/#{doc.id}",  # Frontend URL to open
              id: doc.id,
              doc_type: "pdf",
              user_name: doc.user&.name
            }
          end
      rescue NameError
        []  # TeeemPdf might not exist
      end

      # SSoT: Fetch people documents by EntityTab.document_type_ids
      def fetch_people_documents(entity_tab)
        return [] if entity_tab.document_type_ids.empty?

        PeopleDocument
          .where(document_type_id: entity_tab.document_type_ids)
          .includes(:contact)
          .order(created_at: :desc)
          .limit(500)
          .map do |doc|
            # PeopleDocument uses Active Storage, so get URL from file attachment or storage_url
            url = if doc.respond_to?(:storage_url) && doc.storage_url.present?
                    doc.storage_url
                  elsif doc.file.attached?
                    Rails.application.routes.url_helpers.rails_blob_url(doc.file, only_path: false) rescue ""
                  else
                    ""
                  end

            {
              name: doc.title || doc.file_name || "Untitled",
              path: doc.storage_path || "",
              size: doc.file_size || 0,
              content_type: doc.mime_type || MiniMime.lookup_by_filename(doc.file_name || "")&.content_type || "application/octet-stream",
              last_modified: doc.updated_at&.iso8601,
              url: url,
              id: doc.id,
              contact_id: doc.contact_id,
              contact_name: doc.contact&.display_name
            }
          end
      end

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
          # SSoT: storage_url (from StorableDocument concern) is THE ONE way to get download URLs
          url: doc.storage_url || doc.file_url,
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

      # Phase 3: Serialize WarehouseDocument (universal format)
      # SSoT: Uses WarehouseDocument metadata with documentable context
      def warehouse_document_to_json(wd)
        documentable = wd.documentable
        blob = wd.storage_blob

        # Build download URL using WarehouseDocument.download_filename for Send Name
        download_url = if blob&.storage_path.present?
          # SSoT (Jan 2026): Use tenant for storage provider
          provider = DocumentProviders.for_tenant(current_tenant)
          provider&.download_url(blob.storage_path, expires_in: 3600, filename: wd.download_filename) rescue nil
        end

        # Get parent context based on documentable type
        parent_info = extract_parent_info(documentable)

        {
          id: wd.id,
          source: wd.source_type,
          documentableType: wd.documentable_type,
          documentableId: wd.documentable_id,
          # Names (SSoT from WarehouseDocument)
          displayName: wd.display_name,
          sendName: wd.download_filename,  # Resolved via SendNameResolver
          originalFilename: wd.original_filename,
          # File info
          mimeType: wd.content_type || blob&.content_type || "application/octet-stream",
          fileSize: wd.file_size || blob&.file_size || 0,
          # URLs
          fileUrl: download_url,
          storagePath: blob&.storage_path,
          # Virtual folder - computed from CURRENT templates (no sync needed)
          # Uses documentable's virtual_folder_path which reads current StorageConfiguration
          folder: wd.computed_folder_path,
          # Timestamps
          createdAt: wd.created_at&.iso8601,
          updatedAt: wd.updated_at&.iso8601,
          # Parent context (job, company, contact, email, etc.)
          **parent_info,
          # Metadata
          isImage: image_file?(wd.original_filename),
          # Blob deduplication info
          storageBlobId: blob&.id,
          contentHash: blob&.content_hash
        }
      end

      # Extract parent context from documentable
      def extract_parent_info(documentable)
        return {} unless documentable

        case documentable
        when CorporateCompanyDocument
          {
            companyId: documentable.company_id,
            companyName: documentable.corporate_company&.name,
            companyCode: documentable.company_code,
            documentTypeId: documentable.document_type_id,
            documentTypeName: documentable.document_type_record&.name
          }
        when JobDocument
          {
            jobId: documentable.job_id,
            jobNumber: documentable.job&.job_number,
            jobTitle: documentable.job&.title,
            documentTypeId: documentable.document_type_id,
            documentTypeName: documentable.document_type&.name
          }
        when SyncedEmail
          {
            emailSubject: documentable.subject,
            emailFrom: documentable.from_email,
            emailFromName: documentable.from_name,
            emailReceivedAt: documentable.received_at&.iso8601,
            jobId: documentable.job_id,
            contactId: documentable.contact_id
          }
        when EmailAttachment
          email = documentable.email_warehouse
          {
            emailSubject: email&.subject,
            emailFrom: email&.from_email,
            emailReceivedAt: email&.received_at&.iso8601,
            attachmentIndex: documentable.attachment_index
          }
        when ContactDocument
          {
            contactId: documentable.contact_id,
            contactName: documentable.contact&.display_name,
            documentTypeId: documentable.document_type_id,
            documentTypeName: documentable.document_type_record&.name
          }
        when PeopleDocument
          {
            contactId: documentable.contact_id,
            contactName: documentable.contact&.display_name,
            documentTypeId: documentable.document_type_id,
            documentTypeName: documentable.document_type_record&.name,
            expiryDate: documentable.expiry_date&.iso8601
          }
        else
          {}
        end
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
          storagePath: doc.storage_path,  # Full S3 key - SSoT for rename/download
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
          storagePath: doc.storage_path,  # Full S3 key - SSoT for rename/download
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
          storagePath: doc.storage_path,  # Full S3 key - SSoT for rename/download
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
          folderPath: doc.folder,  # Folder only (not full path)
          storagePath: doc.storage_path,  # Full S3 key - SSoT for rename/download
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
