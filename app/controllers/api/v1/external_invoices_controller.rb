module Api
  module V1
    class ExternalInvoicesController < ApplicationController
      # GET /api/v1/external_invoices
      # List invoices with optional filtering
      def index
        invoices = ExternalInvoice.active

        # Filter by source
        invoices = invoices.where(source: params[:source]) if params[:source].present?

        # Filter by type (sales_invoice or bill)
        invoices = invoices.where(invoice_type: params[:type]) if params[:type].present?

        # Filter by job
        invoices = invoices.where(job_id: params[:job_id]) if params[:job_id].present?

        # Filter by contact
        invoices = invoices.where(contact_id: params[:contact_id]) if params[:contact_id].present?

        # Filter by status
        invoices = invoices.where(status: params[:status]) if params[:status].present?

        # Filter by tenant
        invoices = invoices.where(tenant_id: params[:tenant_id]) if params[:tenant_id].present?

        # Filter by external contact ID
        if params[:external_contact_id].present?
          invoices = invoices.where(external_contact_id: params[:external_contact_id])
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i.clamp(1, 200)

        total_count = invoices.count
        invoices = invoices.order(invoice_date: :desc).offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          data: invoices.map { |inv| serialize_invoice(inv) },
          meta: {
            total_count: total_count,
            page: page,
            per_page: per_page,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/external_invoices/:id
      def show
        invoice = ExternalInvoice.find(params[:id])

        render json: {
          success: true,
          data: serialize_invoice(invoice, include_details: true)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Invoice not found' }, status: :not_found
      end

      # GET /api/v1/external_invoices/by_job/:job_id
      # Optimized endpoint for fetching all invoices/bills for a job
      def by_job
        job = Job.find(params[:job_id])

        invoices = ExternalInvoice.active
                                  .where(job_id: job.id)
                                  .order(invoice_date: :desc)

        sales_invoices = invoices.sales_invoices
        bills = invoices.bills

        # Get last sync time
        last_sync = ExternalInvoice.where(source: 'xero').maximum(:last_synced_at)

        render json: {
          success: true,
          data: {
            invoices: sales_invoices.map { |inv| serialize_invoice(inv) },
            bills: bills.map { |inv| serialize_invoice(inv) },
            total_invoices: sales_invoices.count,
            total_bills: bills.count,
            job_id: job.id,
            job_title: job.title,
            tracking_option_name: job.xero_tracking_option_name
          },
          meta: {
            source: 'local_cache',
            last_synced_at: last_sync&.iso8601,
            cache_age_seconds: last_sync ? (Time.current - last_sync).to_i : nil
          }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Job not found' }, status: :not_found
      end

      # GET /api/v1/external_invoices/by_tracking
      # Alternative endpoint using tracking option name (for backwards compatibility)
      def by_tracking
        tracking_option_name = params[:tracking_option_name]

        unless tracking_option_name.present?
          return render json: {
            success: false,
            error: 'tracking_option_name is required'
          }, status: :bad_request
        end

        # Find job by tracking option name
        job = Job.find_by(xero_tracking_option_name: tracking_option_name)

        if job
          # Use job_id for fast lookup
          invoices = ExternalInvoice.active.where(job_id: job.id)
        else
          # Fall back to searching tracking_data JSON (slower but works for unlinked)
          invoices = ExternalInvoice.active.with_tracking(tracking_option_name)
        end

        invoices = invoices.order(invoice_date: :desc)

        sales_invoices = invoices.sales_invoices
        bills = invoices.bills

        # Get last sync time
        last_sync = ExternalInvoice.where(source: 'xero').maximum(:last_synced_at)

        render json: {
          success: true,
          data: {
            invoices: sales_invoices.map { |inv| serialize_invoice(inv) },
            bills: bills.map { |inv| serialize_invoice(inv) },
            total_invoices: sales_invoices.count,
            total_bills: bills.count,
            tracking_option_name: tracking_option_name
          },
          meta: {
            source: 'local_cache',
            last_synced_at: last_sync&.iso8601,
            cache_age_seconds: last_sync ? (Time.current - last_sync).to_i : nil
          }
        }
      end

      # GET /api/v1/external_invoices/by_contact/:contact_id
      # Get all invoices for a TEEEM contact
      def by_contact
        contact = Contact.find(params[:contact_id])

        invoices = ExternalInvoice.active
                                  .where(contact_id: contact.id)
                                  .order(invoice_date: :desc)

        sales_invoices = invoices.sales_invoices
        bills = invoices.bills

        # Get last sync time
        last_sync = ExternalInvoice.where(source: 'xero').maximum(:last_synced_at)

        render json: {
          success: true,
          data: {
            invoices: sales_invoices.map { |inv| serialize_invoice(inv) },
            bills: bills.map { |inv| serialize_invoice(inv) },
            total_invoices: sales_invoices.count,
            total_bills: bills.count,
            contact_id: contact.id,
            contact_name: contact.display_name
          },
          meta: {
            source: 'local_cache',
            last_synced_at: last_sync&.iso8601,
            cache_age_seconds: last_sync ? (Time.current - last_sync).to_i : nil
          }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Contact not found' }, status: :not_found
      end

      # GET /api/v1/external_invoices/sync_status
      # Show sync statistics
      def sync_status
        render json: {
          success: true,
          data: {
            total_invoices: ExternalInvoice.count,
            by_source: ExternalInvoice.group(:source).count,
            by_type: ExternalInvoice.group(:invoice_type).count,
            by_status: ExternalInvoice.group(:status).count,
            linked_to_jobs: ExternalInvoice.where.not(job_id: nil).count,
            linked_to_contacts: ExternalInvoice.where.not(contact_id: nil).count,
            last_synced_at: ExternalInvoice.maximum(:last_synced_at)&.iso8601,
            pending_push_count: ExternalInvoice.pending_push.count,
            with_errors_count: ExternalInvoice.with_errors.count
          }
        }
      end

      # POST /api/v1/external_invoices/trigger_sync
      # Trigger a background sync (for admin/manual refresh)
      def trigger_sync
        # For now, run sync inline (later can move to background job)
        source = params[:source] || 'xero'
        incremental = params[:incremental] != 'false'

        service = ExternalInvoiceSyncService.new(source: source)

        if incremental
          result = service.sync_incremental
        else
          result = service.sync
        end

        render json: {
          success: result[:success],
          data: result
        }
      rescue StandardError => e
        Rails.logger.error("Sync trigger failed: #{e.message}")
        render json: {
          success: false,
          error: "Sync failed: #{e.message}"
        }, status: :internal_server_error
      end

      private

      def serialize_invoice(invoice, include_details: false)
        data = {
          id: invoice.id,
          source: invoice.source,
          external_id: invoice.external_id,
          tenant_id: invoice.tenant_id,
          invoice_number: invoice.invoice_number,
          reference: invoice.reference,
          invoice_type: invoice.invoice_type,
          status: invoice.status,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          fully_paid_date: invoice.fully_paid_date,
          subtotal: invoice.subtotal,
          total_tax: invoice.total_tax,
          total: invoice.total,
          amount_due: invoice.amount_due,
          amount_paid: invoice.amount_paid,
          currency_code: invoice.currency_code,
          contact_id: invoice.contact_id,
          contact_name: invoice.contact_name,
          job_id: invoice.job_id,
          job_title: invoice.job&.title,
          external_contact_id: invoice.external_contact_id,
          tracking_option_names: invoice.tracking_option_names,
          last_synced_at: invoice.last_synced_at&.iso8601,
          external_updated_at: invoice.external_updated_at&.iso8601,
          # Xero-compatible fields for frontend backwards compatibility
          xero_invoice_id: invoice.external_id,
          xero_type: invoice.xero_type,
          xero_status: invoice.xero_status
        }

        if include_details
          data[:line_items] = invoice.line_items
          data[:payments] = invoice.payments
          data[:tracking_data] = invoice.tracking_data
          data[:raw_data] = invoice.raw_data
          data[:sync_enabled] = invoice.sync_enabled
          data[:sync_direction] = invoice.sync_direction
          data[:pending_push] = invoice.pending_push
          data[:has_conflicts] = invoice.has_conflicts?
          data[:conflict_fields] = invoice.conflict_fields
        end

        data
      end
    end
  end
end
