module Api
  module V1
    class ExternalInvoicesController < ApplicationController
      include DocumentProviderAware
      # GET /api/v1/external_invoices
      # List invoices with optional filtering
      def index
        invoices = ExternalInvoice.active.includes(:job, :warehouse_documents)

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
        invoices = invoices.order(invoice_date: :desc).offset((page - 1) * per_page).limit(per_page).to_a

        # Batch-load SyncConfigurations to avoid N+1
        tenant_ids = invoices.map(&:tenant_id).compact.uniq
        config_lookup = SyncConfiguration.where(xero_tenant_id: tenant_ids).index_by(&:xero_tenant_id)

        render json: {
          success: true,
          data: invoices.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
          meta: {
            total_count: total_count,
            page: page,
            per_page: per_page,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/external_invoices/:id
      # Note: corporate_company_documents DROPPED (Jan 2026) - migrated to warehouse_documents
      def show
        invoice = ExternalInvoice.find(params[:id])

        # Check if PDF is available (SSoT: now via warehouse_documents)
        pdf_doc = invoice.warehouse_documents.find_by("metadata->>'document_type' = ?", document_type_for(invoice.invoice_type))
        has_pdf = pdf_doc&.storage_blob.present?

        render json: {
          success: true,
          data: serialize_invoice(invoice, include_details: true).merge(
            has_pdf: has_pdf,
            pdf_synced_at: pdf_doc&.created_at&.iso8601
          )
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Invoice not found" }, status: :not_found
      end

      # GET /api/v1/external_invoices/by_external_id/:external_id
      # Find invoice by Xero ID (external_id) - for invoice detail modal
      # Note: corporate_company_documents DROPPED (Jan 2026) - migrated to warehouse_documents
      def by_external_id
        invoice = ExternalInvoice.find_by!(external_id: params[:external_id])

        # Check if PDF is available (SSoT: now via warehouse_documents)
        pdf_doc = invoice.warehouse_documents.find_by("metadata->>'document_type' = ?", document_type_for(invoice.invoice_type))
        has_pdf = pdf_doc&.storage_blob.present?

        render json: {
          success: true,
          data: serialize_invoice(invoice, include_details: true).merge(
            has_pdf: has_pdf,
            pdf_synced_at: pdf_doc&.created_at&.iso8601
          )
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Invoice not found" }, status: :not_found
      end

      # GET /api/v1/external_invoices/by_job/:job_id
      # Optimized endpoint for fetching all invoices/bills for a job
      def by_job
        job = Job.find(params[:job_id])

        invoices = ExternalInvoice.active
                                  .includes(:job, :warehouse_documents)
                                  .where(job_id: job.id)
                                  .order(invoice_date: :desc)

        sales_invoices = invoices.sales_invoices
        bills = invoices.bills
        credit_notes = invoices.credit_notes
        quotes = invoices.quotes

        # Get last sync time
        last_sync = ExternalInvoice.where(source: "xero").maximum(:last_synced_at)

        # Get claim invoice patterns from job's schedule master template
        claim_patterns = []
        if job.job_type&.sm_schedule_master_template_id.present?
          claim_tasks = SmScheduleMaster.where(is_claim_task: true)
                                        .where("sm_template_ids @> ?", [job.job_type.sm_schedule_master_template_id].to_json)
                                        .where.not(claim_invoice_pattern: [nil, ""])
                                        .select(:name, :claim_invoice_pattern, :claim_percentage)
                                        .order(:sequence_order)
          claim_patterns = claim_tasks.map do |task|
            {
              task_name: task.name,
              pattern: task.claim_invoice_pattern,
              percentage: task.claim_percentage&.to_f
            }
          end
        end

        # Batch-load SyncConfigurations to avoid N+1 in serialize_invoice
        tenant_ids = invoices.map(&:tenant_id).compact.uniq
        config_lookup = SyncConfiguration.where(xero_tenant_id: tenant_ids).index_by(&:xero_tenant_id)

        render json: {
          success: true,
          data: {
            invoices: sales_invoices.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            bills: bills.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            credit_notes: credit_notes.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            quotes: quotes.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            total_invoices: sales_invoices.count,
            total_bills: bills.count,
            total_credit_notes: credit_notes.count,
            total_quotes: quotes.count,
            job_id: job.id,
            job_title: job.title,
            tracking_option_name: job.xero_tracking_option_name,
            claim_invoice_patterns: claim_patterns
          },
          meta: {
            source: "local_cache",
            last_synced_at: last_sync&.iso8601,
            cache_age_seconds: last_sync ? (Time.current - last_sync).to_i : nil
          }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Job not found" }, status: :not_found
      end

      # GET /api/v1/external_invoices/by_tracking
      # Alternative endpoint using tracking option name (for backwards compatibility)
      def by_tracking
        tracking_option_name = params[:tracking_option_name]

        unless tracking_option_name.present?
          return render json: {
            success: false,
            error: "tracking_option_name is required"
          }, status: :bad_request
        end

        # Find job by tracking option name
        job = Job.find_by(xero_tracking_option_name: tracking_option_name)

        if job
          # Use job_id for fast lookup
          invoices = ExternalInvoice.active.includes(:job, :warehouse_documents).where(job_id: job.id)
        else
          # Fall back to searching tracking_data JSON (slower but works for unlinked)
          invoices = ExternalInvoice.active.includes(:job, :warehouse_documents).with_tracking(tracking_option_name)
        end

        invoices = invoices.order(invoice_date: :desc)

        sales_invoices = invoices.sales_invoices
        bills = invoices.bills

        # Get last sync time
        last_sync = ExternalInvoice.where(source: "xero").maximum(:last_synced_at)

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
            source: "local_cache",
            last_synced_at: last_sync&.iso8601,
            cache_age_seconds: last_sync ? (Time.current - last_sync).to_i : nil
          }
        }
      end

      # GET /api/v1/external_invoices/by_contact/:contact_id
      # Get all invoices for a TEEEM contact, grouped by Xero tenant
      def by_contact
        contact = Contact.find(params[:contact_id])

        invoices = ExternalInvoice.active
                                  .includes(:job, :warehouse_documents)
                                  .where(contact_id: contact.id)
                                  .order(invoice_date: :desc)

        sales_invoices = invoices.sales_invoices
        bills = invoices.bills
        credit_notes = invoices.credit_notes
        quotes = invoices.quotes

        # Get last sync time - SSoT: use this contact's most recent sync, not global
        contact_last_sync = invoices.maximum(:last_synced_at)

        # Group invoices by xero_org_id (Xero UUID) for tabbed display
        # Frontend matches by xero_tenant_id (UUID), not TEEEM tenant_id (integer)
        grouped_by_tenant = invoices.group_by(&:xero_org_id)

        # Batch-load all SyncConfigurations for this contact's invoices (avoids N+1)
        xero_org_ids = grouped_by_tenant.keys.compact
        config_lookup = SyncConfiguration.where(xero_tenant_id: xero_org_ids).index_by(&:xero_tenant_id)

        # Build tenant info lookup
        tenant_info = {}
        xero_org_ids.each do |xero_org_id|
          config = config_lookup[xero_org_id]
          tenant_info[xero_org_id] = {
            tenant_id: xero_org_id,
            tenant_name: config&.xero_tenant_name || "Unknown Xero Company",
            badge_color: config&.badge_color || "blue"
          }
        end

        # Build by_tenant response
        by_tenant = {}
        grouped_by_tenant.each do |xero_org_id, tenant_invoices|
          next unless xero_org_id

          tenant_sales = tenant_invoices.select(&:sales_invoice?)
          tenant_bills = tenant_invoices.select(&:bill?)
          tenant_credit_notes = tenant_invoices.select(&:credit_note?)
          tenant_quotes = tenant_invoices.select(&:quote?)

          by_tenant[xero_org_id] = {
            tenant_info: tenant_info[xero_org_id],
            invoices: tenant_sales.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            bills: tenant_bills.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            credit_notes: tenant_credit_notes.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            quotes: tenant_quotes.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            total_invoices: tenant_sales.count,
            total_bills: tenant_bills.count,
            total_credit_notes: tenant_credit_notes.count,
            total_quotes: tenant_quotes.count
          }
        end

        render json: {
          success: true,
          data: {
            # Grouped by tenant (new - for tabbed display)
            by_tenant: by_tenant,
            # Flat lists (backwards compatible)
            invoices: sales_invoices.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            bills: bills.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            credit_notes: credit_notes.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            quotes: quotes.map { |inv| serialize_invoice(inv, config_lookup: config_lookup) },
            total_invoices: sales_invoices.count,
            total_bills: bills.count,
            total_credit_notes: credit_notes.count,
            total_quotes: quotes.count,
            contact_id: contact.id,
            contact_name: contact.display_name
          },
          meta: {
            source: "local_cache",
            tenant_count: by_tenant.keys.count,
            last_synced_at: contact_last_sync&.iso8601,
            cache_age_seconds: contact_last_sync ? (Time.current - contact_last_sync).to_i : nil
          }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
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
        source = params[:source] || "xero"
        incremental = params[:incremental] != "false"

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

      # POST /api/v1/external_invoices/push_pending
      # Push all pending invoices to Xero
      def push_pending
        source = params[:source] || "xero"
        tenant_id = params[:tenant_id]

        service = ExternalInvoiceSyncService.new(source: source, tenant_id: tenant_id)
        result = service.push_pending

        render json: {
          success: result[:errors].empty?,
          data: result
        }
      rescue StandardError => e
        Rails.logger.error("Push pending failed: #{e.message}")
        render json: {
          success: false,
          error: "Push failed: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/external_invoices
      # Create a new invoice (optionally push to Xero)
      def create
        tenant_id = params[:tenant_id]
        push_to_xero = params[:push_to_xero] != false

        unless tenant_id.present?
          return render json: { success: false, error: "tenant_id is required" }, status: :bad_request
        end

        # Build invoice attributes from params
        invoice_attrs = {
          invoice_type: params[:invoice_type] || "sales_invoice",
          status: params[:status] || "draft",
          invoice_date: params[:invoice_date] || Date.current,
          due_date: params[:due_date],
          reference: params[:reference],
          contact_id: params[:contact_id],
          job_id: params[:job_id],
          line_items: params[:line_items] || [],
          currency_code: params[:currency_code] || "AUD",
          subtotal: params[:subtotal],
          total_tax: params[:total_tax],
          total: params[:total]
        }

        # Link to contact's Xero ID if contact specified
        if invoice_attrs[:contact_id].present?
          link = ContactExternalLink.find_by(
            contact_id: invoice_attrs[:contact_id],
            source: "xero",
            tenant_id: tenant_id
          )
          invoice_attrs[:external_contact_id] = link&.external_contact_id
          invoice_attrs[:contact_name] = link&.contact&.display_name
        end

        service = ExternalInvoiceSyncService.new(source: "xero", tenant_id: tenant_id)

        if push_to_xero
          invoice = service.create_and_push(invoice_attrs, tenant_id: tenant_id)
        else
          invoice = ExternalInvoice.create!(
            source: "xero",
            tenant_id: tenant_id,
            created_in_teeem: true,
            pending_push: true,
            sync_direction: "export_only",
            teeem_updated_at: Time.current,
            **invoice_attrs
          )
        end

        render json: {
          success: true,
          data: serialize_invoice(invoice, include_details: true)
        }, status: :created
      rescue StandardError => e
        Rails.logger.error("Create invoice failed: #{e.message}")
        render json: {
          success: false,
          error: "Failed to create invoice: #{e.message}"
        }, status: :unprocessable_entity
      end

      # PATCH /api/v1/external_invoices/:id
      # Update an invoice and optionally sync to Xero
      def update
        invoice = ExternalInvoice.find(params[:id])
        push_to_xero = params[:push_to_xero] == true

        # Update allowed attributes
        update_attrs = {}
        %i[reference status invoice_date due_date line_items contact_id job_id].each do |attr|
          update_attrs[attr] = params[attr] if params.key?(attr)
        end

        # Mark as needing push if we're doing two-way sync
        if invoice.can_export? && update_attrs.any?
          update_attrs[:pending_push] = true
          update_attrs[:teeem_updated_at] = Time.current
        end

        invoice.update!(update_attrs)

        # Optionally push to Xero immediately
        if push_to_xero && invoice.can_export?
          service = ExternalInvoiceSyncService.new(source: invoice.source, tenant_id: invoice.tenant_id)
          service.send(:push_invoice_to_xero, invoice)
        end

        render json: {
          success: true,
          data: serialize_invoice(invoice, include_details: true)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Invoice not found" }, status: :not_found
      rescue StandardError => e
        Rails.logger.error("Update invoice failed: #{e.message}")
        render json: {
          success: false,
          error: "Failed to update invoice: #{e.message}"
        }, status: :unprocessable_entity
      end

      # GET /api/v1/external_invoices/:id/pdf
      # Returns PDF from storage (SharePoint/S3) via storage_blob
      # Note: corporate_company_documents DROPPED (Jan 2026) - migrated to warehouse_documents
      def pdf
        invoice = ExternalInvoice.find(params[:id])

        # SSoT: Find PDF via warehouse_documents (document_type stored in metadata)
        existing_pdf = invoice.warehouse_documents.find_by("metadata->>'document_type' = ?", document_type_for(invoice.invoice_type))

        if existing_pdf&.storage_blob.present?
          # Use fetch_from_storage which handles paths correctly for any provider
          content = fetch_from_storage(existing_pdf)
          if content
            send_data content,
                      filename: existing_pdf.original_filename || "invoice.pdf",
                      type: "application/pdf",
                      disposition: "inline"
            return
          end
          # Storage fetch failed - return error
          render json: { success: false, error: "Storage fetch failed for document #{existing_pdf.id}" }, status: :service_unavailable
          return
        end

        # No PDF in warehouse - fetch from Xero on-demand and store
        service = XeroAttachmentSyncService.new(invoice)
        result = service.sync!

        if result[:pdf]&.storage_blob.present?
          content = fetch_from_storage(result[:pdf])
          if content
            send_data content,
                      filename: result[:pdf].original_filename || "invoice.pdf",
                      type: "application/pdf",
                      disposition: "inline"
            return
          end
          render json: { success: false, error: "Storage fetch failed after Xero sync" }, status: :service_unavailable
          return
        end

        # Xero sync failed or no storage_reference
        error_msg = result[:errors].first || "PDF not available"
        render json: { success: false, error: error_msg }, status: :not_found
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Invoice not found" }, status: :not_found
      rescue StandardError => e
        Rails.logger.error("PDF fetch failed: #{e.message}")
        render json: { success: false, error: "Failed to fetch PDF: #{e.message}" }, status: :internal_server_error
      end

      # Fetch file content from storage (provider-agnostic)
      # SSoT: Uses DocumentStorageService for provider-agnostic downloads
      def fetch_from_storage(document)
        service = DocumentStorageService.new
        result = service.download(document)
        result[:success] ? result[:content] : nil
      rescue DocumentProviders::Error => e
        Rails.logger.error("Storage download failed: #{e.message}")
        nil
      rescue StandardError => e
        Rails.logger.error("Storage fetch error: #{e.message}")
        nil
      end

      # Legacy method for backwards compatibility (uses file_id for SharePoint)
      # TODO: Migrate to fetch_from_storage once all documents have storage_path
      def fetch_from_sharepoint(file_id)
        # Use DocumentProviderAware to detect current provider
        begin
          setup_default_provider!
        rescue DocumentProviders::NotConnectedError
          return nil
        end

        # For SharePoint, download by file ID
        if current_provider_type == :sharepoint
          download_file_by_id(file_id)
        else
          # For S3/Wasabi, we need the full path - file_id won't work
          # This is a legacy fallback; new code should use fetch_from_storage
          Rails.logger.warn("fetch_from_sharepoint called with non-SharePoint provider")
          nil
        end
      rescue DocumentProviders::Error => e
        Rails.logger.error("Storage auth failed: #{e.message}")
        nil
      rescue StandardError => e
        Rails.logger.error("Storage fetch error: #{e.message}")
        nil
      end

      # Download file by provider-specific ID (SharePoint only)
      def download_file_by_id(file_id)
        return nil unless current_provider_type == :sharepoint
        credential = MicrosoftCredential.sharepoint_credential
        return nil unless credential&.valid_credential?

        graph_client = MicrosoftGraphClient.new(credential)
        graph_client.download_file(file_id)
      end

      # GET /api/v1/external_invoices/:id/attachments
      # List all attachments for this invoice
      # Note: corporate_company_documents DROPPED (Jan 2026) - migrated to warehouse_documents
      def attachments
        invoice = ExternalInvoice.find(params[:id])

        # Return documents linked to this invoice (SSoT: warehouse_documents)
        documents = invoice.warehouse_documents.includes(:storage_blob).map do |doc|
          {
            id: doc.id,
            title: doc.ui_name,
            file_name: doc.original_filename,
            document_type: doc.metadata&.dig("document_type"),
            folder: doc.folder,
            file_size: doc.file_size,
            mime_type: doc.content_type,
            has_file: doc.storage_blob.present?,
            # SSoT: Use storage_blob path
            storage_reference: doc.storage_blob&.storage_path,
            created_at: doc.created_at.iso8601
          }
        end

        render json: {
          success: true,
          data: documents,
          meta: {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            count: documents.count
          }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Invoice not found" }, status: :not_found
      end

      private

      # SSoT: Maps invoice_type to document_type - MUST match XeroAttachmentSyncService.document_type_for_invoice
      def document_type_for(invoice_type)
        case invoice_type
        when "sales_invoice" then "Xero Invoice"
        when "bill" then "Xero Bill"
        when "credit_note" then "Xero Credit Note"
        when "quote" then "Xero Invoice"
        else "Xero Invoice"
        end
      end

      def serialize_invoice(invoice, include_details: false, config_lookup: nil)
        # Look up tenant name from SyncConfiguration (use pre-loaded hash if available)
        tenant_name = nil
        if invoice.tenant_id.present?
          config = if config_lookup
            config_lookup[invoice.tenant_id]
          else
            SyncConfiguration.find_by(xero_tenant_id: invoice.tenant_id)
          end
          tenant_name = config&.xero_tenant_name
        end

        data = {
          id: invoice.id,
          source: invoice.source,
          external_id: invoice.external_id,
          tenant_id: invoice.tenant_id,
          tenant_name: tenant_name,
          invoice_number: invoice.invoice_number,
          reference: invoice.reference,
          invoice_type: invoice.invoice_type,
          status: invoice.status,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          fully_paid_date: invoice.fully_paid_date,
          subtotal: invoice.subtotal&.to_f,
          total_tax: invoice.total_tax&.to_f,
          total: invoice.total&.to_f,
          amount_due: invoice.amount_due&.to_f,
          amount_paid: invoice.amount_paid&.to_f,
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
          xero_status: invoice.xero_status,
          # PDF sync status - true if a WarehouseDocument with storage_blob exists
          has_pdf: invoice.warehouse_documents.any? { |wd| wd.storage_blob_id.present? }
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
