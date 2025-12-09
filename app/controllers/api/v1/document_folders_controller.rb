module Api
  module V1
    class DocumentFoldersController < ApplicationController
      before_action :set_document_folder, only: [:show, :update, :destroy]

      # GET /api/v1/document_folders
      def index
        @folders = DocumentFolder.ordered

        # Filter by entity type if provided
        if params[:entity_type].present?
          @folders = @folders.for_entity_type(params[:entity_type])
        end

        # Filter by active status if provided
        if params[:active].present?
          @folders = params[:active] == "true" ? @folders.active : @folders.where(active: false)
        end

        render json: {
          success: true,
          data: @folders.map { |f| serialize_folder(f) }
        }
      end

      # GET /api/v1/document_folders/:id
      def show
        render json: {
          success: true,
          data: serialize_folder(@folder)
        }
      end

      # POST /api/v1/document_folders
      def create
        @folder = DocumentFolder.new(folder_params)

        if @folder.save
          render json: {
            success: true,
            data: serialize_folder(@folder)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @folder.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/document_folders/:id
      def update
        if @folder.update(folder_params)
          render json: {
            success: true,
            data: serialize_folder(@folder)
          }
        else
          render json: {
            success: false,
            errors: @folder.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/document_folders/:id
      def destroy
        @folder.destroy
        render json: { success: true }
      end

      # POST /api/v1/document_folders/reorder
      def reorder
        params[:folders].each_with_index do |folder_data, index|
          folder = DocumentFolder.find(folder_data[:id])
          folder.update(order_position: index)
        end

        render json: {
          success: true,
          data: DocumentFolder.ordered.map { |f| serialize_folder(f) }
        }
      end

      private

      def set_document_folder
        @folder = DocumentFolder.find(params[:id])
      end

      def folder_params
        params.require(:folder).permit(:name, :description, :order_position, :active, entity_types: [])
      end

      def serialize_folder(folder)
        {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          order_position: folder.order_position,
          entity_types: folder.entity_types,
          active: folder.active,
          created_at: folder.created_at,
          updated_at: folder.updated_at
        }
      end
    end
  end
end
