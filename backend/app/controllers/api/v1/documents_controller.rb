# frozen_string_literal: true

module Api
  module V1
    class DocumentsController < ApplicationController
      before_action :set_document, only: [ :show, :update, :destroy, :download, :preview, :move, :link_to_task ]

      # GET /api/v1/documents/all
      # Returns file counts for the entire warehouse (fast)
      # Used by the File Warehouse page
      # SSoT: Counts ALL file types - documents, emails, attachments, tasks
      # NOTE: Scope keys match WarehouseProvider.SCOPE_FOLDERS for consistency
      #
      # Phase 3: Now uses WarehouseDocument as SSoT for migrated documents
      def all
        # Phase 3: WarehouseDocument counts by source_type (SSoT for migrated docs)
        warehouse_counts = WarehouseDocument.group(:source_type).count
        warehouse_total = WarehouseDocument.count

        # SSoT (Jan 2026): WarehouseDocument counts are authoritative
        # Legacy fallback removed - all documents should be in WarehouseDocument
        job_count = warehouse_counts["job"] || 0
        corp_count = warehouse_counts["corporate"] || 0
        people_count = warehouse_counts["people"] || 0

        # Email counts - use warehouse_document counts
        # SSoT (Jan 2026): WarehouseDocument is THE ONE table for all document metadata
        email_eml_count = WarehouseDocument.where(source_type: "email", documentable_type: "SyncedEmail").count
        email_attachment_count = WarehouseDocument.where(source_type: "email_attachment").count
        # Fallback to legacy counts if no warehouse documents
        email_eml_count = SyncedEmail.where.not(storage_email_path: [nil, ""]).count if email_eml_count == 0
        email_total = email_eml_count + email_attachment_count

        # Task attachment counts - documents uploaded against task IDs
        # SSoT (Jan 2026): SmTaskAttachment only references WarehouseDocument now
        task_doc_count = SmTaskAttachment.where(attachable_type: 'WarehouseDocument').distinct.count(:attachable_id) rescue 0

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
        # SSoT: Path matches WarehouseProvider.SCOPE_FOLDERS["my_docs"] = "Users/MyDocs"
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
        # SSoT (Jan 2026): SmTaskAttachment only references WarehouseDocument now
        task_attachments = SmTaskAttachment.where(attachable_type: 'WarehouseDocument')
                                           .includes(:sm_task, :attachable)
        task_documents = task_attachments.filter_map do |att|
          doc = att.attachable
          next unless doc
          serialize_task_doc_from_attachment(att, doc)
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
      #   documentable_type: Filter by underlying model (SyncedEmail, etc.)
      #   linkable_type: Filter by linked record type (Job, Contact, etc.)
      #   linkable_id: Filter by linked record ID
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

        # Filter by linkable (scoped to a specific Job, Contact, etc.)
        # Also includes cross-linked documents via "Also show in" + FK chains
        if params[:linkable_type].present? && params[:linkable_id].present?
          linkable_type = params[:linkable_type]
          linkable_id = params[:linkable_id]

          direct_docs = WarehouseDocument
            .where(tenant_id: current_tenant&.id)
            .where(linkable_type: linkable_type, linkable_id: linkable_id)

          documentable_docs = WarehouseDocument
            .where(tenant_id: current_tenant&.id)
            .where(documentable_type: linkable_type, documentable_id: linkable_id)

          cross_docs = cross_linked_warehouse_documents(linkable_type, linkable_id)

          combined_ids = (
            direct_docs.pluck(:id) +
            documentable_docs.pluck(:id) +
            cross_docs.pluck(:id)
          ).uniq

          documents = documents.where(id: combined_ids)
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

        # Get template from WarehouseProvider
        config = WarehouseProvider.instance
        template = config.path_for(scope) rescue nil

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
      # When a scope is marked as virtual in WarehouseProvider:
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
        config = WarehouseProvider.instance
        unless config.virtual_warehouse?(scope)
          return render json: {
            success: false,
            error: "Scope '#{scope}' is not configured as virtual",
            path: base_path,
            folders: [],
            files: []
          }, status: :bad_request
        end

        # SSoT: Prepend scope root folder if path doesn't already include it
        # Task folders are stored as "Tasks/123/Attachments" but frontend sends "123/Attachments"
        # FRC (Feb 2026): Compare first FOLDER exactly, not string prefix
        scope_root = warehouse_root_folder_name(scope)
        first_folder = base_path.to_s.split('/').first
        full_path = if base_path.present? && scope_root.present? && first_folder != scope_root
                      "#{scope_root}/#{base_path}"
                    else
                      base_path
                    end

        # Query WarehouseDocument by source_type
        documents = WarehouseDocument.where(source_type: scope)
                                     .includes(:documentable, :storage_blob)

        # Filter by base path if provided
        if full_path.present?
          documents = documents.where("folder LIKE ?", "#{full_path}%")
        end

        # Search filter
        if params[:search].present?
          search_term = "%#{params[:search].downcase}%"
          documents = documents.where("LOWER(display_name) LIKE ? OR LOWER(original_filename) LIKE ?", search_term, search_term)
        end

        # Build folder tree from unique folder paths
        folder_tree = build_virtual_folder_tree(documents, full_path)

        # Get files at EXACTLY this level (folder matches full_path exactly)
        files_at_level = if full_path.present?
          documents.where(folder: full_path).limit(500)
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
        # SSoT (Jan 2026): Uses WarehouseDocument.folder for corporate documents
        folders = if sources == ["corporate"]
          folder_counts = WarehouseDocument.where(source_type: "corporate")
                                           .where.not(folder: [nil, ""])
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
      # SSoT: Paths match WarehouseProvider.SCOPE_FOLDERS (Users/MyDocs, Users/Photos, etc.)
      def create
        unless params[:file].present?
          return render json: { success: false, error: "No file provided" }, status: :bad_request
        end

        file = params[:file]
        # SSoT: Folder names match WarehouseProvider.SCOPE_FOLDERS
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
          # WarehouseDocument record (which requires company/contact/job/task linkable).
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
      # SSoT: Paths match WarehouseProvider.SCOPE_FOLDERS
      def user_files
        # SSoT: Folder names match WarehouseProvider.SCOPE_FOLDERS
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
      #         Empty/nil returns root folders from WarehouseProvider.SCOPE_FOLDERS
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

      # Phase 3: Render virtual folders from WarehouseDocument.folder column
      # SSoT: Uses indexed `folder` column for instant queries (no cache needed)
      # The `folder` column is populated/updated by callbacks when documents are saved
      #
      # Performance: All queries use the index on `folder` column - O(1) not O(n)
      # - Root level: GROUP BY split_part(folder, '/', 1)
      # - Subfolders: WHERE folder LIKE 'path/%' GROUP BY next level
      # - Files: WHERE folder = 'exact/path'
      #
      # @param path [String] The folder path to list (e.g., "" for root, "Contacts", "Contacts/Acme")
      def render_virtual_folders(path = "")
        path = path.to_s.strip.gsub(%r{^/+|/+$}, "")

        # SSoT: Exclude emails from File Warehouse by default
        # Emails have their own dedicated Email page with full search/threading
        # This reduces documents from ~150k to ~26k for instant loading
        # Pass ?include_emails=true to include emails (for admin/audit use)
        include_emails = params[:include_emails] == "true"
        # SSoT (Feb 2026): Folder is COMPUTED from source_type, not stored
        # Blobs are stored flat. Folder structure is virtual metadata.
        base_scope = WarehouseDocument.where.not(source_type: [nil, ""])
        base_scope = base_scope.where.not(source_type: "email") unless include_emails

        if path.blank?
          # SSoT (Feb 2026): Root folder structure comes from WarehouseFolder.warehouse_type_to_warehouse_folder
          root_folders_from_config = WarehouseFolder.warehouse_type_to_warehouse_folder.values.uniq

          source_type_to_root = warehouse_type_to_folder_mapping

          # Count documents by source_type, then map to root folder
          source_counts = base_scope.group(:source_type).count
          folder_counts = Hash.new(0)
          source_counts.each do |source_type, count|
            root_folder = source_type_to_root[source_type]
            next unless root_folder
            folder_counts[root_folder] += count
          end

          folders = root_folders_from_config.map do |name|
            { name: name, path: name, count: folder_counts[name] || 0 }
          end

          # Add Emails folder as expandable - shows individual mailboxes when expanded
          # Each mailbox links to its specific email page
          # SSoT: Only add if not already in folders (some non-email docs may have folder starting with "Emails/")
          unless include_emails
            # Check if Emails folder already exists (from non-email docs like attachments)
            existing_emails_folder = folders.find { |f| f[:name] == "Emails" }

            email_count = WarehouseDocument.where(source_type: "email").count
            mailbox_count = SyncedEmail.where.not(mailbox_owner_email: [ nil, "" ])
                                        .distinct
                                        .count(:mailbox_owner_email)
            if email_count > 0
              if existing_emails_folder
                # Update existing folder with full email count and mailbox info
                existing_emails_folder[:count] = email_count
                existing_emails_folder[:mailbox_count] = mailbox_count
                existing_emails_folder[:expandable] = true
              else
                # Add new Emails folder
                folders << {
                  name: "Emails",
                  path: "Emails",
                  count: email_count,
                  mailbox_count: mailbox_count,  # Show "X mailboxes" in UI
                  expandable: true               # User can expand to see mailboxes
                }
              end
            end
          end

          folders = folders.sort_by { |f| f[:name].to_s.downcase }
          files = []
        elsif path == "Emails"
          # Emails folder expanded: Show individual mailboxes
          # Single-click opens drawer with emails, double-click opens /email?mailbox=xxx
          mailboxes = SyncedEmail.where.not(mailbox_owner_email: [ nil, "" ])
                                  .group(:mailbox_owner_email)
                                  .count

          folders = mailboxes.map do |email, count|
            {
              name: email,
              path: "Emails/#{email}",
              count: count,
              is_mailbox: true,                                      # Flag for frontend drawer handling
              mailbox_email: email,                                  # Email address for API calls
              external_link: "/email?mailbox=#{CGI.escape(email)}"   # For double-click new window
            }
          end.sort_by { |f| f[:name].to_s.downcase }
          files = []
        elsif path == "Tasks" || path.start_with?("Tasks/")
          # SSoT (Jan 2026): Tasks folder uses computed paths from WarehouseProvider templates
          # This reads from warehouse_folders (path_for) so template changes take effect immediately
          # No need to update stored folder column - paths are computed live
          result = build_task_folder_tree_from_template(path)
          folders = result[:folders]
          files = result[:files]
        elsif !path.include?("/") && WarehouseFolder.warehouse_type_code_for_root_folder(path)
          # SSoT (Feb 2026): Root folder expanded - show tabs from WarehouseFolder
          # e.g., "Jobs" → shows Plans, Site, Sales, Photo, etc.
          tabs_from_config = WarehouseFolder.tabs_for_root_folder(path)

          # Get actual document counts for each tab folder
          subfolder_counts = base_scope
            .where("folder LIKE ?", "#{sanitize_sql_like(path)}/%")
            .group(Arel.sql("split_part(folder, '/', 2)"))
            .count

          # Enrich tabs with counts, include tabs even with 0 documents
          folders = tabs_from_config.map do |tab|
            tab[:count] = subfolder_counts[tab[:name]] || 0
            tab
          end

          # Also add any document folders not in config (from existing documents)
          config_folder_names = tabs_from_config.map { |t| t[:name] }
          extra_folders = subfolder_counts.reject { |name, _| config_folder_names.include?(name) || name.blank? }
          extra_folders.each do |name, count|
            folders << { name: name, path: "#{path}/#{name}", count: count }
          end

          folders = folders.sort_by { |f| f[:name].to_s.downcase }
          files = []
        elsif path.include?("/") && WarehouseFolder.warehouse_type_code_for_root_folder(path.split("/").first)
          # SSoT (Feb 2026): Subfolder with configured tabs - check for child tabs
          # e.g., "Jobs/Photo" → shows Supervisor, Site, Client, etc.
          root_folder = path.split("/").first
          child_tabs = WarehouseFolder.child_tabs_for_path(path)
          path_depth = path.count("/") + 2

          # Get actual document counts for subfolders
          subfolder_counts = base_scope
            .where("folder LIKE ?", "#{sanitize_sql_like(path)}/%")
            .group(Arel.sql("split_part(folder, '/', #{path_depth})"))
            .count

          # Start with configured child tabs
          if child_tabs.any?
            folders = child_tabs.map do |tab|
              tab[:count] = subfolder_counts[tab[:name]] || 0
              tab
            end

            # Add any extra folders from documents not in config
            config_folder_names = child_tabs.map { |t| t[:name] }
            extra_folders = subfolder_counts.reject { |name, _| config_folder_names.include?(name) || name.blank? }
            extra_folders.each do |name, count|
              # SSoT: Return relative path (without root folder prefix)
              full_path = "#{path}/#{name}"
              relative_path = full_path.sub("#{root_folder}/", "")
              folders << { name: name, path: relative_path, count: count }
            end
          else
            # No child tabs in config, use document-based folders
            subfolder_counts.reject! { |name, _| name.blank? }
            folders = subfolder_counts.map do |name, count|
              # SSoT: Return relative path (without root folder prefix)
              full_path = "#{path}/#{name}"
              relative_path = full_path.sub("#{root_folder}/", "")
              { name: name, path: relative_path, count: count }
            end
          end

          # SSoT: Enrich task folders with task names (for Tasks/*)
          if path == "Tasks"
            task_ids = folders.map { |f| f[:name] }
            tasks_by_id = SmTask.where(id: task_ids)
                                .pluck(:id, :name)
                                .to_h { |id, name| [id.to_s, { id: id, name: name }] }

            folders = folders.map do |f|
              task_info = tasks_by_id[f[:name]]
              if task_info
                display = "##{task_info[:id]} #{task_info[:name]}"
                f.merge(name: display, taskId: f[:name].to_i)
              else
                f
              end
            end
          end

          folders = folders.sort_by { |f| f[:name].to_s.downcase }

          # Get files at this exact folder path
          docs_at_path = base_scope
            .where(folder: path)
            .includes(:storage_blob)
            .limit(500)

          files = docs_at_path.map do |doc|
            blob = doc.storage_blob
            url = doc.download_url rescue nil

            {
              name: doc.ui_name || doc.original_filename || "Document #{doc.id}",
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
          # Subfolder level: Get immediate subfolders and files at this exact path
          path_depth = path.count("/") + 2  # +2 because split_part is 1-indexed and we want next level

          # Get subfolders: documents where folder starts with 'path/' and has more levels
          # SQL: SELECT split_part(folder, '/', depth), COUNT(*) WHERE folder LIKE 'path/%' GROUP BY 1
          subfolder_counts = base_scope
            .where("folder LIKE ?", "#{sanitize_sql_like(path)}/%")
            .group(Arel.sql("split_part(folder, '/', #{path_depth})"))
            .count

          # Filter out empty subfolder names (documents at this exact path level)
          subfolder_counts.reject! { |name, _| name.blank? }

          folders = subfolder_counts.map do |name, count|
            { name: name, path: "#{path}/#{name}", count: count }
          end

          # SSoT (Jan 2026): Enrich task folders with task names
          # When browsing Tasks/, show "#2236 Robert Harder" (using TaskId, not task_number)
          # FRC: Display must match folder path which uses {{TaskId}} (database ID)
          # task_number is NOT unique (manual tasks all get #0, templates share numbers)
          if path == "Tasks"
            task_ids = folders.map { |f| f[:name] }
            tasks_by_id = SmTask.where(id: task_ids)
                                .pluck(:id, :name)
                                .to_h { |id, name| [id.to_s, { id: id, name: name }] }

            folders = folders.map do |f|
              task_info = tasks_by_id[f[:name]]
              if task_info
                # SSoT: Use TaskId (database ID) - matches folder path and is always unique
                display = "##{task_info[:id]} #{task_info[:name]}"
                f.merge(name: display, taskId: f[:name].to_i)
              else
                f
              end
            end
          end

          folders = folders.sort_by { |f| f[:name].to_s.downcase }

          # Get files at this exact folder path (not in subfolders)
          # SQL: SELECT * WHERE folder = 'exact/path'
          docs_at_path = base_scope
            .where(folder: path)
            .includes(:storage_blob)
            .limit(500)  # Paginate for performance

          files = docs_at_path.map do |doc|
            blob = doc.storage_blob
            url = doc.download_url rescue nil

            {
              name: doc.ui_name || doc.original_filename || "Document #{doc.id}",
              path: blob&.storage_path,
              size: doc.file_size || blob&.file_size || 0,
              content_type: doc.content_type || blob&.content_type || "application/octet-stream",
              last_modified: doc.updated_at&.iso8601,
              url: url,
              id: doc.id,
              warehouse_document_id: doc.id
            }
          end.sort_by { |f| f[:name].to_s.downcase }
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

      # Helper to escape LIKE wildcards in path
      def sanitize_sql_like(string)
        string.gsub(/[%_\\]/) { |x| "\\#{x}" }
      end

      # SSoT (Feb 2026): Map source_type to root folder
      # @return [Hash] { source_type => root_folder_name }
      def warehouse_type_to_folder_mapping
        @warehouse_type_to_folder_mapping ||= WarehouseFolder.warehouse_type_to_warehouse_folder
      end

      # Build a complete folder tree by computing paths for all warehouse documents
      # @return [Hash] { root_folders: { name => count }, paths: { doc_id => computed_path } }
      def self.build_folder_tree
        tree = { root_folders: Hash.new(0), paths: {} }

        WarehouseDocument.includes(:documentable).find_each(batch_size: 1000) do |doc|
          computed_path = doc.computed_folder_path rescue nil
          next if computed_path.blank?

          tree[:paths][doc.id] = computed_path

          root = computed_path.split("/").first
          tree[:root_folders][root] += 1
        end

        tree[:root_folders] = tree[:root_folders].to_h

        tree
      end

      # GET /api/v1/documents/folder_files
      # SSoT (Feb 2026): Unified endpoint for fetching files from WarehouseFolder folders
      # Used by File Warehouse to display subfolder contents for ALL scopes
      # Supports: job, corporate/corporate_entity/corp, contact/people
      def folder_files
        folder_id = params[:base_folder_id] || params[:warehouse_folder_id] || params[:entity_tab_id]
        scope = params[:scope] || "corporate"

        unless folder_id.present?
          return render json: { success: false, error: "warehouse_folder_id required", files: [] }, status: :bad_request
        end

        warehouse_folder = WarehouseFolder.find_by(id: folder_id)
        unless warehouse_folder
          return render json: { success: false, error: "WarehouseFolder not found", files: [] }, status: :not_found
        end

        files = case scope.to_s.downcase
                when "job"
                  fetch_job_documents(warehouse_folder)
                when "corporate", "corporate_entity", "corp"
                  fetch_corporate_documents(warehouse_folder)
                when "contact", "people"
                  fetch_people_documents(warehouse_folder)
                else
                  []
                end

        render json: {
          success: true,
          files: files,
          folder: warehouse_folder.display_name,
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
      # SSoT (Jan 2026): Uses WarehouseDocument with metadata for document properties
      def analyze
        document = WarehouseDocument.find(params[:document_id])

        # Return mock suggestion for now - can integrate with AI service later
        suggestion = {
          uiName: document.ui_name,
          document_type_id: document.meta("document_type_id"),
          fiscal_year: document.meta("fiscal_year")&.to_s,
          confidence: 0.85,
          reasoning: "Based on filename pattern and content analysis"
        }

        render json: { success: true, suggestion: suggestion }
      end

      # GET /api/v1/documents/scope_hierarchy
      # SSoT: Returns folder hierarchy for a scope that matches WarehouseProvider.SCOPE_TEMPLATES
      # Used by File Warehouse to build tree structure that mirrors storage paths
      # Example: scope=corporate → CompanyGroup/CompanyCode/TabName hierarchy
      def scope_hierarchy
        scope = params[:scope]&.to_s || "corporate"
        config = WarehouseProvider.instance
        template = config.path_for(scope)

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
      #   document_id: Optional - the WarehouseDocument ID to update
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

      # PATCH /api/v1/documents/:id/link_to_task
      # Link any WarehouseDocument to a task
      # Creates SmTaskAttachment → triggers callback → creates new WarehouseDocument in task folder
      # Original document stays in place (same blob, multiple folder entries)
      # Params:
      #   task_id: The SmTask ID to link to
      #   action_item_id: (optional) Link to a specific question (sets category to "response")
      #   category: (optional) "info" (default) or "response"
      def link_to_task
        task_id = params[:task_id]
        action_item_id = params[:action_item_id]
        # If linking to a question, category is always "response"
        category = action_item_id.present? ? "response" : (params[:category] || "info")

        unless task_id.present?
          return render json: { success: false, error: "Missing task_id parameter" }, status: :bad_request
        end

        task = SmTask.find_by(id: task_id)
        unless task
          return render json: { success: false, error: "Task not found" }, status: :not_found
        end

        # Validate action_item belongs to this task (if provided)
        action_item = nil
        if action_item_id.present?
          action_item = TaskActionItem.find_by(id: action_item_id, sm_task_id: task.id)
          unless action_item
            return render json: { success: false, error: "Question not found on this task" }, status: :not_found
          end
        end

        begin
          # Check if already attached to this task/question combo (avoid duplicates)
          # For questions: check same document + same action_item_id
          # For general attachments: check same document + no action_item_id
          existing_scope = SmTaskAttachment.where(
            sm_task_id: task.id,
            attachable_type: "WarehouseDocument",
            attachable_id: @document.id
          )

          if action_item_id.present?
            existing = existing_scope.find_by(action_item_id: action_item_id)
            if existing
              return render json: {
                success: false,
                error: "Document is already attached to this question"
              }, status: :unprocessable_entity
            end
          else
            # For general attachments, check if any non-question attachment exists
            existing = existing_scope.where(action_item_id: nil).first
            if existing
              return render json: {
                success: false,
                error: "Document is already attached to this task"
              }, status: :unprocessable_entity
            end
          end

          # Create SmTaskAttachment pointing to this WarehouseDocument
          # The after_create callback will create a NEW WarehouseDocument
          # in the task folder (Tasks/{{TaskId}}/{{Category}}) with the same blob
          attachment = SmTaskAttachment.create!(
            sm_task_id: task.id,
            attachable_type: "WarehouseDocument",
            attachable_id: @document.id,
            action_item_id: action_item_id,
            category: category,
            attachment_type: "document",
            added_by: current_user,
            display_name: @document.ui_name
          )

          render json: {
            success: true,
            message: "Document linked to task successfully",
            document: document_to_json(@document),
            task: {
              id: task.id,
              name: task.name,
              task_number: task.task_number
            },
            attachment_id: attachment.id,
            warehouse_document_id: attachment.warehouse_document&.id
          }
        rescue ActiveRecord::RecordInvalid => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error "[Documents] Link to task failed: #{e.message}"
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end
      end

      private

      # ========================================
      # SSoT: Computed Folder Tree Helpers
      # ========================================

      # Build task folder tree by computing paths from WarehouseProvider templates (SSoT)
      # Instead of reading stored folder column, computes paths using path_for(:task_attachments)
      # This ensures template changes (like adding {{TaskName}}) take effect immediately
      #
      # @param path [String] Current path (e.g., "", "Tasks", "Tasks/1811/task-name")
      # @return [Hash] { folders: [...], files: [...] }
      def build_task_folder_tree_from_template(path)
        config = WarehouseProvider.instance

        # Get all tasks with attachments
        tasks_with_attachments = SmTask
          .joins(:sm_task_attachments)
          .distinct
          .select(:id, :name)

        # Compute folder path for each task using SSoT template
        task_folders = {}
        tasks_with_attachments.each do |task|
          # Compute path from template: Tasks/{{TaskId}}/{{TaskName}}
          computed_path = config.resolve_virtual_path(:task, {
            TaskId: task.id,
            TaskName: task.name&.parameterize || "task-#{task.id}"
          })
          next if computed_path.blank?

          task_folders[computed_path] = {
            task_id: task.id,
            task_name: task.name,
            attachment_count: task.sm_task_attachments.count
          }
        end

        if path.blank? || path == "Tasks"
          # Root level or Tasks level - show task folders
          folders = task_folders.map do |folder_path, info|
            # Extract the folder name after "Tasks/"
            relative_path = folder_path.sub(%r{^Tasks/?}, "")
            folder_name = relative_path.split("/").first
            display_name = "##{info[:task_id]} #{info[:task_name]}"

            {
              name: display_name,
              path: folder_path,
              count: info[:attachment_count],
              taskId: info[:task_id]
            }
          end

          # Sort by task ID descending (newest/highest ID first)
          { folders: folders.sort_by { |f| -f[:taskId].to_i }, files: [] }
        else
          # Deeper level - find matching task and show subfolders (Attachments/Responses)
          matching_task_path = task_folders.keys.find { |p| path.start_with?(p) || p.start_with?(path) }

          if matching_task_path
            task_info = task_folders[matching_task_path]
            task = SmTask.find_by(id: task_info[:task_id])

            if path == matching_task_path
              # At task folder level - show Attachments/Responses subfolders
              attachments_path = config.resolve_virtual_path(:task_attachments, {
                TaskId: task.id,
                TaskName: task.name&.parameterize || "task-#{task.id}"
              })
              responses_path = config.resolve_virtual_path(:task_responses, {
                TaskId: task.id,
                TaskName: task.name&.parameterize || "task-#{task.id}"
              })

              attachments_count = task.sm_task_attachments.where(category: [nil, "info"]).count
              responses_count = task.sm_task_attachments.where(category: "response").count

              folders = []
              folders << { name: "Attachments", path: attachments_path, count: attachments_count } if attachments_count > 0
              folders << { name: "Responses", path: responses_path, count: responses_count } if responses_count > 0

              { folders: folders, files: [] }
            else
              # At Attachments or Responses level - show files
              is_responses = path.end_with?("/Responses")
              attachments = if is_responses
                              task.sm_task_attachments.where(category: "response")
                            else
                              task.sm_task_attachments.where(category: [nil, "info"])
                            end

              files = attachments.includes(:warehouse_document).map do |att|
                wd = att.warehouse_document
                {
                  name: wd&.display_name || att.display_name || "Attachment #{att.id}",
                  path: wd&.storage_blob&.storage_path,
                  size: wd&.file_size || 0,
                  content_type: wd&.content_type || "application/octet-stream",
                  last_modified: att.updated_at&.iso8601,
                  url: wd&.download_url,
                  id: wd&.id,
                  warehouse_document_id: wd&.id
                }
              end

              { folders: [], files: files.sort_by { |f| f[:name].to_s.downcase } }
            end
          else
            { folders: [], files: [] }
          end
        end
      end

      # ========================================
      # Multi-Source Search Helpers (AttachmentPicker)
      # ========================================

      # Search corporate documents (via WarehouseDocument SSoT)
      def search_corporate_documents(search_term, limit)
        scope = WarehouseDocument.where(source_type: "corporate")
                                 .includes(:storage_blob, :linkable)
                                 .order(created_at: :desc)
                                 .limit(limit)

        if search_term.present?
          search_pattern = "%#{search_term.downcase}%"
          scope = scope.where("LOWER(display_name) LIKE ? OR LOWER(original_filename) LIKE ?", search_pattern, search_pattern)
        end

        scope.map do |doc|
          doc_type_id = doc.meta("document_type_id")
          doc_type = DocumentType.find_by(id: doc_type_id) if doc_type_id
          {
            id: doc.id,
            name: doc.original_filename,
            display_title: doc.ui_name,
            source_type: "corporate",
            document_type: doc_type ? {
              id: doc_type.id,
              name: doc_type.name,
              abbreviation: doc_type.abbreviation || doc_type.name[0..2].upcase
            } : nil,
            url: doc.download_url,
            file_url: doc.download_url,
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
          scope = scope.where("LOWER(ui_name) LIKE ? OR LOWER(original_filename) LIKE ?",
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
            name: wd.original_filename || wd.ui_name,
            display_title: wd.ui_name,
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
      # SSoT (Jan 2026): Unified folder tree builder
      # Email has special logic (mailboxes, years, months from SyncedEmail)
      # All other scopes use generic folder-based approach from WarehouseDocument.folder
      def build_live_folder_tree(scope, path_segments)
        case scope
        when "email", "emails"
          build_email_live_tree(path_segments)
        else
          # Generic: job, contact, corporate, people, task, etc.
          # All use WarehouseDocument.folder + WarehouseFolder tabs (SSoT Feb 2026)
          build_generic_folder_tree(scope, path_segments)
        end
      end

      # SSoT (Feb 2026): ONE generic method for all folder-based scopes
      # Queries WarehouseDocument.folder + WarehouseFolder tabs
      # Works for: job, contact, corporate, people, task, case, warehouse, etc.
      #
      # IMPORTANT: Returns RELATIVE paths (without root folder prefix)
      # Frontend adds root folder prefix when building UI paths
      # e.g., for Contacts scope: returns "7 Eleven/Bills", frontend adds "Contacts/" prefix
      def build_generic_folder_tree(scope, path_segments)
        # Get root folder from scope (e.g., "job" → "Jobs", "contact" → "Contacts")
        # SSoT (Feb 2026): WarehouseFolder.root_folder_name_for returns the root folder name
        root_folder = WarehouseFolder.root_folder_name_for(scope)
        return { folders: [], files: [] } unless root_folder

        # Build full DB path (includes root folder for querying WarehouseDocument.folder)
        full_db_path = path_segments.any? ? "#{root_folder}/#{path_segments.join('/')}" : nil
        # Relative path for response (what frontend will use)
        relative_path = path_segments.any? ? path_segments.join('/') : nil
        path_depth = path_segments.size + 2  # "RootFolder" is depth 1, first segment is depth 2

        # Base scope: all documents in this root folder
        base_scope = WarehouseDocument.where("folder LIKE ?", "#{root_folder}/%")

        # Get configured tabs for this path level (SSoT: from WarehouseFolder)
        tabs_from_config = if full_db_path
          WarehouseFolder.child_tabs_for_path(full_db_path)
        else
          WarehouseFolder.tabs_for_root_folder(root_folder)
        end

        # Get subfolder counts from documents
        subfolder_scope = full_db_path ? base_scope.where("folder LIKE ?", "#{full_db_path}/%") : base_scope
        subfolder_counts = subfolder_scope
          .group(Arel.sql("split_part(folder, '/', #{path_depth})"))
          .count

        # Build folders: configured tabs (with counts) + extra folders from documents
        # SSoT: Return RELATIVE paths - frontend adds root folder prefix
        folders = tabs_from_config.map do |tab|
          # Strip root folder from path (WarehouseFolder methods return full paths)
          relative_tab_path = tab[:path].to_s.sub(/^#{Regexp.escape(root_folder)}\//, '')
          {
            name: tab[:name],
            path: relative_tab_path,
            count: subfolder_counts[tab[:name]] || 0,
            tab_key: tab[:tab_key],
            icon: tab[:icon],
            base_folder_id: tab[:base_folder_id],
            has_children: tab[:has_children]
          }
        end

        config_names = tabs_from_config.map { |t| t[:name] }
        extra_folders = subfolder_counts.reject { |name, _| config_names.include?(name) || name.blank? }
        extra_folders.each do |name, count|
          # Build relative path (without root folder)
          folder_relative_path = relative_path ? "#{relative_path}/#{name}" : name
          folders << { name: name, path: folder_relative_path, count: count }
        end

        # Get files at exactly this level (only if we have a path)
        files = []
        if full_db_path
          files_at_level = base_scope.where(folder: full_db_path).includes(:storage_blob).limit(500)
          files = files_at_level.map { |doc| warehouse_document_to_json(doc) }
        end

        folders = folders.sort_by { |f| f[:name].to_s.downcase }
        { folders: folders, files: files }
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

          # Count attachments from warehouse_documents (SSoT Jan 2026)
          attachment_count = WarehouseDocument.where(source_type: "email_attachment")
                                              .joins("INNER JOIN synced_emails ON synced_emails.id = CAST(warehouse_documents.metadata->>'synced_email_id' AS INTEGER)")
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
            # Count attachments by month (SSoT Jan 2026: WarehouseDocument)
            months = WarehouseDocument.where(source_type: "email_attachment")
                                      .joins("INNER JOIN synced_emails ON synced_emails.id = CAST(warehouse_documents.metadata->>'synced_email_id' AS INTEGER)")
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
            # Show email attachments (SSoT Jan 2026: WarehouseDocument)
            attachments = WarehouseDocument.where(source_type: "email_attachment")
                                           .includes(:storage_blob)
                                           .joins("INNER JOIN synced_emails ON synced_emails.id = CAST(warehouse_documents.metadata->>'synced_email_id' AS INTEGER)")
                                           .where(synced_emails: { mailbox_owner_email: mailbox })
                                           .where("EXTRACT(YEAR FROM synced_emails.received_at) = ?", year)
                                           .where("EXTRACT(MONTH FROM synced_emails.received_at) = ?", month)
                                           .order("synced_emails.received_at DESC")
                                           .limit(500)

            files = attachments.map do |att|
              email = SyncedEmail.find_by(id: att.metadata["synced_email_id"])
              {
                id: att.id,
                name: att.display_name || "(Unknown)",
                type: "attachment",
                mimeType: att.storage_blob&.content_type || "application/octet-stream",
                fileSize: att.storage_blob&.file_size,
                receivedAt: email&.received_at&.iso8601,
                emailSubject: email&.subject
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

      # SSoT: Build folder hierarchy matching WarehouseProvider.SCOPE_TEMPLATES
      # Template tokens ({{CompanyGroup}}, {{CompanyCode}}, {{TabName}}) define the tree structure
      def build_hierarchy_for_scope(scope, template)
        case scope.to_s
        when "corporate", "corporate_entity"
          build_corporate_hierarchy
        when "job", "jobs"
          build_job_hierarchy
        when "contact", "contacts"
          # SSoT: WarehouseDocument with source_type='contact' stores contact documents
          build_contact_hierarchy
        when "people"
          # SSoT: PeopleDocument stores people/employee documents
          build_people_hierarchy
        else
          []  # Other scopes return empty - can be extended as needed
        end
      end

      # SSoT: Corporate hierarchy follows template {{CompanyGroup}}/{{CompanyCode}}/{{TabName}}
      # SSoT (Feb 2026): Uses WarehouseDocument for document counts, WarehouseFolder for tabs
      def build_corporate_hierarchy
        # Get document tabs for corporate scope (SSoT: WarehouseFolder is THE ONE - Feb 2026)
        tabs = WarehouseFolder.for_warehouse_type("corporate")
                        .where(tab_group: "documents")
                        .where(warehouse_enabled: true)
                        .enabled
                        .ordered

        CompanyGroup.includes(:corporate_companies).order(:name).map do |group|
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
                  # Count documents for this company+tab combination using WarehouseDocument
                  doc_count = if tab.document_type_ids.present?
                    WarehouseDocument
                      .where(source_type: "corporate", linkable: company)
                      .where("metadata->>'document_type_id' IN (?)", tab.document_type_ids.map(&:to_s))
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
      # SSoT (Feb 2026): Uses WarehouseDocument for contact document counts, WarehouseFolder for tabs
      def build_contact_hierarchy
        # Get document tabs for contact scope (includes Invoices, Financial, etc.)
        tabs = WarehouseFolder.for_warehouse_type("contact")
                        .where(tab_group: "documents")
                        .where(warehouse_enabled: true)
                        .enabled
                        .ordered

        # Get contacts with WarehouseDocuments
        contact_ids = WarehouseDocument.where(source_type: "contact", linkable_type: "Contact")
                                       .distinct
                                       .pluck(:linkable_id)
        Contact.where(id: contact_ids)
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
                WarehouseDocument
                  .where(source_type: "contact", linkable: contact)
                  .where("metadata->>'document_type_id' IN (?)", tab.document_type_ids.map(&:to_s))
                  .count
              else
                WarehouseDocument.where(source_type: "contact", linkable: contact).count
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

      # SSoT: Job hierarchy follows template {{JobStatus}}/{{JobType}}/{{JobCode}}/{{TabName}}
      # SSoT (Feb 2026): Uses WarehouseDocument for job document counts, WarehouseFolder for tabs
      def build_job_hierarchy
        # Get document tabs for job scope (SSoT: WarehouseFolder is THE ONE)
        tabs = WarehouseFolder.for_warehouse_type("job")
                        .where(tab_group: "documents")
                        .where(warehouse_enabled: true)
                        .enabled
                        .ordered

        # Get recent jobs with associations for grouping
        jobs = Job.includes(:job_status, :job_type)
                  .order(created_at: :desc)
                  .limit(100)

        # Group by JobStatus → JobType → Individual Jobs (mirrors folder_path_template)
        jobs.group_by(&:job_status).map do |status, status_jobs|
          {
            id: "status-#{status&.id || 'none'}",
            name: status&.name || "No Status",
            token: "JobStatus",
            type: "folder",
            children: status_jobs.group_by(&:job_type).map do |jtype, type_jobs|
              {
                id: "type-#{status&.id || 'none'}-#{jtype&.id || 'none'}",
                name: jtype&.name || "No Type",
                token: "JobType",
                type: "folder",
                children: type_jobs.map do |job|
                  {
                    id: "job-#{job.id}",
                    name: job.job_number,
                    token: "JobCode",
                    type: "folder",
                    jobId: job.id,
                    jobTitle: job.title,
                    children: tabs.map do |tab|
                      doc_count = if tab.document_type_ids.present?
                        WarehouseDocument
                          .where(source_type: "job", linkable: job)
                          .where("metadata->>'document_type_id' IN (?)", tab.document_type_ids.map(&:to_s))
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
              }
            end
          }
        end
      end

      # SSoT: People hierarchy follows template {{ContactName}}/{{TabName}}
      # SSoT (Feb 2026): Uses WarehouseFolder for tabs
      def build_people_hierarchy
        # Get document tabs for people scope (SSoT: WarehouseFolder is THE ONE)
        tabs = WarehouseFolder.for_warehouse_type("people")
                        .where(tab_group: "documents")
                        .where(warehouse_enabled: true)
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

      # SSoT (Feb 2026): Fetch job documents by WarehouseFolder.document_type_ids
      # Uses WarehouseDocument table
      def fetch_job_documents(warehouse_folder)
        return [] if warehouse_folder.document_type_ids.empty?

        WarehouseDocument
          .where(source_type: "job")
          .where("metadata->>'document_type_id' IN (?)", warehouse_folder.document_type_ids.map(&:to_s))
          .includes(:storage_blob, :linkable)
          .order(created_at: :desc)
          .limit(500)
          .map do |doc|
            job = doc.linkable if doc.linkable_type == "Job"
            filename = doc.original_filename || doc.ui_name || "Untitled"
            {
              name: doc.ui_name || filename,
              path: doc.folder || "",
              size: doc.file_size || doc.storage_blob&.file_size || 0,
              content_type: doc.storage_blob&.content_type || MiniMime.lookup_by_filename(filename)&.content_type || "application/octet-stream",
              last_modified: doc.updated_at&.iso8601,
              url: doc.download_url || "",
              id: doc.id,
              job_id: job&.id,
              job_number: job&.job_number,
              job_title: job&.title
            }
          end
      end

      # SSoT (Feb 2026): Fetch corporate documents by WarehouseFolder.document_type_ids
      # Uses WarehouseDocument table
      def fetch_corporate_documents(warehouse_folder)
        return [] if warehouse_folder.document_type_ids.empty?

        WarehouseDocument
          .where(source_type: "corporate")
          .where("metadata->>'document_type_id' IN (?)", warehouse_folder.document_type_ids.map(&:to_s))
          .includes(:storage_blob, :linkable)
          .order(created_at: :desc)
          .limit(500)
          .map do |doc|
            company = doc.linkable if doc.linkable_type == "Corporate"
            filename = doc.original_filename || doc.ui_name || "Untitled"
            {
              name: doc.ui_name || filename,
              path: doc.folder || "",
              size: doc.file_size || doc.storage_blob&.file_size || 0,
              content_type: doc.storage_blob&.content_type || MiniMime.lookup_by_filename(filename)&.content_type || "application/octet-stream",
              last_modified: doc.updated_at&.iso8601,
              url: doc.download_url || "",
              id: doc.id,
              company_name: company&.name,
              company_code: doc.meta("company_code") || company&.code
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

      # SSoT (Feb 2026): Fetch people documents by WarehouseFolder.document_type_ids
      def fetch_people_documents(warehouse_folder)
        return [] if warehouse_folder.document_type_ids.empty?

        PeopleDocument
          .where(document_type_id: warehouse_folder.document_type_ids)
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
      # SSoT (Jan 2026): WarehouseDocument is THE ONE source for documents
      def update_document_record(document_id, source, new_filename, new_path)
        # Find by ID in WarehouseDocument (SSoT)
        doc = WarehouseDocument.find_by(id: document_id)
        return unless doc

        doc.update(display_name: new_filename, original_filename: new_filename, folder: new_path)

        # Also update storage blob path if needed
        doc.storage_blob&.update(storage_path: new_path) if doc.storage_blob
      end

      # Find document by storage_path and update
      # SSoT (Jan 2026): WarehouseDocument via StorageBlob is THE ONE source
      def find_and_update_document_by_path(old_path, new_filename, new_path)
        # Normalize path for comparison (remove leading slash)
        normalized_old = old_path.sub(%r{^/}, "")

        # Find via StorageBlob (content-addressed storage)
        blob = StorageBlob.find_by("storage_path = ? OR storage_path = ?", old_path, normalized_old)
        if blob
          # Update blob path
          blob.update(storage_path: new_path)

          # Update all linked WarehouseDocuments
          blob.warehouse_documents.find_each do |wd|
            wd.update(display_name: new_filename, original_filename: new_filename)
            Rails.logger.info "[Documents] Updated WarehouseDocument##{wd.id} after rename"
          end
        end
      end

      # SSoT (Jan 2026): WarehouseDocument is THE ONE source
      def set_document
        @document = WarehouseDocument.find(params[:id])
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

      # SSoT (Jan 2026): WarehouseDocument format
      def document_to_json(doc)
        return {} unless doc.is_a?(WarehouseDocument)

        filename = doc.original_filename || doc.ui_name
        blob = doc.storage_blob
        linkable = doc.linkable

        # Get document type from metadata
        doc_type_id = doc.meta("document_type_id")
        doc_type = DocumentType.find_by(id: doc_type_id) if doc_type_id

        {
          id: doc.id,
          name: filename,
          display_title: doc.ui_name || filename,
          type: doc.content_type || blob&.content_type || "application/octet-stream",
          size: doc.file_size || blob&.file_size || 0,
          url: doc.download_url,
          job_title: linkable.is_a?(Job) ? linkable.title : nil,
          job_id: linkable.is_a?(Job) ? linkable.id : nil,
          uploaded_at: doc.created_at&.iso8601,
          uploaded_by: doc.meta("uploaded_by") || "Unknown",
          folder_path: doc.folder,
          document_type: doc_type ? {
            id: doc_type.id,
            name: doc_type.name,
            abbreviation: doc_type.abbreviation || doc_type.name[0..2].upcase
          } : nil,
          fiscal_year: doc.meta("fiscal_year")&.to_s,
          company_name: linkable.is_a?(Corporate) ? linkable.name : nil,
          verified: doc.meta("ai_verification_status") == "verified",
          verified_at: doc.meta("user_validated_at"),
          verified_by: doc.meta("user_validated_by")
        }
      end

      # SSoT: Get root folder name for a warehouse scope
      # Reads from WarehouseFolder database (e.g., "task" → "Tasks", "job" → "Jobs")
      def warehouse_root_folder_name(scope)
        WarehouseFolder.root_folder_name_for(scope)
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Cross-linked documents (Feb 2026)
      # "Also show in" — documents appear in secondary warehouse types via FK chains
      # Mirrors logic in WarehouseTypesController#cross_linked_documents
      # ═══════════════════════════════════════════════════════════════════════════

      # Find documents that should appear via "Also show in" + FK chains
      def cross_linked_warehouse_documents(linkable_type, linkable_id)
        case linkable_type
        when "Job"
          # Find Xero docs whose ExternalInvoice.job_id matches this job,
          # but only if the document type has a secondary folder in the Job warehouse type
          invoice_ids = ExternalInvoice.where(job_id: linkable_id).pluck(:id)
          return WarehouseDocument.none if invoice_ids.empty?

          job_wt = WarehouseType.find_by(code: "job")
          return WarehouseDocument.none unless job_wt

          secondary_doc_type_ids = WarehouseFolderDocumentType
            .joins(:warehouse_folder)
            .where(is_primary: false)
            .where(warehouse_folders: { warehouse_type_id: job_wt.id })
            .pluck(:document_type_id)
          return WarehouseDocument.none if secondary_doc_type_ids.empty?

          WarehouseDocument
            .where(tenant_id: current_tenant&.id)
            .where(documentable_type: "ExternalInvoice", documentable_id: invoice_ids)
            .where(
              "metadata->>'document_type_id' IN (?)",
              secondary_doc_type_ids.map(&:to_s)
            )
        else
          WarehouseDocument.none
        end
      end

      # Phase 3: Serialize WarehouseDocument (universal format)
      # SSoT: Uses WarehouseDocument metadata with documentable context
      def warehouse_document_to_json(wd)
        # SSoT (Jan 2026): Don't access wd.documentable - it triggers NameError for deleted models
        # (e.g., ContactDocument was deleted but records still reference it)
        # Use WarehouseDocument directly - it IS the SSoT with linkable/metadata pattern
        blob = wd.storage_blob

        # Build download URL using WarehouseDocument.download_filename for Send Name
        download_url = if blob&.storage_path.present?
          # SSoT (Jan 2026): Use tenant for storage provider
          provider = DocumentProviders.for_tenant(current_tenant)
          provider&.download_url(blob.storage_path, expires_in: 3600, filename: wd.download_filename) rescue nil
        end

        # Get parent context from WarehouseDocument (SSoT: uses linkable + metadata)
        parent_info = extract_parent_info(wd)

        {
          id: wd.id,
          source: wd.source_type,
          documentableType: wd.documentable_type,
          documentableId: wd.documentable_id,
          # Names (SSoT from WarehouseDocument)
          displayName: wd.ui_name,
          sendName: wd.download_filename,  # Resolved via SendNameResolver
          originalFilename: wd.original_filename,
          # File info
          mimeType: wd.content_type || blob&.content_type || "application/octet-stream",
          fileSize: wd.file_size || blob&.file_size || 0,
          # URLs
          fileUrl: download_url,
          storagePath: blob&.storage_path,
          # Virtual folder - computed from CURRENT templates (no sync needed)
          # Uses documentable's virtual_folder_path which reads current WarehouseProvider
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

      # Extract parent context from WarehouseDocument
      # SSoT (Jan 2026): Uses linkable polymorphic and metadata instead of documentable
      def extract_parent_info(wd_or_documentable)
        return {} unless wd_or_documentable

        # If passed a WarehouseDocument, use linkable and metadata
        if wd_or_documentable.is_a?(WarehouseDocument)
          wd = wd_or_documentable
          linkable = wd.linkable

          base_info = {
            documentTypeId: wd.meta("document_type_id"),
            documentTypeName: wd.meta("document_type")
          }

          case linkable
          when Corporate
            base_info.merge(
              companyId: linkable.id,
              companyName: linkable.name,
              companyCode: linkable.company_code
            )
          when Job
            base_info.merge(
              jobId: linkable.id,
              jobNumber: linkable.job_number,
              jobTitle: linkable.title
            )
          when Contact
            base_info.merge(
              contactId: linkable.id,
              contactName: linkable.display_name
            )
          when SmTask
            base_info.merge(
              taskId: linkable.id,
              taskName: linkable.name,
              taskNumber: linkable.task_number,
              jobId: linkable.job_id
            )
          else
            # Extract from metadata if no linkable (including orphaned task docs)
            # taskId: nil explicitly included so frontend can detect orphaned task documents
            base_info.merge(
              jobId: wd.meta("job_id"),
              companyId: wd.meta("company_id"),
              contactId: wd.meta("contact_id"),
              taskId: wd.meta("task_id")  # Will be nil for orphaned task docs
            ).compact
          end
        # Legacy: Handle SyncedEmail directly (still valid documentable)
        elsif wd_or_documentable.is_a?(SyncedEmail)
          documentable = wd_or_documentable
          {
            emailSubject: documentable.subject,
            emailFrom: documentable.from_email,
            emailFromName: documentable.from_name,
            emailReceivedAt: documentable.received_at&.iso8601,
            jobId: documentable.job_id,
            contactId: documentable.contact_id
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
          displayName: doc.ui_name || doc.file_name,
          mimeType: doc.mime_type || "application/octet-stream",
          fileSize: doc.file_size || 0,
          fileUrl: generate_download_url(doc),  # S3: presigned URL, SharePoint: file_url
          folderPath: doc.folder,
          storagePath: doc.storage_path,  # Full S3 key - SSoT for rename/download
          storageProvider: doc.storage_provider,
          createdAt: doc.created_at&.iso8601,
          # Parent info
          companyId: doc.company_id,
          companyName: doc.corporate&.name,
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

      # Serialize task documents from attachment + attachable pair
      # SSoT (Jan 2026): WarehouseDocument only
      def serialize_task_doc_from_attachment(attachment, doc)
        return nil unless doc.is_a?(WarehouseDocument)

        task = attachment.sm_task
        {
          id: doc.id,
          source: "task",
          fileName: doc.original_filename || doc.ui_name,
          displayName: doc.ui_name,
          mimeType: doc.content_type || "application/octet-stream",
          fileSize: doc.file_size || 0,
          fileUrl: doc.download_url,
          folderPath: doc.folder,
          storagePath: doc.storage_path,
          storageProvider: nil,
          createdAt: doc.created_at&.iso8601,
          taskId: task&.id,
          taskName: task&.name,
          taskNumber: task&.task_number,
          jobId: task&.job_id,
          jobNumber: task&.job&.job_number,
          documentTypeId: doc.meta("document_type_id"),
          documentTypeName: doc.meta("document_type"),
          isImage: image_file?(doc.original_filename || doc.ui_name)
        }
      end

      # Serialize task doc from WarehouseDocument directly
      # SSoT (Jan 2026): WarehouseDocument only
      def serialize_task_doc(doc)
        return nil unless doc.is_a?(WarehouseDocument)

        task_attachment = SmTaskAttachment.find_by(attachable: doc)
        task = task_attachment&.sm_task
        filename = doc.original_filename || doc.ui_name

        {
          id: doc.id,
          source: "task",
          fileName: filename,
          displayName: doc.ui_name || filename,
          mimeType: doc.content_type || "application/octet-stream",
          fileSize: doc.file_size || 0,
          fileUrl: doc.download_url,
          folderPath: doc.folder,
          storagePath: doc.storage_path,
          storageProvider: nil,
          createdAt: doc.created_at&.iso8601,
          taskId: task&.id,
          taskName: task&.name,
          taskNumber: task&.task_number,
          jobId: task&.job_id,
          jobNumber: task&.job&.job_number,
          documentTypeId: doc.meta("document_type_id"),
          documentTypeName: doc.meta("document_type"),
          isImage: image_file?(filename)
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
