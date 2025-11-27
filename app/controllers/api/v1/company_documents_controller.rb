module Api
  module V1
    class CompanyDocumentsController < ApplicationController
      before_action :set_document, only: [:show, :update, :destroy, :download]

      # GET /api/v1/company_documents
      def index
        @documents = CompanyDocument.includes(:company, :user).all

        # Filter by company
        @documents = @documents.where(company_id: params[:company_id]) if params[:company_id].present?

        # Filter by type
        @documents = @documents.by_type(params[:document_type]) if params[:document_type].present?

        # Filter by year
        @documents = @documents.by_year(params[:year]) if params[:year].present?

        # Sort
        @documents = @documents.order(created_at: :desc)

        render json: {
          success: true,
          documents: @documents.as_json(
            include: {
              company: { only: [:id, :name] },
              user: { only: [:id, :name, :email] }
            },
            methods: [:formatted_document_type, :file_size_mb]
          )
        }
      end

      # GET /api/v1/company_documents/:id
      def show
        render json: {
          success: true,
          document: @document.as_json(
            include: {
              company: { only: [:id, :name] },
              user: { only: [:id, :name, :email] }
            },
            methods: [:formatted_document_type, :file_size_mb]
          )
        }
      end

      # POST /api/v1/company_documents
      def create
        @document = CompanyDocument.new(document_params)
        @document.user = current_user

        # Handle file upload via Active Storage
        if params[:file].present?
          @document.file.attach(params[:file])
          @document.file_name = params[:file].original_filename
          @document.file_size = params[:file].size
          @document.mime_type = params[:file].content_type
        end

        if @document.save
          render json: {
            success: true,
            message: 'Document uploaded successfully',
            document: @document.as_json(methods: [:formatted_document_type])
          }, status: :created
        else
          render json: {
            success: false,
            errors: @document.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/company_documents/:id
      def update
        if @document.update(document_params)
          render json: {
            success: true,
            message: 'Document updated successfully',
            document: @document.as_json(methods: [:formatted_document_type])
          }
        else
          render json: {
            success: false,
            errors: @document.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/company_documents/:id
      def destroy
        @document.destroy
        render json: {
          success: true,
          message: 'Document deleted successfully'
        }
      end

      # GET /api/v1/company_documents/:id/download
      def download
        if @document.file.attached?
          redirect_to rails_blob_path(@document.file, disposition: "attachment")
        elsif @document.file_url.present?
          redirect_to @document.file_url
        else
          render json: {
            success: false,
            error: 'No file available for download'
          }, status: :not_found
        end
      end

      private

      def set_document
        @document = CompanyDocument.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Document not found' }, status: :not_found
      end

      def document_params
        params.require(:company_document).permit(
          :company_id, :document_name, :document_type, :description,
          :file_url, :year, :period
        )
      end
    end
  end
end
