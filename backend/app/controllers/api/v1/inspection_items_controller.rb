module Api
  module V1
    class InspectionItemsController < ApplicationController
      before_action :set_room
      before_action :set_item, only: [:show, :update, :destroy]

      # GET /api/v1/inspection_rooms/:inspection_room_id/inspection_items
      def index
        items = @room.inspection_items.includes(inspection_photos: :storage_blob).ordered
        render_success(items.as_json(include: {
          inspection_photos: {
            include: { storage_blob: { only: [:id, :storage_path, :content_type, :file_size] } }
          }
        }))
      end

      # GET /api/v1/inspection_rooms/:inspection_room_id/inspection_items/:id
      def show
        render_success(@item.as_json(include: {
          inspection_photos: {
            include: { storage_blob: { only: [:id, :storage_path, :content_type, :file_size] } }
          }
        }))
      end

      # POST /api/v1/inspection_rooms/:inspection_room_id/inspection_items
      def create
        item = @room.inspection_items.build(item_params)
        item.tenant_id = current_tenant.id
        item.sort_order ||= @room.inspection_items.maximum(:sort_order).to_i + 1

        if item.save
          render_success(item, status: :created)
        else
          render_validation_errors(item)
        end
      end

      # PATCH /api/v1/inspection_rooms/:inspection_room_id/inspection_items/:id
      def update
        if @item.update(item_params)
          render_success(@item)
        else
          render_validation_errors(@item)
        end
      end

      # DELETE /api/v1/inspection_rooms/:inspection_room_id/inspection_items/:id
      def destroy
        @item.destroy
        render_success
      end

      # PATCH /api/v1/inspection_rooms/:inspection_room_id/inspection_items/bulk_update
      def bulk_update
        updates = params.require(:items).map do |item_params|
          item_params.permit(:id, :condition, :is_clean, :is_working, :action_required, :notes)
        end

        errors = []
        updated_items = []

        updates.each do |update_params|
          item = @room.inspection_items.find_by(id: update_params[:id])
          next unless item

          if item.update(update_params.except(:id))
            updated_items << item
          else
            errors << { id: item.id, errors: item.errors.full_messages }
          end
        end

        if errors.empty?
          render_success(updated_items)
        else
          render json: { success: false, errors: errors }, status: :unprocessable_entity
        end
      end

      private

      def set_room
        @room = InspectionRoom.find(params[:inspection_room_id])
      end

      def set_item
        @item = @room.inspection_items.find(params[:id])
      end

      def item_params
        params.require(:inspection_item).permit(
          :name, :condition, :entry_condition, :notes,
          :is_clean, :is_working, :action_required, :sort_order
        )
      end
    end
  end
end
