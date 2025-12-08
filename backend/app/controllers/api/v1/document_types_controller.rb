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
        if @document_type.company_documents.any?
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
          :naming_format,
          :abbreviation,
          :scope,
          :target_folder,
          tabs: [],
          file_extensions: []
        )
      end

      def serialize_document_type(document_type)
        {
          id: document_type.id,
          name: document_type.name,
          display_name: document_type.display_name,
          abbreviation: document_type.abbreviation,
          naming_format: document_type.naming_format,
          title_preview: document_type.title_preview,
          category: document_type.category,
          folder: document_type.folder,
          description: document_type.description,
          requires_filing: document_type.requires_filing,
          retention_years: document_type.retention_years,
          active: document_type.active,
          tabs: document_type.tabs || [],
          primary_tab: document_type.primary_tab,
          scope: document_type.scope,
          file_extensions: document_type.file_extensions || [],
          target_folder: document_type.target_folder,
          documents_count: document_type.company_documents.count,
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
        # Get all unique primary_tab values from document types
        tabs = DocumentType.where.not(primary_tab: nil).distinct.pluck(:primary_tab).compact.sort

        # Return structured tab information
        tabs.map do |tab|
          {
            name: tab,
            label: tab.titleize,
            count: DocumentType.where(primary_tab: tab).count
          }
        end
      end
    end
  end
end
