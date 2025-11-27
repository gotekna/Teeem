module Api
  module V1
    class ContactXeroLinksController < ApplicationController
      before_action :set_contact
      before_action :set_xero_link, only: [:show, :update, :destroy, :sync]

      # GET /api/v1/contacts/:contact_id/xero_links
      def index
        @xero_links = @contact.xero_links.includes(:contact)

        render json: {
          success: true,
          xero_links: @xero_links.map { |link| serialize_xero_link(link) }
        }
      end

      # GET /api/v1/contacts/:contact_id/xero_links/:id
      def show
        render json: {
          success: true,
          xero_link: serialize_xero_link(@xero_link)
        }
      end

      # POST /api/v1/contacts/:contact_id/xero_links
      def create
        @xero_link = @contact.xero_links.build(xero_link_params)

        if @xero_link.save
          render json: {
            success: true,
            xero_link: serialize_xero_link(@xero_link)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @xero_link.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/contacts/:contact_id/xero_links/:id
      def update
        if @xero_link.update(xero_link_params)
          render json: {
            success: true,
            xero_link: serialize_xero_link(@xero_link)
          }
        else
          render json: {
            success: false,
            errors: @xero_link.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/contacts/:contact_id/xero_links/:id
      def destroy
        @xero_link.destroy
        render json: { success: true }
      end

      # POST /api/v1/contacts/:contact_id/xero_links/:id/sync
      def sync
        # TODO: Implement actual sync with Xero
        # For now, just mark as synced
        @xero_link.mark_synced!

        render json: {
          success: true,
          message: "Sync initiated",
          xero_link: serialize_xero_link(@xero_link)
        }
      end

      # GET /api/v1/contacts/:contact_id/xero_links/conflicts
      def conflicts
        links_with_conflicts = @contact.xero_links.with_conflicts

        render json: {
          success: true,
          conflicts: links_with_conflicts.map do |link|
            {
              xero_link: serialize_xero_link(link),
              conflict_fields: link.conflict_fields
            }
          end
        }
      end

      # POST /api/v1/contacts/:contact_id/xero_links/:id/resolve_conflict
      def resolve_conflict
        field_name = params[:field_name]
        keep_source = params[:keep_source] # 'teeem' or 'xero'

        unless field_name.present? && keep_source.present?
          render json: {
            success: false,
            errors: ["field_name and keep_source are required"]
          }, status: :unprocessable_entity
          return
        end

        @xero_link.resolve_conflict(field_name, keep_source)

        # TODO: Apply the resolution (update the winning value)

        render json: {
          success: true,
          message: "Conflict resolved",
          xero_link: serialize_xero_link(@xero_link)
        }
      end

      private

      def set_contact
        @contact = Contact.find(params[:contact_id])
      end

      def set_xero_link
        @xero_link = @contact.xero_links.find(params[:id])
      end

      def xero_link_params
        params.require(:xero_link).permit(
          :xero_tenant_id,
          :xero_tenant_name,
          :xero_contact_id,
          :sync_enabled,
          :sync_direction
        )
      end

      def serialize_xero_link(link)
        config = SyncConfiguration.find_by(xero_tenant_id: link.xero_tenant_id)

        {
          id: link.id,
          contact_id: link.contact_id,
          xero_tenant_id: link.xero_tenant_id,
          xero_tenant_name: link.xero_tenant_name,
          xero_contact_id: link.xero_contact_id,
          sync_enabled: link.sync_enabled,
          sync_direction: link.sync_direction,
          last_synced_at: link.last_synced_at,
          xero_last_modified_at: link.xero_last_modified_at,
          sync_error: link.sync_error,
          has_conflicts: link.has_conflicts?,
          conflict_count: link.conflict_fields.keys.count,
          badge_color: config&.badge_color || 'blue',
          accounting_system: config&.accounting_system || 'xero',
          created_at: link.created_at,
          updated_at: link.updated_at
        }
      end
    end
  end
end
