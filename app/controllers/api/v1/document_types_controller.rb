module Api
  module V1
    class DocumentTypesController < ApplicationController
      before_action :set_document_type, only: [ :show, :update, :destroy ]

      # GET /api/v1/document_types
      def index
        @document_types = DocumentType.all

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
          render json: {
            success: true,
            data: DocumentType.grouped_by_folder.transform_values { |types|
              types.map { |t| serialize_document_type(t) }
            }
          }
        else
          render json: {
            success: true,
            data: @document_types.order(:folder, :name).map { |t| serialize_document_type(t) },
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
        @document_type = DocumentType.new(document_type_params)

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
        if @document_type.update(document_type_params)
          render json: {
            success: true,
            data: serialize_document_type(@document_type)
          }
        else
          render json: {
            success: false,
            errors: @document_type.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/document_types/:id
      def destroy
        if @document_type.corporate_company_documents.any?
          return render json: {
            success: false,
            errors: [ "Cannot delete document type with existing documents" ]
          }, status: :unprocessable_entity
        end

        @document_type.destroy
        render json: { success: true }
      end

      private

      def set_document_type
        @document_type = DocumentType.find(params[:id])
      end

      def document_type_params
        params.require(:document_type).permit(
          :name,
          :display_name,
          :category,
          :folder,
          :description,
          :requires_filing,
          :retention_years,
          :active,
          :primary_tab,
          :file_name,
          :abbreviation,
          :scope,
          :target_folder,
          tabs: [],
          file_extensions: [],
          folder_ids: []
        )
      end

      def serialize_document_type(document_type)
        # Get folder data from join table
        folder_assignments = document_type.document_type_folders.includes(:document_folder)
        primary_assignment = folder_assignments.find(&:is_primary)

        {
          id: document_type.id,
          name: document_type.name,
          display_name: document_type.display_name,
          abbreviation: document_type.abbreviation,
          file_name: document_type.file_name,
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
          # New folder lookup data
          folder_ids: folder_assignments.map { |fa| fa.document_folder_id },
          folders: folder_assignments.map { |fa|
            {
              id: fa.document_folder.id,
              name: fa.document_folder.name,
              is_primary: fa.is_primary,
              parent_id: fa.document_folder.parent_id,
              parent_name: fa.document_folder.parent_name
            }
          },
          primary_folder_id: primary_assignment&.document_folder_id,
          primary_folder_name: primary_assignment&.document_folder&.name,
          scope: document_type.scope,
          file_extensions: document_type.file_extensions || [],
          target_folder: document_type.target_folder,
          documents_count: document_type.corporate_company_documents.count,
          created_at: document_type.created_at,
          updated_at: document_type.updated_at
        }
      end

      def document_type_summary
        {
          total: DocumentType.count,
          by_category: DocumentType.group(:category).count,
          by_folder: DocumentType.group(:folder).count,
          requiring_filing: DocumentType.requiring_filing.count
        }
      end

      def all_available_tabs
        # Get all folders from DocumentFolder table with hierarchy
        DocumentFolder.active.root_folders.ordered.map do |folder|
          {
            id: folder.id,
            name: folder.name,
            label: folder.name.titleize,
            description: folder.description,
            parent_id: folder.parent_id,
            entity_types: folder.entity_types,
            document_type_count: folder.document_types.count,
            children: folder.children.active.ordered.map do |child|
              {
                id: child.id,
                name: child.name,
                label: child.name.titleize,
                description: child.description,
                parent_id: child.parent_id,
                parent_name: folder.name,
                entity_types: child.entity_types,
                document_type_count: child.document_types.count
              }
            end
          }
        end
      end
    end
  end
end
