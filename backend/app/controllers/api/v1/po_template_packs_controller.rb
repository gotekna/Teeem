# frozen_string_literal: true

module Api
  module V1
    class PoTemplatePacksController < ApplicationController
      before_action :set_pack, only: [:show, :update, :destroy, :apply, :preview, :duplicate]

      # GET /api/v1/po_template_packs
      def index
        packs = PoTemplatePack.active.ordered
          .includes(po_template_items: :po_template_line_items)

        render json: {
          success: true,
          data: packs.map { |pack| pack_json(pack) }
        }
      end

      # GET /api/v1/po_template_packs/:id
      def show
        render json: {
          success: true,
          data: pack_json(@pack, include_line_items: true)
        }
      end

      # POST /api/v1/po_template_packs
      def create
        pack = PoTemplatePack.new(pack_params)
        pack.created_by = current_user

        if pack.save
          render json: { success: true, data: pack_json(pack, include_line_items: true) }, status: :created
        else
          render json: { success: false, error: pack.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/po_template_packs/:id
      def update
        @pack.updated_by = current_user

        if @pack.update(pack_params)
          render json: { success: true, data: pack_json(@pack.reload, include_line_items: true) }
        else
          render json: { success: false, error: @pack.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/po_template_packs/:id
      def destroy
        @pack.update!(is_active: false)
        render json: { success: true }
      end

      # POST /api/v1/po_template_packs/:id/apply
      def apply
        job = Job.find(params[:job_id])
        service = PoTemplateApplyService.new(@pack, job)
        result = service.execute

        if result[:success]
          render json: { success: true, data: result }
        else
          render json: { success: false, errors: result[:errors], warnings: result[:warnings] },
                 status: :unprocessable_entity
        end
      end

      # GET /api/v1/po_template_packs/:id/preview
      def preview
        job = Job.find(params[:job_id])
        service = PoTemplateApplyService.new(@pack, job)
        result = service.preview

        render json: { success: true, data: result }
      end

      # POST /api/v1/po_template_packs/:id/duplicate
      def duplicate
        new_pack = nil

        ActiveRecord::Base.transaction do
          new_pack = @pack.dup
          new_pack.name = "#{@pack.name} (Copy)"
          new_pack.sync_key = nil
          new_pack.created_by = current_user
          new_pack.save!

          @pack.po_template_items.includes(:po_template_line_items).each do |item|
            new_item = item.dup
            new_item.po_template_pack = new_pack
            new_item.sync_key = nil
            new_item.save!

            item.po_template_line_items.each do |line_item|
              new_line = line_item.dup
              new_line.po_template_item = new_item
              new_line.save!
            end
          end
        end

        render json: { success: true, data: pack_json(new_pack.reload, include_line_items: true) }, status: :created
      end

      # POST /api/v1/po_template_packs/create_from_job
      def create_from_job
        job = Job.find(params[:job_id])
        name = params[:name] || "Template from #{job.job_code}"

        pack = nil
        ActiveRecord::Base.transaction do
          pack = PoTemplatePack.create!(
            name: name,
            description: "Auto-generated from #{job.job_code} - #{job.name}",
            created_by: current_user
          )

          pos = PurchaseOrder.where(job_id: job.id)
            .includes(:supplier, :sm_task, :line_items)
            .order(:id)

          pos.each_with_index do |po, idx|
            item = pack.po_template_items.create!(
              name: po.sm_task&.name || po.description || "PO #{po.purchase_order_number}",
              sm_schedule_master_id: po.sm_task&.sm_schedule_master_id,
              supplier_id: po.supplier_id,
              supplier_sync_key: po.supplier&.display_name,
              position: idx,
              budget: po.budget,
              notes: po.description,
              status_on_create: "draft"
            )

            po.line_items.order(:line_number).each do |li|
              item.po_template_line_items.create!(
                description: li.description,
                quantity: li.quantity,
                unit_price: li.unit_price,
                gst_code: li.gst_code,
                pricebook_item_id: li.pricebook_item_id,
                pricebook_item_code: li.pricebook_item&.item_code,
                line_number: li.line_number
              )
            end
          end
        end

        render json: {
          success: true,
          data: pack_json(pack.reload, include_line_items: true),
          message: "Created template pack '#{pack.name}' with #{pack.po_template_items.count} items from #{job.job_code}"
        }, status: :created
      end

      private

      def set_pack
        @pack = PoTemplatePack.find(params[:id])
      end

      def pack_params
        params.require(:po_template_pack).permit(
          :name, :description, :is_active, :position,
          po_template_items_attributes: [
            :id, :name, :sm_schedule_master_id, :supplier_id, :supplier_sync_key,
            :position, :budget, :notes, :status_on_create, :_destroy,
            po_template_line_items_attributes: [
              :id, :description, :quantity, :unit_price, :gst_code,
              :pricebook_item_id, :pricebook_item_code, :line_number, :_destroy
            ]
          ]
        )
      end

      def pack_json(pack, include_line_items: false)
        json = {
          id: pack.id,
          name: pack.name,
          description: pack.description,
          isActive: pack.is_active,
          position: pack.position,
          itemCount: pack.po_template_items.size,
          estimatedTotal: pack.estimated_total,
          createdAt: pack.created_at&.iso8601,
          updatedAt: pack.updated_at&.iso8601,
          items: pack.po_template_items.map { |item| item_json(item, include_line_items: include_line_items) }
        }
        json
      end

      def item_json(item, include_line_items: false)
        json = {
          id: item.id,
          name: item.name,
          smScheduleMasterId: item.sm_schedule_master_id,
          smScheduleMasterName: item.sm_schedule_master&.name,
          supplierId: item.supplier_id,
          supplierName: item.supplier&.display_name,
          supplierSyncKey: item.supplier_sync_key,
          position: item.position,
          budget: item.budget,
          notes: item.notes,
          statusOnCreate: item.status_on_create,
          lineItemCount: item.po_template_line_items.size,
          lineItemTotal: item.line_item_total
        }

        if include_line_items
          json[:lineItems] = item.po_template_line_items.map { |li|
            {
              id: li.id,
              description: li.description,
              quantity: li.quantity.to_f,
              unitPrice: li.unit_price.to_f,
              gstCode: li.gst_code,
              pricebookItemId: li.pricebook_item_id,
              pricebookItemCode: li.pricebook_item_code,
              lineNumber: li.line_number,
              subtotal: li.subtotal.to_f
            }
          }
        end

        json
      end
    end
  end
end
