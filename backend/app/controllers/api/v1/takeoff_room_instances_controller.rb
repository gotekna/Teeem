# frozen_string_literal: true

module Api
  module V1
    # TakeoffRoomInstancesController - CRUD for room instances + slot operations
    #
    # Room instances are applied templates (e.g., "Bathroom 1") with pre-built
    # measurement slots. Slots can be filled by linking measurements, and
    # purchase orders can be generated from filled slots.
    #
    class TakeoffRoomInstancesController < ApplicationController
      before_action :set_job_plan, only: [:index_for_plan, :create_for_plan]
      before_action :set_docsort_item, only: [:index_for_docsort, :create_for_docsort]
      before_action :set_room, only: [:show, :update, :destroy, :fill_slot, :clear_slot, :update_slot, :generate_po]
      before_action :set_slot, only: [:fill_slot, :clear_slot, :update_slot]

      # GET /api/v1/pdf_takeoff/plans/:job_plan_id/rooms
      def index_for_plan
        rooms = TakeoffRoomInstance.for_job_plan(@job_plan).ordered
                                   .includes(slots: :pricebook_item)
        render json: { success: true, data: rooms.map(&:as_json) }
      end

      # GET /api/v1/pdf_takeoff/docsort/:docsort_item_id/rooms
      def index_for_docsort
        rooms = TakeoffRoomInstance.for_docsort_item(@docsort_item).ordered
                                   .includes(slots: :pricebook_item)
        render json: { success: true, data: rooms.map(&:as_json) }
      end

      # POST /api/v1/pdf_takeoff/plans/:job_plan_id/rooms
      def create_for_plan
        template = TakeoffTemplate.find(params[:template_id])
        name = params[:name] || auto_name(template, :job_plan)

        room = TakeoffRoomInstance.new(
          tenant: current_tenant,
          takeoff_template: template,
          job: @job_plan.job,
          job_plan: @job_plan,
          name: name,
          created_by: current_user
        )

        if room.save
          template.record_usage!
          render json: { success: true, data: room.as_json }, status: :created
        else
          render json: { success: false, error: room.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/pdf_takeoff/docsort/:docsort_item_id/rooms
      def create_for_docsort
        template = TakeoffTemplate.find(params[:template_id])
        name = params[:name] || auto_name(template, :docsort)

        room = TakeoffRoomInstance.new(
          tenant: current_tenant,
          takeoff_template: template,
          docsort_item: @docsort_item,
          name: name,
          created_by: current_user
        )

        if room.save
          template.record_usage!
          render json: { success: true, data: room.as_json }, status: :created
        else
          render json: { success: false, error: room.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/pdf_takeoff/rooms/:id
      def show
        render json: { success: true, data: @room.as_json }
      end

      # PATCH /api/v1/pdf_takeoff/rooms/:id
      def update
        if @room.update(room_params)
          render json: { success: true, data: @room.as_json }
        else
          render json: { success: false, error: @room.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/pdf_takeoff/rooms/:id
      def destroy
        # Clear backlinks on measurements before destroying
        @room.slots.where.not(measurement_id: nil).find_each do |slot|
          slot.measurement&.update(takeoff_room_slot_id: nil)
        end
        @room.destroy!
        render json: { success: true }
      end

      # POST /api/v1/pdf_takeoff/rooms/:id/slots/:slot_id/fill
      def fill_slot
        measurement = UnrealMeasurement.find(params[:measurement_id])

        # Clear any previous slot this measurement was linked to
        if measurement.takeoff_room_slot_id.present? && measurement.takeoff_room_slot_id != @slot.id
          old_slot = TakeoffRoomSlot.find_by(id: measurement.takeoff_room_slot_id)
          old_slot&.clear!
        end

        @slot.fill!(measurement)
        render json: { success: true, data: @room.reload.as_json }
      end

      # DELETE /api/v1/pdf_takeoff/rooms/:id/slots/:slot_id/fill
      def clear_slot
        @slot.clear!
        render json: { success: true, data: @room.reload.as_json }
      end

      # PATCH /api/v1/pdf_takeoff/rooms/:id/slots/:slot_id
      def update_slot
        if @slot.update(slot_params)
          render json: { success: true, data: @room.reload.as_json }
        else
          render json: { success: false, error: @slot.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/pdf_takeoff/rooms/:id/generate_po
      def generate_po
        job = @room.job || @room.job_plan&.job

        unless job
          return render json: {
            success: false,
            error: "Room must be linked to a job to generate a PO"
          }, status: :unprocessable_entity
        end

        pos = @room.generate_purchase_order!(job: job, tenant: current_tenant)

        render json: {
          success: true,
          data: {
            purchase_orders: pos.map { |po|
              {
                id: po.id,
                supplier_name: po.supplier&.name || "No Supplier",
                line_items_count: po.line_items.count,
                total: po.line_items.sum(:total_price).round(2)
              }
            },
            room_name: @room.name
          }
        }
      rescue StandardError => e
        Rails.logger.error "[RoomTakeoff] Generate PO failed: #{e.message}"
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      private

      def set_job_plan
        @job_plan = JobPlan.find(params[:job_plan_id])
      end

      def set_docsort_item
        @docsort_item = DocsortItem.find(params[:docsort_item_id])
        unless @docsort_item.tenant_id == current_tenant.id
          render json: { success: false, error: "Access denied" }, status: :forbidden
        end
      end

      def set_room
        @room = TakeoffRoomInstance.find(params[:id])
      end

      def set_slot
        @slot = @room.slots.find(params[:slot_id])
      end

      def room_params
        params.permit(:name, :status, :notes)
      end

      def slot_params
        params.permit(:pricebook_item_id)
      end

      # Auto-generate instance name: "Bathroom 1", "Bathroom 2", etc.
      def auto_name(template, scope_type)
        existing = if scope_type == :job_plan
                     TakeoffRoomInstance.where(job_plan: @job_plan, takeoff_template: template)
                   else
                     TakeoffRoomInstance.where(docsort_item: @docsort_item, takeoff_template: template)
                   end

        count = existing.count + 1
        "#{template.name} #{count}"
      end
    end
  end
end
