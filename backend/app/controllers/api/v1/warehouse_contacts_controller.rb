# frozen_string_literal: true

module Api
  module V1
    class WarehouseContactsController < ApplicationController
      # GET /api/v1/warehouse_contacts
      # List warehouse contacts with filtering
      def index
        contacts = WarehouseContact.all

        # Filter by tenant
        contacts = contacts.for_tenant(params[:tenant_id]) if params[:tenant_id].present?

        # Filter by type
        case params[:type]
        when "customer"
          contacts = contacts.customers
        when "supplier"
          contacts = contacts.suppliers
        when "both"
          contacts = contacts.both
        end

        # Filter by status
        contacts = contacts.where(contact_status: params[:status]) if params[:status].present?

        # Filter by linked/unlinked
        case params[:linked]
        when "true"
          contacts = contacts.linked
        when "false"
          contacts = contacts.unlinked
        end

        # Search
        contacts = contacts.search(params[:q]) if params[:q].present?

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i.clamp(1, 500)

        total_count = contacts.count
        contacts = contacts.order(name: :asc, id: :asc)
                           .offset((page - 1) * per_page)
                           .limit(per_page)

        render json: {
          success: true,
          data: contacts.map { |c| serialize_contact(c) },
          meta: {
            total_count: total_count,
            page: page,
            per_page: per_page,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/warehouse_contacts/:id
      def show
        contact = WarehouseContact.find(params[:id])

        render json: {
          success: true,
          data: serialize_contact(contact, include_details: true)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end

      # GET /api/v1/warehouse_contacts/by_xero_id/:xero_id
      def by_xero_id
        contact = WarehouseContact.find_by!(xero_id: params[:xero_id])

        render json: {
          success: true,
          data: serialize_contact(contact, include_details: true)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end

      # POST /api/v1/warehouse_contacts/:id/link
      # Link a warehouse contact to a TEEEM contact
      def link
        warehouse_contact = WarehouseContact.find(params[:id])
        teeem_contact = Contact.find(params[:contact_id])

        warehouse_contact.update!(contact_id: teeem_contact.id)

        render json: {
          success: true,
          data: serialize_contact(warehouse_contact, include_details: true),
          message: "Successfully linked to #{teeem_contact.display_name}"
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: e.message }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # DELETE /api/v1/warehouse_contacts/:id/unlink
      # Unlink a warehouse contact from its TEEEM contact
      def unlink
        warehouse_contact = WarehouseContact.find(params[:id])

        if warehouse_contact.contact_id.nil?
          render json: { success: false, error: "Contact is not linked" }, status: :unprocessable_entity
          return
        end

        warehouse_contact.update!(contact_id: nil)

        render json: {
          success: true,
          data: serialize_contact(warehouse_contact),
          message: "Contact unlinked successfully"
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end

      # GET /api/v1/warehouse_contacts/stats
      # Get summary statistics
      def stats
        stats = WarehouseContact.summary_stats

        render json: {
          success: true,
          data: stats.merge(
            by_tenant: WarehouseContact.group(:tenant_id).count,
            by_source: WarehouseContact.group(:source).count
          )
        }
      end

      # GET /api/v1/warehouse_contacts/tenants
      # List distinct tenants
      def tenants
        tenant_ids = WarehouseContact.tenants

        render json: {
          success: true,
          data: tenant_ids
        }
      end

      # GET /api/v1/warehouse_contacts/sync_status
      def sync_status
        sync_record = XeroSyncStatus.find_by(sync_type: "contacts")

        render json: {
          success: true,
          data: {
            total_contacts: WarehouseContact.count,
            customers_count: WarehouseContact.customers.count,
            suppliers_count: WarehouseContact.suppliers.count,
            linked_count: WarehouseContact.linked.count,
            unlinked_count: WarehouseContact.unlinked.count,
            active_count: WarehouseContact.active.count,
            archived_count: WarehouseContact.archived.count,
            by_tenant: WarehouseContact.group(:tenant_id).count,
            last_synced_at: sync_record&.last_synced_at&.iso8601,
            next_sync_at: sync_record&.next_sync_at&.iso8601,
            sync_status: sync_record&.status
          }
        }
      end

      # POST /api/v1/warehouse_contacts/trigger_sync
      def trigger_sync
        XeroContactSyncJob.perform_later

        render json: {
          success: true,
          message: "Contact sync job enqueued"
        }
      rescue StandardError => e
        Rails.logger.error("Contact sync trigger failed: #{e.message}")
        render json: {
          success: false,
          error: "Sync failed: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/warehouse_contacts/:id/auto_link
      # Attempt to automatically link a warehouse contact to a TEEEM contact
      def auto_link
        warehouse_contact = WarehouseContact.find(params[:id])

        if warehouse_contact.contact_id.present?
          render json: { success: false, error: "Contact is already linked" }, status: :unprocessable_entity
          return
        end

        # Try to find matching TEEEM contact by various criteria
        teeem_contact = find_matching_teeem_contact(warehouse_contact)

        if teeem_contact
          warehouse_contact.update!(contact_id: teeem_contact.id)
          render json: {
            success: true,
            data: serialize_contact(warehouse_contact, include_details: true),
            message: "Automatically linked to #{teeem_contact.display_name}",
            match_type: @match_type
          }
        else
          render json: {
            success: false,
            error: "No matching TEEEM contact found"
          }, status: :not_found
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end

      private

      def serialize_contact(contact, include_details: false)
        data = {
          id: contact.id,
          xero_id: contact.xero_id,
          tenant_id: contact.tenant_id,
          source: contact.source,
          name: contact.name,
          display_name: contact.display_name,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email_address: contact.email_address,
          phone_number: contact.phone_number,
          abn: contact.abn,
          contact_status: contact.contact_status,
          is_customer: contact.is_customer,
          is_supplier: contact.is_supplier,
          contact_id: contact.contact_id,
          last_synced_at: contact.last_synced_at&.iso8601
        }

        if include_details
          data[:tax_number] = contact.tax_number
          data[:account_number] = contact.account_number
          data[:currency_code] = contact.currency_code
          data[:addresses] = contact.addresses
          data[:phones] = contact.phones
          data[:bank_account_details] = contact.bank_account_details
          data[:batch_payments_bank_account_name] = contact.batch_payments_bank_account_name
          data[:batch_payments_bank_account_number] = contact.batch_payments_bank_account_number
          data[:batch_payments_bank_bsb] = contact.batch_payments_bank_bsb
          data[:xero_updated_at] = contact.xero_updated_at&.iso8601
          data[:created_at] = contact.created_at.iso8601
          data[:updated_at] = contact.updated_at.iso8601

          # Include linked TEEEM contact if present
          if contact.contact
            data[:teeem_contact] = {
              id: contact.contact.id,
              display_name: contact.contact.display_name,
              email: contact.contact.email
            }
          end
        end

        data
      end

      def find_matching_teeem_contact(warehouse_contact)
        # Priority 1: Match by email
        if warehouse_contact.email_address.present?
          match = Contact.find_by("LOWER(email) = ?", warehouse_contact.email_address.downcase)
          if match
            @match_type = "email"
            return match
          end
        end

        # Priority 2: Match by ABN/tax number
        if warehouse_contact.abn.present?
          normalized_abn = warehouse_contact.abn.gsub(/[\s\-]/, "")
          match = Contact.find_by("REPLACE(REPLACE(tax_number, ' ', ''), '-', '') = ?", normalized_abn)
          if match
            @match_type = "abn"
            return match
          end
        end

        # Priority 3: Match by exact name
        if warehouse_contact.name.present?
          match = Contact.find_by("LOWER(display_name) = ?", warehouse_contact.name.downcase)
          if match
            @match_type = "name"
            return match
          end
        end

        nil
      end
    end
  end
end
