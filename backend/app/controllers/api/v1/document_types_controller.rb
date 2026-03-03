module Api
  module V1
    class DocumentTypesController < ApplicationController
      include WarehouseFolderPathLookup

      before_action :set_document_type, only: [ :show, :update, :destroy, :duplicate, :detect_signature_fields ]

      # GET /api/v1/document_types
      # PERFORMANCE: Eager load warehouse_folders to prevent N+1 queries in serialize_document_type
      # P95 was 1.4s due to N+1; with eager loading should be <200ms
      # SSoT: Include join table to ensure is_primary flag is available
      # SSoT (Feb 2026): Use warehouse_folder_document_types/warehouse_folder
      def index
        # Fast path: ?for=select returns lightweight picker data (1 query, ~20ms)
        # vs full serialization (1081 queries, 1375ms, 32KB response)
        # Used by: DocumentTypePicker, DocumentTypeSinglePicker, WarehouseFoldersConfig,
        #          schedule-templates, GoldStandardTab, document-types nav
        if params[:for] == "select"
          types = DocumentType.active.order(:name)
            .select(:id, :name, :display_name, :abbreviation, :scope, :folder)
          types = types.where(scope: [params[:scope], "both"]) if params[:scope].present?
          return render json: {
            success: true,
            data: types.map { |t|
              {
                id: t.id,
                name: t.name,
                display_name: t.display_name,
                abbreviation: t.abbreviation,
                scope: t.scope,
                folder: t.folder
              }
            }
          }
        end

        @document_types = DocumentType.includes(warehouse_folder_document_types: { warehouse_folder: [:parent, :warehouse_type] })

        # Filter by scope (company, job, both)
        if params[:scope].present?
          @document_types = @document_types.by_scope(params[:scope])
        end

        # Filter by folder
        if params[:folder].present?
          @document_types = @document_types.by_folder(params[:folder])
        end

        # Filter by abbreviation(s)
        if params[:abbreviations].present?
          codes = params[:abbreviations].split(",").map(&:strip)
          @document_types = @document_types.where(abbreviation: codes)
        end

        # Filter by active status
        @document_types = @document_types.active unless params[:include_inactive] == "true"

        # Optionally group by folder
        if params[:grouped] == "true"
          # SSoT: folder is computed from primary WarehouseFolder - group in Ruby after query
          # Include warehouse_folders association for folder computation
          types = @document_types.active.includes(warehouse_folder_document_types: { warehouse_folder: [:parent, :warehouse_type] }).order(:name)
          # Derive folder from eager-loaded WFDT to avoid N+1 (document_type.folder triggers find_by per type)
          grouped = types.group_by { |dt|
            primary_wfdt = dt.warehouse_folder_document_types.find(&:is_primary) || dt.warehouse_folder_document_types.first
            primary_wfdt&.warehouse_folder&.display_name || dt.read_attribute(:folder) || "Uncategorized"
          }.sort_by { |folder, _| folder || "" }.to_h
          render json: {
            success: true,
            data: grouped.transform_values { |doc_types|
              doc_types.map { |t| serialize_document_type(t) }
            }
          }
        else
          # SSoT: folder is computed - sort by name only, frontend can re-sort if needed
          render json: {
            success: true,
            data: @document_types.order(:name).map { |t| serialize_document_type(t) },
            summary: document_type_summary,
            available_tabs: all_available_tabs
          }
        end
      end

      # GET /api/v1/document_types/tree
      # Returns WarehouseFolder hierarchy with document types for tree picker.
      # Params:
      #   scope: "job" | "corporate" | "contact" | "library" (optional, returns all if blank)
      def tree
        scope_codes = if params[:scope].present?
          Array(params[:scope].split(","))
        else
          %w[job corporate contact library]
        end

        all_folders = WarehouseFolder
          .joins(:warehouse_type)
          .where(warehouse_types: { code: scope_codes })
          .where(enabled: true)
          .includes(:warehouse_type, warehouse_folder_document_types: :document_type)
          .order(:order_position, :name)

        all_folders_arr = all_folders.to_a
        roots = all_folders_arr.select { |f| f.parent_id.nil? }

        render json: {
          success: true,
          data: roots.sort_by { |f| [f.order_position || 999, f.name || ""] }.map { |f| serialize_folder_tree(f, all_folders_arr) }
        }
      end

      # GET /api/v1/document_types/tabs
      def tabs
        render json: {
          success: true,
          tabs: all_available_tabs
        }
      end

      # GET /api/v1/document_types/:id
      def show
        render json: {
          success: true,
          data: serialize_document_type(@document_type)
        }
      end

      # POST /api/v1/document_types
      def create
        # SSoT: Map camelCase to snake_case (frontend uses camelCase)
        params[:document_type][:ui_name] = params[:document_type][:uiName] if params[:document_type][:uiName].present?
        params[:document_type][:download_name] = params[:document_type][:downloadName] if params[:document_type][:downloadName].present?

        # SSoT: entity_tab_ids is THE frontend name → always map to warehouse_folder_ids
        if params[:document_type][:entity_tab_ids].present?
          params[:document_type][:warehouse_folder_ids] = params[:document_type][:entity_tab_ids]
        end

        # Handle form_number_mapping separately (arbitrary keys not supported by strong params)
        create_params = document_type_params.to_h
        if params[:document_type][:form_number_mapping].present?
          create_params[:form_number_mapping] = params[:document_type][:form_number_mapping].to_unsafe_h
        end

        @document_type = DocumentType.new(create_params)

        if @document_type.save
          render json: {
            success: true,
            data: serialize_document_type(@document_type)
          }, status: :created
        else
          render_validation_errors(@document_type)
        end
      end

      # PATCH/PUT /api/v1/document_types/:id
      def update
        # SSoT: Map camelCase to snake_case (frontend uses camelCase)
        params[:document_type][:ui_name] = params[:document_type][:uiName] if params[:document_type][:uiName].present?
        params[:document_type][:download_name] = params[:document_type][:downloadName] if params[:document_type][:downloadName].present?

        # SSoT: entity_tab_ids is THE frontend name → always map to warehouse_folder_ids
        # (frontend sends both entity_tab_ids AND stale warehouse_folder_ids from last load)
        if params[:document_type][:entity_tab_ids].present?
          params[:document_type][:warehouse_folder_ids] = params[:document_type][:entity_tab_ids]
        end

        # Handle form_number_mapping separately (arbitrary keys not supported by strong params)
        update_params = document_type_params.to_h
        if params[:document_type][:form_number_mapping].present?
          update_params[:form_number_mapping] = params[:document_type][:form_number_mapping].to_unsafe_h
        elsif params[:document_type].key?(:form_number_mapping)
          # Allow clearing the mapping by passing empty object
          update_params[:form_number_mapping] = {}
        end

        if @document_type.update(update_params)
          # SSoT: When user explicitly sets templates on the Document Type page,
          # clear any WFDT-level overrides so the DocumentType values become effective.
          # WFDT overrides (level 1) take priority over DocumentType (level 2) in the
          # template resolution chain. Without clearing, the user's changes won't take effect.
          if @document_type.saved_change_to_ui_name? || @document_type.saved_change_to_download_name?
            @document_type.warehouse_folder_document_types.where.not(
              ui_name_template: nil
            ).or(
              @document_type.warehouse_folder_document_types.where.not(
                download_name_template: nil
              )
            ).find_each do |wfdt|
              wfdt.update_columns(
                ui_name_template: nil,
                download_name_template: nil
              )
            end
          end

          response_data = {
            success: true,
            data: serialize_document_type(@document_type.reload)
          }

          # Include naming format change info if the format was changed
          # This allows the frontend to prompt the user to rename existing documents
          if @document_type.naming_format_change_info.present?
            response_data[:naming_format_change] = @document_type.naming_format_change_info
          end

          render json: response_data
        else
          render_validation_errors(@document_type)
        end
      end

      # DELETE /api/v1/document_types/:id
      # Note: corporate_company_documents table DROPPED (Jan 2026) - check removed
      # TODO: Add WarehouseDocument check if document types need protection
      def destroy
        @document_type.destroy
        render json: { success: true }
      end

      # POST /api/v1/document_types/:id/duplicate
      def duplicate
        # Generate a unique name by appending a number
        base_name = @document_type.name
        new_name = "#{base_name} 1"
        counter = 1

        # Keep incrementing until we find a unique name
        while DocumentType.exists?(name: new_name)
          counter += 1
          new_name = "#{base_name} #{counter}"
        end

        # Duplicate the document type with the new name
        new_doc_type = @document_type.dup
        new_doc_type.name = new_name
        new_doc_type.ui_name = new_name if @document_type.ui_name.present?

        if new_doc_type.save
          # Copy warehouse_folder associations using the setter (which calls sync_entity_tab_ids)
          new_doc_type.sync_warehouse_folder_ids(@document_type.warehouse_folder_ids)

          render json: {
            success: true,
            data: serialize_document_type(new_doc_type),
            message: "Document type duplicated as '#{new_name}'"
          }, status: :created
        else
          render_validation_errors(new_doc_type)
        end
      end

      # GET /api/v1/document_types/dwelling_types
      # Returns the available dwelling type choices from the Jobs foundation column (SSoT)
      def dwelling_types
        # Find the dwelling_type column from Jobs foundation (SSoT for choices AND descriptions)
        dwelling_column = Column.joins(:foundation)
                                .where(foundations: { slug: 'jobs' })
                                .where(column_name: 'dwelling_type')
                                .first

        choices = dwelling_column&.available_choices || []
        descriptions = dwelling_column&.choice_descriptions || {}

        render json: {
          success: true,
          data: choices.map { |c|
            desc = descriptions[c]
            {
              value: c,
              description: desc,
              displayLabel: desc.present? ? "#{c} (#{desc})" : c  # SSoT for display format
            }
          }
        }
      end

      # POST /api/v1/document_types/:id/detect_signature_fields
      # Uses Claude Vision to detect signature field positions in a PDF
      #
      # Params:
      #   pdf_content: Base64-encoded PDF content
      #
      # Response:
      #   { success: true, fields: [{signatory_type, page_number, x_percent, y_percent, ...}] }
      #
      # The detected fields can be adjusted in the frontend UI, then saved via PATCH /document_types/:id
      def detect_signature_fields
        unless params[:pdf_content].present?
          return render_error("pdf_content parameter is required (base64-encoded PDF)", status: :bad_request)
        end

        begin
          # Decode base64 PDF content
          pdf_content = Base64.decode64(params[:pdf_content])

          # Detect signature fields using Claude Vision
          result = DocumentVerificationService.detect_signature_fields!(pdf_content)

          if result[:success]
            render json: {
              success: true,
              fields: result[:fields],
              analysis_notes: result[:analysis_notes]
            }
          else
            render_error(result[:error], status: :unprocessable_entity)
          end
        rescue StandardError => e
          Rails.logger.error("Signature detection failed: #{e.message}")
          render_error("Failed to detect signature fields: #{e.message}", status: :internal_server_error)
        end
      end

      # GET /api/v1/document_types/suggest
      # Returns suggested DocumentTypes for a given filename with confidence scores
      #
      # Params:
      #   filename: The filename to match (required)
      #   scope: Optional filter (company, job, contacts, etc.)
      #   limit: Max results (default: 5)
      #
      # Response:
      #   { suggestions: [{ id, name, confidence, match_type, matched_term }, ...] }
      def suggest
        filename = params[:filename]

        unless filename.present?
          return render_error("filename parameter is required", status: :bad_request)
        end

        suggestions = DocumentTypeMatcher.suggest(
          filename,
          scope: params[:scope],
          limit: (params[:limit] || 5).to_i
        )

        render json: {
          success: true,
          suggestions: suggestions.map do |s|
            {
              id: s[:document_type].id,
              name: s[:document_type].name,
              uiName: s[:document_type].ui_name,
              folder: s[:document_type].folder,
              confidence: s[:confidence],
              match_type: s[:match_type],
              matched_term: s[:matched_term]
            }
          end
        }
      end

      private

      def set_document_type
        @document_type = DocumentType.includes(warehouse_folder_document_types: { warehouse_folder: [:parent, :warehouse_type] }).find(params[:id])
      end

      # Recursively serialize a WarehouseFolder with its children and document types
      def serialize_folder_tree(folder, all_folders)
        children = all_folders.select { |f| f.parent_id == folder.id }
          .sort_by { |f| [f.order_position || 999, f.name || ""] }

        doc_types = folder.warehouse_folder_document_types
          .select { |wfdt| wfdt.document_type&.active }
          .sort_by { |wfdt| wfdt.document_type&.name || "" }
          .map { |wfdt|
            dt = wfdt.document_type
            {
              id: dt.id,
              name: dt.name
            }
          }

        {
          id: folder.id,
          name: folder.display_name || folder.name,
          warehouseTypeCode: folder.warehouse_type&.code,
          documentTypes: doc_types,
          children: children.map { |c| serialize_folder_tree(c, all_folders) }
        }
      end

      def document_type_params
        params.require(:document_type).permit(
          :name,
          :ui_name,
          :folder,
          :description,
          :requires_filing,
          :retention_years,
          :active,
          :download_name,
          :abbreviation,
          :scope,
          :target_folder,
          :tracks_signing_status,
          :generates_certificate,     # Auto-generate certificate on task completion
          :certificate_template,      # Template to use (e.g., "form_43")
          :signature_field_config,    # JSONB: Signature field positions for Word→PDF conversion
          file_extensions: [],
          aliases: [],                # JSONB: Alternative names for document matching
          filename_patterns: [],      # JSONB: Regex patterns for filename matching
          warehouse_folder_ids: [],
          form_number_mapping: {}  # Hash: dwelling type -> form number
        )
      end

      def serialize_document_type(document_type)
        # SSoT: WarehouseFolder data (replaces deprecated document_type_folders)
        # Use warehouse_folder_document_types to get is_primary flag and proper ordering
        # Sort by is_primary DESC so primary folder is first, then by order_position
        # SSoT (Feb 2026): Use warehouse_folder_document_types/warehouse_folder
        # Use eager-loaded association - do NOT call .includes() again (causes N+1)
        folder_joins = document_type.warehouse_folder_document_types
                                    .sort_by { |wfdt| [ wfdt.is_primary ? 0 : 1, wfdt.warehouse_folder&.order_position || 999 ] }

        warehouse_folders_data = folder_joins.filter_map do |wfdt|
          tab = wfdt.warehouse_folder
          next unless tab

          {
            id: tab.id,
            tab_key: tab.tab_key,
            display_name: tab.display_name,
            hierarchy_path: [tab.warehouse_type&.display_name, lookup_folder_name_path(tab)].compact.join('/'),
            warehouse_type_code: tab.warehouse_type&.code,
            warehouse_type_name: tab.warehouse_type&.display_name,
            parent_id: tab.parent_id,
            parent_name: tab.parent&.display_name,
            is_primary: wfdt.is_primary
          }
        end

        primary_tab_data = warehouse_folders_data.find { |f| f[:is_primary] } || warehouse_folders_data.first
        primary_wfdt = folder_joins.find { |wfdt| wfdt.is_primary } || folder_joins.first

        # ⚠️ DO NOT SIMPLIFY - N+1 prevention (Feb 2026)
        # ════════════════════════════════════════════════════════════════════
        # Why: document_type.folder, .scope, .target_folder each call
        # primary_warehouse_folder which does find_by (SQL) per doc type.
        # With ~700 doc types × 5 method calls = ~3500 queries + OOM crash.
        # ❌ WRONG: document_type.folder (triggers primary_warehouse_folder query)
        # ✅ CORRECT: Use already-computed primary_tab_data from eager-loaded associations
        # ════════════════════════════════════════════════════════════════════
        derived_folder = primary_tab_data&.dig(:display_name) || document_type.read_attribute(:folder)
        derived_scope = if primary_tab_data
          case primary_tab_data[:warehouse_type_code]
          when 'corporate' then 'company'
          when 'job' then 'job'
          when 'contact' then 'contacts'
          when 'library' then 'library'
          else 'company'
          end
        else
          document_type.read_attribute(:scope)
        end
        derived_target_folder = (primary_wfdt&.warehouse_folder ? lookup_display_folder_path(primary_wfdt.warehouse_folder) : nil) || document_type.read_attribute(:target_folder)

        # Inline effective template resolution to avoid WFDT→document_type reverse N+1
        # Fallback chain: WFDT override → DocumentType → WarehouseFolder
        effective_ui = primary_wfdt&.ui_name_template.presence ||
          document_type.ui_name.presence ||
          primary_wfdt&.warehouse_folder&.ui_name_template
        effective_dl = primary_wfdt&.download_name_template.presence ||
          document_type.download_name.presence ||
          primary_wfdt&.warehouse_folder&.download_name_template

        {
          id: document_type.id,
          name: document_type.name,
          uiName: document_type.ui_name,
          abbreviation: document_type.abbreviation,
          downloadName: document_type.download_name,
          title_preview: document_type.title_preview,
          folder: derived_folder,
          description: document_type.description,
          requires_filing: document_type.requires_filing,
          retention_years: document_type.retention_years,
          active: document_type.active,
          # SSoT: WarehouseFolder data
          folder_ids: warehouse_folders_data.map { |t| t[:id] },
          folders: warehouse_folders_data.map.with_index { |t, i|
            {
              id: t[:id],
              name: t[:display_name],
              is_primary: i == 0,
              parent_id: t[:parent_id],
              parent_name: t[:parent_name]
            }
          },
          primary_folder_id: primary_tab_data&.dig(:id),
          primary_folder_name: primary_tab_data&.dig(:display_name),
          # SSoT: Foundation columns for View Manager visibility (Feb 2026)
          primary_folder: primary_tab_data&.dig(:display_name),
          primary_folder_path: primary_tab_data&.dig(:hierarchy_path),
          show_in_folders: warehouse_folders_data.reject { |f| f[:is_primary] }.map { |f| f[:display_name] }.join(", ").presence,
          # SSoT: WarehouseFolder data (new field names)
          warehouse_folder_ids: warehouse_folders_data.map { |t| t[:id] },
          warehouse_folders: warehouse_folders_data,
          primary_warehouse_folder: primary_tab_data,
          # Frontend compatibility: entity_tab_ids/entity_tabs (frontend uses these names)
          entity_tab_ids: warehouse_folders_data.map { |t| t[:id] },
          entity_tabs: warehouse_folders_data,
          # SSoT: Effective templates (from WFDT chain: WFDT override → DocumentType → WarehouseFolder)
          # These may differ from uiName/downloadName when WFDT has folder-specific overrides
          effectiveUiName: effective_ui || document_type.ui_name,
          effectiveDownloadName: effective_dl || document_type.download_name,
          hasTemplateOverrides: primary_wfdt&.has_template_overrides? || false,
          scope: derived_scope,
          file_extensions: document_type.file_extensions || [],
          aliases: document_type.aliases || [],
          filename_patterns: document_type.filename_patterns || [],
          target_folder: derived_target_folder,
          form_number_mapping: document_type.form_number_mapping || {},
          tracks_signing_status: document_type.tracks_signing_status,
          generates_certificate: document_type.generates_certificate || false,
          certificate_template: document_type.certificate_template,
          signature_field_config: document_type.signature_field_config || [],
          documents_count: 0,  # Table dropped (Jan 2026) - use WarehouseDocument
          created_at: document_type.created_at,
          updated_at: document_type.updated_at
        }
      end

      def document_type_summary
        # Use already-loaded @document_types to avoid extra COUNT queries
        types = @document_types.to_a
        # Derive folder from eager-loaded WFDT associations to avoid N+1
        # (document_type.folder calls primary_warehouse_folder which does find_by per type)
        by_folder = types.group_by { |dt|
          primary_wfdt = dt.warehouse_folder_document_types.find(&:is_primary) || dt.warehouse_folder_document_types.first
          primary_wfdt&.warehouse_folder&.display_name || dt.read_attribute(:folder) || "Uncategorized"
        }.transform_values(&:size)
        {
          total: types.size,
          by_folder: by_folder,
          requiring_filing: types.count(&:requires_filing)
        }
      end

      def all_available_tabs
        # SSoT (Feb 2026): Get all document tabs from WarehouseFolder (THE ONE table)
        # Eager load document_types for count + children for nesting
        tabs = WarehouseFolder.for_warehouse_type('corporate')
                 .where(tab_group: 'documents')
                 .where(warehouse_enabled: true)
                 .enabled
                 .root_folders
                 .ordered
                 .includes(children: :children, document_types: [])

        # Pre-fetch document type counts in one query to avoid N+1
        all_folder_ids = tabs.flat_map { |t| [t.id] + t.children.map(&:id) + t.children.flat_map { |c| c.children.map(&:id) } }
        doc_type_counts = WarehouseFolderDocumentType.where(warehouse_folder_id: all_folder_ids).group(:warehouse_folder_id).count

        tabs.map do |tab|
          {
            id: tab.id,
            name: tab.display_name,
            tab_key: tab.tab_key,
            label: tab.display_name,
            description: tab.description,
            parent_id: tab.parent_id,
            entity_types: tab.entity_filters,
            document_type_count: doc_type_counts[tab.id] || 0,
            children: tab.children.select(&:enabled).sort_by { |c| [c.order_position || 999, c.name || ""] }.map do |child|
              {
                id: child.id,
                name: child.display_name,
                tab_key: child.tab_key,
                label: child.display_name,
                description: child.description,
                parent_id: child.parent_id,
                parent_name: tab.display_name,
                entity_types: child.entity_filters,
                document_type_count: doc_type_counts[child.id] || 0,
                children: child.children.select(&:enabled).sort_by { |c| [c.order_position || 999, c.name || ""] }.map do |grandchild|
                  {
                    id: grandchild.id,
                    name: grandchild.display_name,
                    tab_key: grandchild.tab_key,
                    label: grandchild.display_name,
                    description: grandchild.description,
                    parent_id: grandchild.parent_id,
                    parent_name: child.display_name,
                    entity_types: grandchild.entity_filters,
                    document_type_count: doc_type_counts[grandchild.id] || 0
                  }
                end
              }
            end
          }
        end
      end
    end
  end
end
