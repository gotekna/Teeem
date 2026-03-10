module Api
  module V1
    class PropertyInspectionsController < ApplicationController
      before_action :set_inspection, only: [
        :show, :update, :destroy, :complete,
        :start, :generate_report, :send_report, :generate_portal_link, :sign
      ]

      # GET /api/v1/property_inspections
      def index
        inspections = PropertyInspection.includes(:property, :tenancy, :inspector_contact)
                                        .order(scheduled_date: :desc)
        inspections = inspections.where(property_id: params[:property_id]) if params[:property_id].present?
        inspections = inspections.where(status: params[:status]) if params[:status].present?
        inspections = inspections.where(inspection_type: params[:type]) if params[:type].present?

        render_success(inspections.as_json(
          include: {
            property: { only: [:id, :name, :property_code] },
            inspector_contact: { only: [:id, :display_name] }
          },
          methods: [:completion_percentage, :action_items_count, :has_report?]
        ))
      end

      # GET /api/v1/property_inspections/:id
      def show
        inspection_json = @inspection.as_json(
          include: {
            property: { only: [:id, :name, :property_code] },
            tenancy: { only: [:id, :status] },
            inspector_contact: { only: [:id, :display_name, :email, :phone] },
            inspection_rooms: {
              include: {
                inspection_items: {
                  include: {
                    inspection_photos: {
                      include: {
                        storage_blob: { only: [:id, :storage_path, :content_type, :file_size] },
                        annotated_blob: { only: [:id, :storage_path, :content_type, :file_size] }
                      }
                    }
                  }
                }
              }
            }
          },
          methods: [:completion_percentage, :action_items_count, :has_report?, :signed_by_inspector?, :signed_by_tenant?]
        )

        render_success(inspection_json)
      end

      # POST /api/v1/property_inspections
      def create
        inspection = PropertyInspection.new(inspection_params)

        if inspection.save
          # Apply room template if provided
          if params[:template_id].present?
            template = InspectionRoomTemplate.find(params[:template_id])
            inspection.create_rooms_from_template!(template)
          end

          # For exit inspections, populate entry conditions from latest entry inspection
          if inspection.inspection_type == "exit" && params[:entry_inspection_id].present?
            entry = PropertyInspection.find(params[:entry_inspection_id])
            inspection.populate_entry_conditions_from(entry)
          end

          render_success(inspection.reload.as_json(
            include: { inspection_rooms: { include: { inspection_items: {} } } }
          ), status: :created)
        else
          render_validation_errors(inspection)
        end
      end

      # PATCH /api/v1/property_inspections/:id
      def update
        if @inspection.update(inspection_params)
          render_success(@inspection)
        else
          render_validation_errors(@inspection)
        end
      end

      # DELETE /api/v1/property_inspections/:id
      def destroy
        @inspection.destroy
        render_success
      end

      # PATCH /api/v1/property_inspections/:id/complete
      def complete
        if @inspection.update(
          status: "completed",
          completed_date: params[:completed_date] || Date.current,
          completed_at: Time.current,
          overall_condition: params[:overall_condition] || @inspection.send(:calculate_overall_condition),
          notes: params[:notes].presence || @inspection.notes
        )
          render_success(@inspection)
        else
          render_validation_errors(@inspection)
        end
      end

      # PATCH /api/v1/property_inspections/:id/start
      def start
        @inspection.start!
        render_success(@inspection)
      rescue => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/property_inspections/:id/generate_report
      def generate_report
        # Enqueue PDF generation job (Ch5 will implement GenerateInspectionReportJob)
        # For now, return a placeholder response
        render_success({ status: "queued", message: "Report generation started" })
      end

      # POST /api/v1/property_inspections/:id/send_report
      def send_report
        recipients = params[:recipients]
        unless recipients.present?
          return render json: { success: false, error: "No recipients provided" }, status: :unprocessable_entity
        end

        unless @inspection.has_report?
          return render json: { success: false, error: "Report has not been generated yet" }, status: :unprocessable_entity
        end

        # Enqueue email delivery (Ch6 will implement InspectionReportMailer)
        render_success({ status: "queued", message: "Report email queued for delivery" })
      end

      # POST /api/v1/property_inspections/:id/generate_portal_link
      def generate_portal_link
        token = @inspection.generate_portal_link!
        render_success({ access_token: token, expires_at: @inspection.access_token_expires_at })
      end

      # POST /api/v1/property_inspections/:id/sign
      def sign
        signature_data = params[:signature_data]
        signature_type = params[:signature_type] # "inspector" or "tenant"
        signer_name = params[:signer_name]

        unless signature_data.present? && signature_type.present?
          return render json: { success: false, error: "Missing signature data or type" }, status: :unprocessable_entity
        end

        # Decode base64 signature image
        image_data = Base64.decode64(signature_data.sub(/^data:image\/\w+;base64,/, ""))

        blob = StorageBlob.find_or_create_for_content!(
          content: image_data,
          filename: "signature_#{signature_type}_#{@inspection.inspection_number}.png",
          content_type: "image/png",
          tenant_id: current_tenant.id
        )

        case signature_type
        when "inspector"
          @inspection.update!(inspector_signature_blob: blob)
        when "tenant"
          @inspection.update!(tenant_signature_blob: blob)
        else
          return render json: { success: false, error: "Invalid signature type" }, status: :unprocessable_entity
        end

        render_success(@inspection.as_json(methods: [:signed_by_inspector?, :signed_by_tenant?]))
      end

      private

      def set_inspection
        @inspection = PropertyInspection.find(params[:id])
      end

      def inspection_params
        params.require(:property_inspection).permit(
          :property_id, :tenancy_id,
          :inspection_type, :scheduled_date, :completed_date,
          :inspector_contact_id, :status, :notes,
          :overall_condition, :next_inspection_date,
          :gps_latitude, :gps_longitude
        )
      end
    end
  end
end
