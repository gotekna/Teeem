module Api
  module V1
    class RevisionFormatsController < ApplicationController
      before_action :set_revision_format, only: [:show, :update, :destroy]

      # GET /api/v1/revision_formats
      def index
        @formats = RevisionFormat.all

        render json: {
          success: true,
          data: @formats.map { |f| serialize_format(f) }
        }
      end

      # GET /api/v1/revision_formats/:id
      def show
        render json: {
          success: true,
          data: serialize_format(@format)
        }
      end

      # POST /api/v1/revision_formats
      def create
        @format = RevisionFormat.new(format_params)

        if @format.save
          render json: {
            success: true,
            data: serialize_format(@format)
          }, status: :created
        else
          render json: {
            success: false,
            error: @format.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/revision_formats/:id
      def update
        # Handle setting as default
        if params[:is_default] == true && !@format.is_default
          RevisionFormat.update_all(is_default: false)
        end

        if @format.update(format_params)
          render json: {
            success: true,
            data: serialize_format(@format)
          }
        else
          render json: {
            success: false,
            error: @format.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/revision_formats/:id
      def destroy
        if RevisionFormat.count <= 1
          return render json: {
            success: false,
            error: 'Cannot delete the last revision format.'
          }, status: :unprocessable_entity
        end

        @format.destroy
        render json: { success: true }
      end

      private

      def set_revision_format
        @format = RevisionFormat.find(params[:id])
      end

      def format_params
        params.require(:revision_format).permit(:name, :sequence, :is_default)
      end

      def serialize_format(format)
        {
          id: format.id,
          name: format.name,
          sequence: format.sequence_array,
          is_default: format.is_default,
          created_at: format.created_at,
          updated_at: format.updated_at
        }
      end
    end
  end
end
