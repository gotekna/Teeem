# frozen_string_literal: true

module Api
  module V1
    class QuoteTemplatesController < ApplicationController
      before_action :set_template, only: [:show, :update, :destroy, :duplicate, :populate_from_pack]

      # GET /api/v1/quote_templates
      def index
        templates = QuoteTemplate.active.ordered
          .includes(po_template_pack: :sm_schedule_master_template, quote_template_trades: { sm_schedule_master: [], quote_template_trade_suppliers: [{ supplier: :contact_emails }, :contact_person] })

        render json: {
          success: true,
          data: templates.map { |t| template_json(t) }
        }
      end

      # GET /api/v1/quote_templates/po_packs
      # Returns active PO Template Packs for the picker dropdown
      def po_packs
        packs = PoTemplatePack.active.ordered
          .includes(:sm_schedule_master_template, po_template_items: [:sm_schedule_master, :supplier, :po_template_line_items])

        render json: {
          success: true,
          data: packs.map { |pack|
            {
              id: pack.id,
              name: pack.name,
              description: pack.description,
              itemCount: pack.po_template_items.size,
              smTemplateName: pack.sm_schedule_master_template&.name,
              items: pack.po_template_items.sort_by(&:position).map { |item|
                {
                  id: item.id,
                  name: item.name,
                  smScheduleMasterId: item.sm_schedule_master_id,
                  smScheduleMasterName: item.sm_schedule_master&.name,
                  supplierId: item.supplier_id,
                  supplierName: item.supplier&.display_name,
                  supplierIsPriceOnly: item.supplier&.entity_type == "price_only",
                  pricebookItemIds: item.po_template_line_items.filter_map(&:pricebook_item_id)
                }
              }
            }
          }
        }
      end

      # GET /api/v1/quote_templates/:id
      def show
        render json: {
          success: true,
          data: template_json(@template, include_details: true)
        }
      end

      # POST /api/v1/quote_templates
      def create
        template = QuoteTemplate.new(template_params)
        template.created_by = current_user

        if template.save
          render json: { success: true, data: template_json(template.reload, include_details: true) }, status: :created
        else
          render_validation_errors(template)
        end
      end

      # PATCH /api/v1/quote_templates/:id
      def update
        @template.updated_by = current_user

        if @template.update(template_params)
          render json: { success: true, data: template_json(@template.reload, include_details: true) }
        else
          render_validation_errors(@template)
        end
      end

      # DELETE /api/v1/quote_templates/:id (soft delete)
      def destroy
        @template.update!(is_active: false)
        render json: { success: true }
      end

      # POST /api/v1/quote_templates/:id/populate_from_pack
      # Re-populates trades from the linked PO Template Pack
      def populate_from_pack
        unless @template.po_template_pack_id.present?
          render json: { success: false, error: "No PO Template Pack linked" }, status: :unprocessable_entity
          return
        end

        @template.populate_from_pack!
        render json: { success: true, data: template_json(@template, include_details: true) }
      end

      # POST /api/v1/quote_templates/:id/duplicate
      def duplicate
        new_template = nil

        ActiveRecord::Base.transaction do
          new_template = @template.dup
          new_template.name = "#{@template.name} (Copy)"
          new_template.created_by = current_user
          new_template.save!

          @template.quote_template_trades.includes(:quote_template_trade_suppliers).each do |trade|
            new_trade = trade.dup
            new_trade.quote_template = new_template
            new_trade.save!

            trade.quote_template_trade_suppliers.each do |supplier|
              new_supplier = supplier.dup
              new_supplier.quote_template_trade = new_trade
              new_supplier.save!
            end
          end
        end

        render json: { success: true, data: template_json(new_template.reload, include_details: true) }, status: :created
      end

      private

      def set_template
        @template = QuoteTemplate
          .includes(po_template_pack: :sm_schedule_master_template, quote_template_trades: { sm_schedule_master: [], quote_template_trade_suppliers: [{ supplier: :contact_emails }, :contact_person] })
          .find(params[:id])
      end

      def template_params
        params.require(:quote_template).permit(
          :name, :description, :is_active, :position, :po_template_pack_id, :sync_key,
          quote_template_trades_attributes: [
            :id, :sm_schedule_master_id, :position, :default_instructions, :_destroy,
            { required_document_types: [] },
            { quote_template_trade_suppliers_attributes: [
              :id, :supplier_id, :contact_person_id, :position, :is_preferred, :_destroy
            ] }
          ]
        )
      end

      def template_json(template, include_details: false)
        pack = template.po_template_pack
        json = {
          id: template.id,
          name: template.name,
          description: template.description,
          isActive: template.is_active,
          position: template.position,
          poTemplatePackId: template.po_template_pack_id,
          poTemplatePackName: pack&.name,
          smTemplateName: pack&.sm_schedule_master_template&.name,
          tradeCount: template.trade_count,
          supplierCount: template.supplier_count,
          syncStatus: build_quote_sync_status(template),
          createdAt: template.created_at&.iso8601,
          updatedAt: template.updated_at&.iso8601,
        }

        if include_details
          json[:trades] = template.quote_template_trades
            .sort_by(&:position)
            .map { |trade| trade_json(trade) }
        end

        json
      end

      def trade_json(trade)
        {
          id: trade.id,
          smScheduleMasterId: trade.sm_schedule_master_id,
          taskName: trade.sm_schedule_master&.name,
          costCentre: trade.sm_schedule_master&.cost_centre,
          poRequired: trade.sm_schedule_master&.po_required,
          position: trade.position,
          defaultInstructions: trade.default_instructions,
          requiredDocumentTypes: trade.required_document_types,
          supplierCount: trade.supplier_count,
          suppliers: trade.quote_template_trade_suppliers
            .sort_by(&:position)
            .map { |s| supplier_json(s) }
        }
      end

      def supplier_json(supplier)
        {
          id: supplier.id,
          supplierId: supplier.supplier_id,
          supplierName: supplier.supplier&.display_name,
          supplierEmail: supplier.supplier&.primary_email,
          contactPersonId: supplier.contact_person_id,
          contactPersonName: supplier.contact_person&.display_name,
          contactPersonEmail: supplier.contact_person&.email,
          position: supplier.position,
          isPreferred: supplier.is_preferred
        }
      end

      def build_quote_sync_status(template)
        return nil unless template.sync_key.present?
        other_tenants = Tenant.where.not(id: current_tenant.id)
        synced_tenants = other_tenants.filter_map do |tenant|
          has_match = ActsAsTenant.with_tenant(tenant) do
            QuoteTemplate.exists?(sync_key: template.sync_key)
          end
          tenant.name if has_match
        end
        return nil if synced_tenants.empty?
        { syncedTenants: synced_tenants }
      end
    end
  end
end
