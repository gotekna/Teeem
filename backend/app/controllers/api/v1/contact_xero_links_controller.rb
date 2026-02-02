module Api
  module V1
    class ContactXeroLinksController < ApplicationController
      before_action :set_contact, except: [ :pending_review ]
      before_action :set_xero_link, only: [ :show, :update, :destroy, :sync, :approve, :reject, :transfer ]

      # GET /api/v1/xero_links/pending_review
      # Global endpoint to list all links needing manual review
      def pending_review
        links = ContactExternalLink.xero
                                   .pending_review
                                   .includes(:contact)
                                   .order(created_at: :desc)

        render json: {
          success: true,
          pending_count: links.count,
          links: links.map { |link| serialize_xero_link_with_review(link) }
        }
      end

      # POST /api/v1/contacts/:contact_id/xero_links/:id/approve
      # Approve a fuzzy match and enable sync
      def approve
        unless @xero_link.needs_review?
          return render json: {
            success: false,
            error: "This link is not pending review"
          }, status: :unprocessable_entity
        end

        @xero_link.approve_review!(params[:reviewer_email])

        # Trigger sync now that it's approved
        begin
          sync_service = XeroContactSyncService.new(tenant_id: @xero_link.xero_org_id)
          xero_contact = sync_service.fetch_single_xero_contact(@xero_link.external_contact_id, @xero_link.xero_org_id)
          if xero_contact
            sync_service.send(:sync_matched_contact, @xero_link.contact, xero_contact, @xero_link)
          end
        rescue StandardError => e
          Rails.logger.error("Failed to sync after approval: #{e.message}")
        end

        render json: {
          success: true,
          message: "Link approved and sync initiated",
          xero_link: serialize_xero_link(@xero_link.reload)
        }
      end

      # POST /api/v1/contacts/:contact_id/xero_links/:id/reject
      # Reject a fuzzy match - this will unlink and create a new TEEEM contact
      def reject
        unless @xero_link.needs_review?
          return render json: {
            success: false,
            error: "This link is not pending review"
          }, status: :unprocessable_entity
        end

        xero_contact_id = @xero_link.external_contact_id
        tenant_id = @xero_link.xero_org_id

        # Delete the incorrect link
        @xero_link.destroy!

        # Create a new TEEEM contact from Xero on next sync
        # For now, just return success - the next sync will create the contact
        render json: {
          success: true,
          message: "Link rejected. A new TEEEM contact will be created for this Xero contact on next sync.",
          xero_contact_id: xero_contact_id,
          tenant_id: tenant_id
        }
      end

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
      # Push contact to Xero and create link
      def create
        tenant_id = params.dig(:xero_link, :tenant_id)

        unless tenant_id.present?
          return render json: {
            success: false,
            error: "tenant_id is required"
          }, status: :unprocessable_entity
        end

        # Check if already linked to this tenant
        # FRC (Feb 2026): Renamed tenant_id to xero_org_id for consistency
        if @contact.xero_links.exists?(xero_org_id: tenant_id)
          return render json: {
            success: false,
            error: "Contact already linked to this Xero organization"
          }, status: :unprocessable_entity
        end

        # Use the sync service to push to Xero and create link
        sync_service = XeroContactSyncService.new(tenant_id: tenant_id)
        result = sync_service.create_xero_contact_for_tenant(@contact, tenant_id)

        if result[:success]
          render json: {
            success: true,
            xero_link: serialize_xero_link(result[:link])
          }, status: :created
        else
          render json: {
            success: false,
            error: result[:error] || "Failed to push contact to Xero"
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

      # POST /api/v1/contacts/:contact_id/xero_links/:id/transfer
      # Transfer a Xero link from one contact to another
      def transfer
        target_contact = Contact.find_by(id: params[:target_contact_id])

        unless target_contact
          return render json: {
            success: false,
            error: "Target contact not found"
          }, status: :not_found
        end

        if target_contact.id == @contact.id
          return render json: {
            success: false,
            error: "Cannot transfer to the same contact"
          }, status: :unprocessable_entity
        end

        # Check if target already has link to same tenant
        existing_link = target_contact.external_links.find_by(
          source: @xero_link.source,
          tenant_id: @xero_link.xero_org_id
        )

        if existing_link
          return render json: {
            success: false,
            error: "Target contact is already linked to #{@xero_link.tenant_name}"
          }, status: :unprocessable_entity
        end

        old_contact = @xero_link.contact

        # Transfer the link
        @xero_link.update!(contact_id: target_contact.id)

        # Update caches on both contacts
        old_contact.update_xero_link_cache!
        target_contact.update_xero_link_cache!

        render json: {
          success: true,
          message: "Xero link transferred to #{target_contact.display_name}",
          xero_link: serialize_xero_link(@xero_link.reload)
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
            errors: [ "field_name and keep_source are required" ]
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
          :tenant_id,
          :tenant_name,
          :external_contact_id,
          :sync_enabled,
          :sync_direction
        )
      end

      def serialize_xero_link(link)
        config = SyncConfiguration.find_by(xero_tenant_id: link.xero_org_id)

        # Count invoices for this contact from this Xero tenant
        invoice_count = ExternalInvoice.where(
          contact_id: link.contact_id,
          tenant_id: link.xero_org_id,
          source: "xero"
        ).count

        {
          id: link.id,
          contact_id: link.contact_id,
          source: link.source,
          # Legacy field names for backwards compatibility with frontend
          xero_tenant_id: link.xero_org_id,
          xero_tenant_name: link.tenant_name,
          xero_contact_id: link.external_contact_id,
          # New generic field names
          tenant_id: link.xero_org_id,
          tenant_name: link.tenant_name,
          external_contact_id: link.external_contact_id,
          sync_enabled: link.sync_enabled,
          sync_direction: link.sync_direction,
          last_synced_at: link.last_synced_at,
          external_last_modified_at: link.external_last_modified_at,
          sync_error: link.sync_error,
          has_conflicts: link.has_conflicts?,
          conflict_count: link.conflict_fields.keys.count,
          badge_color: config&.badge_color || "blue",
          accounting_system: config&.accounting_system || link.source,
          # Invoice count from this tenant
          invoice_count: invoice_count,
          # Review fields
          needs_review: link.needs_review,
          match_type: link.match_type,
          match_confidence: link.match_confidence&.to_f,
          reviewed_at: link.reviewed_at,
          reviewed_by: link.reviewed_by,
          created_at: link.created_at,
          updated_at: link.updated_at
        }
      end

      # Extended serializer for pending review list
      def serialize_xero_link_with_review(link)
        serialize_xero_link(link).merge(
          contact_name: link.contact&.display_name,
          contact_email: link.contact&.email,
          contact_tax_number: link.contact&.abn,
          match_confidence_percent: link.match_confidence ? (link.match_confidence * 100).round : nil,
          external_contact_name: link.external_name || link.metadata&.dig("name") || link.external_contact_id
        )
      end
    end
  end
end
