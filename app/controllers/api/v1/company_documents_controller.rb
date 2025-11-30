module Api
  module V1
    class CompanyDocumentsController < ApplicationController
      before_action :set_document, only: [:show, :update, :destroy, :download, :validate]

      # GET /api/v1/company_documents
      def index
        @documents = CompanyDocument.includes(:company, :user, :asset).all

        # Filter by company
        @documents = @documents.where(company_id: params[:company_id]) if params[:company_id].present?

        # Filter by contact (for family member documents)
        @documents = @documents.where(contact_id: params[:contact_id]) if params[:contact_id].present?

        # Filter by asset
        @documents = @documents.by_asset(params[:asset_id]) if params[:asset_id].present?

        # Filter by with/without asset
        @documents = @documents.with_asset if params[:with_asset] == 'true'
        @documents = @documents.without_asset if params[:without_asset] == 'true'

        # Filter by type
        @documents = @documents.by_type(params[:document_type]) if params[:document_type].present?

        # Filter by tab
        @documents = @documents.by_tab(params[:tab]) if params[:tab].present?

        # Filter by source (manual, xero, sharepoint)
        @documents = @documents.by_source(params[:source]) if params[:source].present?

        # Filter by year
        @documents = @documents.by_year(params[:year]) if params[:year].present?

        # Filter by financial year (supports documents spanning multiple years)
        @documents = @documents.by_financial_year(params[:financial_year]) if params[:financial_year].present?

        # Sort
        @documents = @documents.order(created_at: :desc)

        render json: {
          success: true,
          documents: @documents.as_json(
            include: {
              company: { only: [:id, :name, :code] },
              user: { only: [:id, :name, :email] },
              asset: { only: [:id, :name, :description, :abbreviation], methods: [:display_name] }
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
              company: { only: [:id, :name, :code] },
              user: { only: [:id, :name, :email] },
              asset: { only: [:id, :name, :description, :abbreviation], methods: [:display_name] }
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

      # POST /api/v1/company_documents/:id/validate
      # User validates that the document naming is correct
      def validate
        @document.update!(
          user_validated_at: Time.current,
          user_validated_by: current_user,
          validation_required: false,
          ai_verification_status: 'verified'
        )

        render json: {
          success: true,
          message: 'Document validated successfully',
          document: @document.as_json(
            include: {
              company: { only: [:id, :name, :code] },
              user: { only: [:id, :name, :email] }
            },
            methods: [:formatted_document_type, :file_size_mb]
          )
        }
      end

      private

      def set_document
        @document = CompanyDocument.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Document not found' }, status: :not_found
      end

      def document_params
        params.require(:company_document).permit(
          :company_id, :contact_id, :asset_id, :document_type_id, :title, :document_name,
          :document_type, :description, :file_url, :year, :period, :folder,
          :storage_type, :source, :file_name, :file_size, :mime_type,
          financial_years: []
        )
      end
    end
  end
end
