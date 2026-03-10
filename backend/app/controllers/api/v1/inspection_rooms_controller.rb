module Api
  module V1
    class InspectionRoomsController < ApplicationController
      before_action :set_inspection
      before_action :set_room, only: [:show, :update, :destroy, :duplicate]

      # GET /api/v1/property_inspections/:property_inspection_id/inspection_rooms
      def index
        rooms = @inspection.inspection_rooms
                            .includes(inspection_items: { inspection_photos: :storage_blob })
                            .ordered

        render_success(rooms.as_json(include: {
          inspection_items: {
            include: {
              inspection_photos: {
                include: { storage_blob: { only: [:id, :storage_path, :content_type, :file_size] } },
                methods: [:annotated?]
              }
            }
          }
        }))
      end

      # GET /api/v1/property_inspections/:property_inspection_id/inspection_rooms/:id
      def show
        render_success(@room.as_json(include: {
          inspection_items: {
            include: {
              inspection_photos: {
                include: { storage_blob: { only: [:id, :storage_path, :content_type, :file_size] } }
              }
            }
          }
        }))
      end

      # POST /api/v1/property_inspections/:property_inspection_id/inspection_rooms
      def create
        room = @inspection.inspection_rooms.build(room_params)
        room.tenant_id = current_tenant.id
        room.sort_order ||= @inspection.inspection_rooms.maximum(:sort_order).to_i + 1

        if room.save
          render_success(room, status: :created)
        else
          render_validation_errors(room)
        end
      end

      # PATCH /api/v1/property_inspections/:property_inspection_id/inspection_rooms/:id
      def update
        if @room.update(room_params)
          render_success(@room)
        else
          render_validation_errors(@room)
        end
      end

      # DELETE /api/v1/property_inspections/:property_inspection_id/inspection_rooms/:id
      def destroy
        @room.destroy
        render_success
      end

      # POST /api/v1/property_inspections/:property_inspection_id/inspection_rooms/:id/duplicate
      def duplicate
        new_room = @room.duplicate!
        render_success(new_room.as_json(include: { inspection_items: {} }), status: :created)
      end

      private

      def set_inspection
        @inspection = PropertyInspection.find(params[:property_inspection_id])
      end

      def set_room
        @room = @inspection.inspection_rooms.find(params[:id])
      end

      def room_params
        params.require(:inspection_room).permit(:name, :room_type, :sort_order, :overall_condition, :notes)
      end
    end
  end
end
