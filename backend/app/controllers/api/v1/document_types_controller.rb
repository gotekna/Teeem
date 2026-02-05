module Api
  module V1
    class DocumentTypesController < ApplicationController
      before_action :set_document_type, only: [ :show, :update, :destroy, :duplicate, :detect_signature_fields ]

      # GET /api/v1/document_types
      # PERFORMANCE: Eager load warehouse_folders to prevent N+1 queries in serialize_document_type
      # P95 was 1.4s due to N+1; with eager loading should be <200ms
      # SSoT: Include join table to ensure is_primary flag is available
      def index
        @document_types = DocumentType.includes(warehouse_folder_document_types: { warehouse_folder: :parent })

        # Filter by scope (company, job, both)
        if params[:scope].present?
          @document_types = @document_types.by_scope(params[:scope])
        end

        # Filter by category
        if params[:category].present?
          @document_types = @document_types.by_category(params[:category])
        end

        # Filter by folder
        if params[:folder].present?
          @document_types = @document_types.by_folder(params[:folder])
        end

        # Filter by active status
        @document_types = @document_types.active unless params[:include_inactive] == "true"

        # Optionally group by folder
        if params[:grouped] == "true"
          # SSoT: folder is computed from primary WarehouseFolder - group in Ruby after query
          # Include warehouse_folders association for folder computation
          types = @document_types.active.includes(warehouse_folder_document_types: :warehouse_folder).order(:name)
          grouped = types.group_by(&:folder).sort_by { |folder, _| folder || "" }.to_h
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

        # SSoT: Map entity_tab_ids to warehouse_folder_ids (frontend uses entity_tab_ids)
        if params[:document_type][:entity_tab_ids].present? && !params[:document_type][:warehouse_folder_ids].present?
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
          render json: {
            success: false,
            errors: @document_type.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/document_types/:id
      def update
        # SSoT: Map camelCase to snake_case (frontend uses camelCase)
        params[:document_type][:ui_name] = params[:document_type][:uiName] if params[:document_type][:uiName].present?
        params[:document_type][:download_name] = params[:document_type][:downloadName] if params[:document_type][:downloadName].present?

        # SSoT: Map entity_tab_ids to warehouse_folder_ids (frontend uses entity_tab_ids)
        if params[:document_type][:entity_tab_ids].present? && !params[:document_type][:warehouse_folder_ids].present?
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
          response_data = {
            success: true,
            data: serialize_document_type(@document_type)
          }

          # Include naming format change info if the format was changed
          # This allows the frontend to prompt the user to rename existing documents
          if @document_type.naming_format_change_info.present?
            response_data[:naming_format_change] = @document_type.naming_format_change_info
          end

          render json: response_data
        else
          render json: {
            success: false,
            errors: @document_type.errors.full_messages
          }, status: :unprocessable_entity
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
          render json: {
            success: false,
            errors: new_doc_type.errors.full_messages
          }, status: :unprocessable_entity
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
          return render json: {
            success: false,
            error: "pdf_content parameter is required (base64-encoded PDF)"
          }, status: :bad_request
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
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("Signature detection failed: #{e.message}")
          render json: {
            success: false,
            error: "Failed to detect signature fields: #{e.message}"
          }, status: :internal_server_error
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
          return render json: {
            success: false,
            error: "filename parameter is required"
          }, status: :bad_request
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
        @document_type = DocumentType.find(params[:id])
      end

      def document_type_params
        params.require(:document_type).permit(
          :name,
          :ui_name,
          :category,
          :folder,
          :description,
          :requires_filing,
          :retention_years,
          :active,
          :primary_tab,
          :download_name,
          :abbreviation,
          :scope,
          :target_folder,
          :supports_versioning,
          :generates_certificate,     # Auto-generate certificate on task completion
          :certificate_template,      # Template to use (e.g., "form_43")
          :signature_field_config,    # JSONB: Signature field positions for Word→PDF conversion
          tabs: [],
          file_extensions: [],
          folder_ids: [],
          warehouse_folder_ids: [],  # SSoT: New WarehouseFolder IDs
          form_number_mapping: {}  # Hash: dwelling type -> form number
        )
      end

      def serialize_document_type(document_type)
        # SSoT: WarehouseFolder data (replaces deprecated document_type_folders)
        # Use warehouse_folder_document_types to get is_primary flag and proper ordering
        # Sort by is_primary DESC so primary folder is first, then by order_position
        folder_joins = document_type.warehouse_folder_document_types
                                    .includes(:warehouse_folder)
                                    .sort_by { |wfdt| [ wfdt.is_primary ? 0 : 1, wfdt.warehouse_folder&.order_position || 999 ] }

        warehouse_folders_data = folder_joins.filter_map do |wfdt|
          tab = wfdt.warehouse_folder
          next unless tab

          {
            id: tab.id,
            tab_key: tab.tab_key,
            display_name: tab.display_name,
            hierarchy_path: tab.hierarchy_path,
            parent_id: tab.parent_id,
            parent_name: tab.parent&.display_name,
            is_primary: wfdt.is_primary
          }
        end

        primary_tab_data = warehouse_folders_data.find { |f| f[:is_primary] } || warehouse_folders_data.first

        {
          id: document_type.id,
          name: document_type.name,
          uiName: document_type.ui_name,
          abbreviation: document_type.abbreviation,
          downloadName: document_type.download_name,
          title_preview: document_type.title_preview,
          category: document_type.category,
          folder: document_type.folder,
          description: document_type.description,
          requires_filing: document_type.requires_filing,
          retention_years: document_type.retention_years,
          active: document_type.active,
          # Legacy tabs array (for backwards compatibility)
          tabs: document_type.tabs || [],
          primary_tab: document_type.primary_tab,
          # SSoT: WarehouseFolder data (backwards compatible field names)
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
          scope: document_type.scope,
          file_extensions: document_type.file_extensions || [],
          target_folder: document_type.target_folder,
          form_number_mapping: document_type.form_number_mapping || {},
          supports_versioning: document_type.supports_versioning,
          generates_certificate: document_type.generates_certificate || false,
          certificate_template: document_type.certificate_template,
          signature_field_config: document_type.signature_field_config || [],
          documents_count: 0,  # Table dropped (Jan 2026) - use WarehouseDocument
          created_at: document_type.created_at,
          updated_at: document_type.updated_at
        }
      end

      def document_type_summary
        {
          total: DocumentType.count,
          # SSoT: category column removed (Jan 2026) - use folder for grouping
          by_folder: DocumentType.group(:folder).count,
          requiring_filing: DocumentType.requiring_filing.count
        }
      end

      def all_available_tabs
        # SSoT: Get all document tabs from WarehouseFolder (replaces old DocumentFolder)
        WarehouseFolder.for_warehouse_type('corporate')
                 .for_group('documents')
                 .enabled
                 .root_tabs
                 .ordered
                 .includes(children: :children)
                 .map do |tab|
          {
            id: tab.id,
            name: tab.display_name,
            tab_key: tab.tab_key,
            label: tab.display_name,
            description: tab.description,
            parent_id: tab.parent_id,
            entity_types: tab.entity_filters,
            document_type_count: tab.document_types.count,
            children: tab.children.enabled.ordered.map do |child|
              {
                id: child.id,
                name: child.display_name,
                tab_key: child.tab_key,
                label: child.display_name,
                description: child.description,
                parent_id: child.parent_id,
                parent_name: tab.display_name,
                entity_types: child.entity_filters,
                document_type_count: child.document_types.count,
                children: child.children.enabled.ordered.map do |grandchild|
                  {
                    id: grandchild.id,
                    name: grandchild.display_name,
                    tab_key: grandchild.tab_key,
                    label: grandchild.display_name,
                    description: grandchild.description,
                    parent_id: grandchild.parent_id,
                    parent_name: child.display_name,
                    entity_types: grandchild.entity_filters,
                    document_type_count: grandchild.document_types.count
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
