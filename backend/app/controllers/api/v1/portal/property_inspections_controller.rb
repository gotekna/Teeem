module Api
  module V1
    module Portal
      class PropertyInspectionsController < BaseController
        before_action :require_property_portal
        before_action :set_inspection, only: [:show, :sign, :comment, :download_report]

        # GET /api/v1/portal/property/inspections
        def index
          inspections = current_portal_user.accessible_inspections
            .includes(:property, :inspector_contact, :tenancy)
            .order(scheduled_date: :desc)

          render json: {
            success: true,
            data: inspections.map { |i| inspection_detail(i) },
          }
        end

        # GET /api/v1/portal/property/inspections/:id
        def show
          rooms = @inspection.inspection_rooms
            .includes(inspection_items: { inspection_photos: :storage_blob })
            .order(:sort_order)

          render json: {
            success: true,
            data: inspection_detail(@inspection).merge(
              rooms: rooms.map { |room| room_detail(room) },
            ),
          }
        end

        # POST /api/v1/portal/property/inspections/:id/sign
        def sign
          signature_data = params[:signature_data]
          signer_name = params[:signer_name]

          unless signature_data.present?
            render json: { success: false, error: "Signature is required" }, status: :unprocessable_entity
            return
          end

          # Decode base64 signature and create StorageBlob
          image_data = Base64.decode64(signature_data.sub(/^data:image\/png;base64,/, ""))
          blob = StorageBlob.find_or_create_for_content!(
            content: image_data,
            filename: "tenant_signature_#{@inspection.id}.png",
            content_type: "image/png"
          )

          @inspection.update!(tenant_signature_blob_id: blob.id)

          render json: {
            success: true,
            message: "Inspection signed successfully",
            data: { signed: true, signed_at: Time.current },
          }
        end

        # POST /api/v1/portal/property/inspections/:id/comment
        def comment
          item_id = params[:inspection_item_id]
          comment_text = params[:comment]

          unless comment_text.present?
            render json: { success: false, error: "Comment is required" }, status: :unprocessable_entity
            return
          end

          if item_id.present?
            item = @inspection.inspection_items.find(item_id)
            existing_notes = item.notes || ""
            portal_comment = "[#{current_portal_user.contact.display_name} - #{Time.current.strftime('%d/%m/%Y')}]: #{comment_text}"
            item.update!(notes: [existing_notes, portal_comment].compact_blank.join("\n\n"))
          else
            existing_notes = @inspection.notes || ""
            portal_comment = "[#{current_portal_user.contact.display_name} - #{Time.current.strftime('%d/%m/%Y')}]: #{comment_text}"
            @inspection.update!(notes: [existing_notes, portal_comment].compact_blank.join("\n\n"))
          end

          render json: { success: true, message: "Comment added" }
        end

        # GET /api/v1/portal/property/inspections/:id/download_report
        def download_report
          unless @inspection.respond_to?(:report_blob) && @inspection.report_blob.present?
            render json: { success: false, error: "Report not available" }, status: :not_found
            return
          end

          url = @inspection.report_blob.download_url
          render json: { success: true, data: { download_url: url } }
        end

        private

        def require_property_portal
          unless current_portal_user&.property_portal?
            render json: { success: false, error: "Property portal access required" }, status: :forbidden
          end
        end

        def set_inspection
          @inspection = current_portal_user.accessible_inspections.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Inspection not found" }, status: :not_found
        end

        def inspection_detail(inspection)
          {
            id: inspection.id,
            inspection_type: inspection.inspection_type,
            inspection_number: inspection.respond_to?(:inspection_number) ? inspection.inspection_number : nil,
            status: inspection.status,
            scheduled_date: inspection.scheduled_date,
            completed_date: inspection.completed_date,
            overall_condition: inspection.overall_condition,
            notes: inspection.notes,
            inspector: inspection.inspector_contact&.display_name,
            property: {
              id: inspection.property_id,
              name: inspection.property&.name,
              address: inspection.property&.full_address,
            },
            has_report: inspection.respond_to?(:has_report?) ? inspection.has_report? : false,
            signed_by_tenant: inspection.respond_to?(:signed_by_tenant?) ? inspection.signed_by_tenant? : false,
            signed_by_inspector: inspection.respond_to?(:signed_by_inspector?) ? inspection.signed_by_inspector? : false,
          }
        end

        def room_detail(room)
          {
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            overall_condition: room.overall_condition,
            notes: room.notes,
            items: room.inspection_items.order(:sort_order).map { |item| item_detail(item) },
          }
        end

        def item_detail(item)
          {
            id: item.id,
            name: item.name,
            condition: item.condition,
            entry_condition: item.entry_condition,
            is_clean: item.is_clean,
            is_working: item.is_working,
            action_required: item.action_required,
            notes: item.notes,
            photos: item.inspection_photos.order(:sort_order).map do |photo|
              {
                id: photo.id,
                caption: photo.caption,
                url: photo.display_blob&.download_url,
                taken_at: photo.taken_at,
              }
            end,
          }
        end
      end
    end
  end
end
