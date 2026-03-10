module Api
  module V1
    class InspectionPhotosController < ApplicationController
      before_action :set_item
      before_action :set_photo, only: [:destroy, :annotate]

      # GET /api/v1/inspection_items/:inspection_item_id/inspection_photos
      def index
        photos = @item.inspection_photos.includes(:storage_blob, :annotated_blob).ordered
        render_success(photos.as_json(include: {
          storage_blob: { only: [:id, :storage_path, :content_type, :file_size] },
          annotated_blob: { only: [:id, :storage_path, :content_type, :file_size] }
        }))
      end

      # POST /api/v1/inspection_items/:inspection_item_id/inspection_photos
      def create
        file = params[:file]
        unless file
          return render json: { success: false, error: "No file provided" }, status: :unprocessable_entity
        end

        blob = StorageBlob.find_or_create_for_content!(
          content: file.read,
          filename: file.original_filename,
          content_type: file.content_type,
          tenant_id: current_tenant.id
        )

        photo = @item.inspection_photos.build(
          tenant_id: current_tenant.id,
          storage_blob: blob,
          caption: params[:caption],
          taken_at: params[:taken_at] || Time.current,
          latitude: params[:latitude],
          longitude: params[:longitude],
          sort_order: @item.inspection_photos.maximum(:sort_order).to_i + 1
        )

        if photo.save
          # Create WarehouseDocument for the photo
          inspection = @item.inspection_room.property_inspection
          WarehouseDocumentCreator.create!(
            filename: file.original_filename,
            source_type: "warehouse",
            storage_blob: blob,
            linkable: inspection.property,
            metadata: {
              inspection_id: inspection.id,
              inspection_number: inspection.inspection_number,
              room_name: @item.inspection_room.name,
              item_name: @item.name
            }
          )

          render_success(photo.as_json(include: {
            storage_blob: { only: [:id, :storage_path, :content_type, :file_size] }
          }), status: :created)
        else
          render_validation_errors(photo)
        end
      end

      # DELETE /api/v1/inspection_items/:inspection_item_id/inspection_photos/:id
      def destroy
        @photo.destroy
        render_success
      end

      # POST /api/v1/inspection_items/:inspection_item_id/inspection_photos/:id/annotate
      def annotate
        annotated_data = params[:annotated_image]
        annotations_json = params[:annotations_json]

        unless annotated_data
          return render json: { success: false, error: "No annotated image provided" }, status: :unprocessable_entity
        end

        # Decode base64 image
        image_data = Base64.decode64(annotated_data.sub(/^data:image\/\w+;base64,/, ""))

        blob = StorageBlob.find_or_create_for_content!(
          content: image_data,
          filename: "annotated_#{@photo.storage_blob.original_filename || 'photo.png'}",
          content_type: "image/png",
          tenant_id: current_tenant.id
        )

        if @photo.update(annotated_blob: blob, annotations_json: annotations_json || {})
          render_success(@photo.as_json(include: {
            storage_blob: { only: [:id, :storage_path, :content_type, :file_size] },
            annotated_blob: { only: [:id, :storage_path, :content_type, :file_size] }
          }))
        else
          render_validation_errors(@photo)
        end
      end

      private

      def set_item
        @item = InspectionItem.find(params[:inspection_item_id])
      end

      def set_photo
        @photo = @item.inspection_photos.find(params[:id])
      end
    end
  end
end
