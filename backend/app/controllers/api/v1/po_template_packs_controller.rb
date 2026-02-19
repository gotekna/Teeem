# frozen_string_literal: true

module Api
  module V1
    class PoTemplatePacksController < ApplicationController
      before_action :set_pack, only: [:show, :update, :destroy, :apply, :preview, :duplicate]

      # GET /api/v1/po_template_packs
      def index
        packs = PoTemplatePack.active.ordered
          .includes(:sm_schedule_master_template, po_template_items: [:po_template_line_items, :sm_schedule_master, :profit_centre])

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
          render_validation_errors(pack)
        end
      end

      # PATCH /api/v1/po_template_packs/:id
      def update
        @pack.updated_by = current_user

        if @pack.update(pack_params)
          render json: { success: true, data: pack_json(@pack.reload, include_line_items: true) }
        else
          render_validation_errors(@pack)
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
        result = service.call

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

        # Convert to camelCase for frontend (service returns snake_case)
        data = {
          packName: result[:pack_name],
          jobName: result[:job_name],
          totalPos: result[:total_pos],
          estimatedTotal: result[:estimated_total],
          tasksMatched: result[:tasks_matched],
          tasksUnmatched: result[:tasks_unmatched],
          tasksWillCreate: result[:tasks_will_create],
          suppliersMatched: result[:suppliers_matched],
          suppliersUnmatched: result[:suppliers_unmatched],
          warnings: result[:warnings],
          items: result[:items].map { |item|
            {
              name: item[:name],
              smScheduleMasterName: item[:sm_schedule_master_name],
              supplierName: item[:supplier_name],
              supplierMatched: item[:supplier_matched],
              taskName: item[:task_name],
              taskMatched: item[:task_matched],
              taskWillCreate: item[:task_will_create],
              lineItemCount: item[:line_item_count],
              estimatedTotal: item[:estimated_total],
              profitCentreName: item[:profit_centre_name],
              lineItems: item[:line_items]&.map { |li|
                {
                  description: li[:description],
                  quantity: li[:quantity],
                  unitPrice: li[:unit_price],
                  gstCode: li[:gst_code],
                  subtotal: li[:subtotal],
                  priceSource: li[:price_source]
                }
              }
            }
          }
        }

        # Add schedule template info if present
        if (st = result[:schedule_template])
          data[:scheduleTemplate] = {
            id: st[:id],
            name: st[:name],
            rowCount: st[:row_count],
            alreadyApplied: st[:already_applied],
            willCopy: st[:will_copy]
          }
        end

        render json: { success: true, data: data }
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
            .includes(:supplier, sm_task: :sm_schedule_master)
            .includes(:line_items)

          # Sort by SM sequence_order so position reflects Schedule Master order
          sorted_pos = pos.sort_by { |po| po.sm_task&.sm_schedule_master&.sequence_order || Float::INFINITY }

          sorted_pos.each_with_index do |po, idx|
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

            # Assign sequential line_numbers (source may have duplicates which breaks Config Sync matching)
            po.line_items.order(:line_number, :id).each_with_index do |li, line_idx|
              item.po_template_line_items.create!(
                description: li.description,
                quantity: li.quantity,
                unit_price: li.unit_price,
                gst_code: li.gst_code,
                pricebook_item_id: li.pricebook_item_id,
                pricebook_item_code: li.pricebook_item&.item_code,
                line_number: line_idx + 1
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
        @pack = PoTemplatePack
          .includes(:sm_schedule_master_template, po_template_items: [:po_template_line_items, :sm_schedule_master, :profit_centre, :supplier])
          .find(params[:id])
      end

      # SSoT: Trades lookup (ID => name) from Foundation SM Trades
      def trades_map
        @trades_map ||= begin
          foundation = Foundation.find_by(name: "SM Trades")
          return {} unless foundation
          ActiveRecord::Base.connection
            .execute("SELECT id, name FROM #{foundation.database_table_name}")
            .to_a
            .each_with_object({}) { |r, h| h[r["id"]] = r["name"] }
        end
      end

      # SSoT: Stages lookup (ID => name) from Foundation SM Stages
      def stages_map
        @stages_map ||= begin
          foundation = Foundation.find_by(name: "SM Stages")
          return {} unless foundation
          ActiveRecord::Base.connection
            .execute("SELECT id, name FROM #{foundation.database_table_name}")
            .to_a
            .each_with_object({}) { |r, h| h[r["id"]] = r["name"] }
        end
      end

      # SSoT: Cost Centres lookup (ID => name)
      def cost_centres_map
        @cost_centres_map ||= CostCentre.pluck(:id, :name).to_h
      end

      # Cache template row IDs per request to avoid N+1 on inTemplate checks
      def template_row_ids(template)
        @template_row_ids_cache ||= {}
        @template_row_ids_cache[template.id] ||= template.sm_schedule_master_rows.active.pluck(:id).to_set
      end

      # SSoT: Stage ordering from Job Stages (user-configured position)
      # Maps stage_name => position, used to sort BOQ cascade sections
      def stage_order_map
        @stage_order_map ||= begin
          job_stage_positions = JobStage.pluck(:name, :position).to_h
          # Map sm_stage_id => job_stage position (matched by name)
          stages_map.each_with_object({}) do |(stage_id, stage_name), h|
            h[stage_id] = job_stage_positions[stage_name] || 999
          end
        end
      end

      def pack_params
        params.require(:po_template_pack).permit(
          :name, :description, :is_active, :position, :sm_schedule_master_template_id,
          po_template_items_attributes: [
            :id, :name, :sm_schedule_master_id, :supplier_id, :supplier_sync_key,
            :profit_centre_id, :position, :budget, :notes, :status_on_create, :_destroy,
            po_template_line_items_attributes: [
              :id, :description, :quantity, :unit_price, :gst_code,
              :pricebook_item_id, :pricebook_item_code, :line_number, :_destroy
            ]
          ]
        )
      end

      def pack_json(pack, include_line_items: false)
        template = pack.sm_schedule_master_template
        json = {
          id: pack.id,
          name: pack.name,
          description: pack.description,
          isActive: pack.is_active,
          position: pack.position,
          itemCount: pack.po_template_items.size,
          estimatedTotal: pack.estimated_total,
          smScheduleMasterTemplateId: template&.id,
          smScheduleMasterTemplateName: template&.name,
          smScheduleMasterTemplateRowCount: template&.row_count,
          createdAt: pack.created_at&.iso8601,
          updatedAt: pack.updated_at&.iso8601,
          items: pack.po_template_items
            .sort_by { |item| item.sm_schedule_master&.sequence_order || Float::INFINITY }
            .map { |item| item_json(item, include_line_items: include_line_items, template: template) }
        }
        json
      end

      def item_json(item, include_line_items: false, template: nil)
        sm = item.sm_schedule_master
        json = {
          id: item.id,
          name: item.name,
          smScheduleMasterId: item.sm_schedule_master_id,
          smScheduleMasterName: sm&.name,
          tradeName: sm&.trade.present? ? trades_map[sm.trade.to_i] : nil,
          stageName: sm&.stage.present? ? stages_map[sm.stage.to_i] : nil,
          stagePosition: sm&.stage.present? ? stage_order_map[sm.stage.to_i] : nil,
          profitCentreId: item.profit_centre_id,
          profitCentreName: item.profit_centre&.code,
          costCentreName: sm&.cost_centre.present? ? cost_centres_map[sm.cost_centre] : nil,
          supplierId: item.supplier_id,
          supplierName: item.supplier&.display_name,
          supplierSyncKey: item.supplier_sync_key,
          position: item.position,
          budget: item.budget,
          notes: item.notes,
          statusOnCreate: item.status_on_create,
          lineItemCount: item.po_template_line_items.size,
          lineItemTotal: item.line_item_total,
          inTemplate: template.present? ? template_row_ids(template).include?(item.sm_schedule_master_id) : nil
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
