# frozen_string_literal: true

module Api
  module V1
    class CustomQuotesController < ApplicationController
      before_action :set_template, only: [:show_template, :update_template, :destroy_template, :duplicate_template]
      before_action :set_custom_quote, only: [:show, :update, :destroy, :save_as_template, :overwrite_template]
      before_action :set_line, only: [:update_line, :add_supplier, :add_child_line]
      before_action :set_supplier, only: [:send_rfq_single, :mark_sent, :record_response, :accept_quote,
                                          :reject_quote, :supplier_allocations, :create_allocation,
                                          :presign_upload, :confirm_upload,
                                          :extract_quote_data, :document_preview_url]

      # ═══════════════════════════════════════════════════════════════════════════
      # Template endpoints
      # ═══════════════════════════════════════════════════════════════════════════

      # GET /api/v1/custom_quote_templates
      def index_templates
        templates = CustomQuoteTemplate.ordered
        templates = templates.active if params[:active_only] == 'true'

        render json: {
          success: true,
          data: templates.map { |t| template_json(t) }
        }
      end

      # POST /api/v1/custom_quote_templates
      def create_template
        template = CustomQuoteTemplate.new(template_params)
        template.created_by = current_user
        template.updated_by = current_user
        template.save!

        # Populate from pack if provided
        if template.po_template_pack_id.present?
          CustomQuoteTemplateService.populate_from_pack!(template)
        end

        render json: { success: true, data: template_json(template) }, status: :created
      end

      # GET /api/v1/custom_quote_templates/:id
      def show_template
        render json: {
          success: true,
          data: template_json(@template).merge(tree: @template.as_tree)
        }
      end

      # PATCH /api/v1/custom_quote_templates/:id
      def update_template
        @template.update!(template_params.merge(updated_by: current_user))
        render json: { success: true, data: template_json(@template) }
      end

      # DELETE /api/v1/custom_quote_templates/:id
      def destroy_template
        @template.destroy!
        render json: { success: true }
      end

      # POST /api/v1/custom_quote_templates/:id/duplicate
      def duplicate_template
        new_template = @template.dup
        new_template.name = "#{@template.name} (Copy)"
        new_template.created_by = current_user
        new_template.updated_by = current_user
        new_template.save!

        # Clone lines
        clone_template_lines(@template, new_template)

        render json: { success: true, data: template_json(new_template) }, status: :created
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Job-level custom quote endpoints
      # ═══════════════════════════════════════════════════════════════════════════

      # GET /api/v1/jobs/:job_id/custom_quotes
      def index
        job = Job.find(params[:job_id])
        quotes = CustomQuote.for_job(job.id).includes(:custom_quote_template, :created_by)

        render json: {
          success: true,
          data: quotes.map { |q| quote_summary_json(q) }
        }
      end

      # POST /api/v1/jobs/:job_id/custom_quotes
      # One custom quote per job - returns existing if already present
      def create
        job = Job.find(params[:job_id])

        # Return existing quote if one already exists for this job
        existing = CustomQuote.for_job(job.id).first
        if existing
          return render json: {
            success: true,
            data: quote_tree_json(existing)
          }
        end

        if params[:template_id].present?
          template = CustomQuoteTemplate.find(params[:template_id])
          custom_quote = CustomQuoteApplyService.apply!(
            template: template,
            job: job,
            user: current_user,
            name: params[:name]
          )
        elsif params[:populate_from] == 'schedule_master'
          custom_quote = CustomQuoteApplyService.populate_from_job_tasks!(
            job: job,
            user: current_user,
            name: params[:name]
          )
        else
          custom_quote = CustomQuote.create!(
            job: job,
            name: params[:name] || "Custom Quote - #{job.name}",
            status: 'draft',
            created_by: current_user
          )
        end

        render json: {
          success: true,
          data: quote_tree_json(custom_quote)
        }, status: :created
      end

      # GET /api/v1/custom_quotes/:id
      def show
        render json: {
          success: true,
          data: quote_tree_json(@custom_quote)
        }
      end

      # PATCH /api/v1/custom_quotes/:id
      def update
        @custom_quote.update!(quote_params)
        render json: { success: true, data: quote_tree_json(@custom_quote) }
      end

      # DELETE /api/v1/custom_quotes/:id
      def destroy
        @custom_quote.destroy!
        render json: { success: true }
      end

      # POST /api/v1/custom_quotes/:id/save_as_template
      def save_as_template
        template = CustomQuoteTemplateService.save_from_job!(
          @custom_quote,
          name: params[:name] || "Template from #{@custom_quote.name}",
          user: current_user
        )

        render json: { success: true, data: template_json(template) }, status: :created
      end

      # POST /api/v1/custom_quotes/:id/overwrite_template
      def overwrite_template
        template = @custom_quote.custom_quote_template
        unless template
          return render json: { success: false, error: "Quote has no associated template" }, status: :unprocessable_entity
        end

        CustomQuoteTemplateService.overwrite_from_job!(
          @custom_quote,
          template: template,
          user: current_user
        )

        render json: { success: true, data: template_json(template.reload) }
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Line endpoints
      # ═══════════════════════════════════════════════════════════════════════════

      # PATCH /api/v1/custom_quote_lines/:id
      def update_line
        @line.update!(line_params)
        render json: { success: true, data: @line.as_tree_node }
      end

      # POST /api/v1/custom_quote_lines/:id/add_supplier
      def add_supplier
        supplier_record = Contact.find(params[:supplier_id])

        cqs = @line.suppliers.create!(
          supplier: supplier_record,
          contact_person_id: params[:contact_person_id],
          contact_email: params[:contact_email] || supplier_record.email,
          status: 'draft'
        )

        render json: { success: true, data: cqs.as_json_summary }, status: :created
      end

      # POST /api/v1/custom_quote_lines/:id/add_child
      def add_child_line
        child = @line.children.create!(
          custom_quote: @line.custom_quote,
          name: params[:name] || "New PO Line",
          quote_level: 'po',
          position: @line.children.count,
          sm_schedule_master_id: params[:sm_schedule_master_id],
          sm_task_id: params[:sm_task_id],
          cost_centre_id: params[:cost_centre_id]
        )

        render json: { success: true, data: child.as_tree_node }, status: :created
      end

      # GET /api/v1/custom_quotes/document_types
      def document_types
        doc_types = DocumentType.active.for_job.order(:name)
        render json: {
          success: true,
          data: doc_types.map { |dt| { id: dt.id, name: dt.name } }
        }
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Supplier endpoints
      # ═══════════════════════════════════════════════════════════════════════════

      # POST /api/v1/custom_quote_suppliers/:id/send_rfq
      def send_rfq_single
        adapted = CustomQuoteRfqAdapter.wrap(@supplier)

        result = RfqSendingService.send_rfq(
          tracker: adapted,
          user: current_user,
          email_template_id: params[:email_template_id],
          document_ids: params[:document_ids] || [],
          custom_message: params[:custom_message],
          account_type: params[:account_type],
          credential_id: params[:credential_id],
          mailbox_email: params[:mailbox_email]
        )

        if result.success?
          render json: { success: true, data: @supplier.reload.as_json_summary }
        else
          render json: { success: false, error: result.error }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/custom_quote_suppliers/:id/mark_sent
      def mark_sent
        @supplier.mark_sent!(current_user)
        render json: { success: true, data: @supplier.as_json_summary }
      end

      # POST /api/v1/custom_quote_suppliers/bulk_send_rfq
      def bulk_send_rfq
        suppliers = CustomQuoteSupplier.where(id: params[:supplier_ids])
        adapted = suppliers.map { |s| CustomQuoteRfqAdapter.wrap(s) }

        bulk_result = RfqSendingService.send_bulk(
          trackers: adapted,
          user: current_user,
          email_template_id: params[:email_template_id],
          document_ids: params[:document_ids] || [],
          custom_message: params[:custom_message],
          account_type: params[:account_type],
          credential_id: params[:credential_id],
          mailbox_email: params[:mailbox_email]
        )

        render json: {
          success: true,
          data: {
            total: bulk_result.total,
            sent: bulk_result.sent,
            failed: bulk_result.failed
          }
        }
      end

      # POST /api/v1/custom_quote_suppliers/:id/record_response
      def record_response
        @supplier.record_response!(
          price: params[:price_quoted],
          quote_number: params[:quote_number],
          timeframe: params[:timeframe],
          notes: params[:response_notes],
          valid_to: params[:valid_to],
          warehouse_document_id: params[:warehouse_document_id]
        )

        render json: { success: true, data: @supplier.reload.as_json_summary }
      end

      # POST /api/v1/custom_quote_suppliers/:id/accept
      def accept_quote
        pos = CustomQuotePoCreatorService.accept!(supplier: @supplier, user: current_user)

        render json: {
          success: true,
          data: {
            supplier: @supplier.reload.as_json_summary,
            purchaseOrders: pos.map { |po| { id: po.id, description: po.description, budget: po.budget&.to_f } }
          }
        }
      end

      # POST /api/v1/custom_quote_suppliers/:id/reject
      def reject_quote
        @supplier.reject!
        render json: { success: true, data: @supplier.reload.as_json_summary }
      end

      # GET /api/v1/custom_quote_suppliers/:id/allocations
      def supplier_allocations
        allocations = @supplier.allocations.includes(:custom_quote_line, :purchase_order)

        render json: {
          success: true,
          data: allocations.map { |a| allocation_json(a) }
        }
      end

      # POST /api/v1/custom_quote_suppliers/:id/allocations
      def create_allocation
        allocation = @supplier.allocations.create!(
          custom_quote_line_id: params[:line_id],
          allocated_amount: params[:allocated_amount],
          notes: params[:notes]
        )

        render json: { success: true, data: allocation_json(allocation) }, status: :created
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Document upload endpoints (presign → S3 PUT → confirm)
      # ═══════════════════════════════════════════════════════════════════════════

      # POST /api/v1/custom_quote_suppliers/:id/presign_upload
      def presign_upload
        filename = params[:filename]
        content_type = params[:content_type] || "application/octet-stream"

        unless filename.present?
          return render_error("Filename required", status: :bad_request)
        end

        begin
          provider = DocumentProviders::S3Compatible.for_tenant(current_tenant)

          safe_filename = filename.gsub(/[^a-zA-Z0-9._-]/, "_")
          temp_key = "QuoteUploads/#{@supplier.id}/#{Time.current.to_i}_#{SecureRandom.hex(4)}_#{safe_filename}"

          upload_url = provider.presigned_upload_url(
            "",
            temp_key,
            expires_in: DocumentStorageConstants::PRESIGNED_URL_EXPIRY_DEFAULT,
            content_type: content_type
          )

          render json: {
            success: true,
            upload_url: upload_url,
            key: temp_key,
            filename: filename,
            content_type: content_type,
            expires_in: DocumentStorageConstants::PRESIGNED_URL_EXPIRY_DEFAULT
          }
        rescue DocumentProviders::NotConnectedError => e
          render_error("Storage not configured: #{e.message}", status: :service_unavailable)
        rescue => e
          Rails.logger.error "[CustomQuotesController#presign_upload] Failed: #{e.message}"
          render_error("Failed to generate upload URL", status: :unprocessable_entity)
        end
      end

      # POST /api/v1/custom_quote_suppliers/:id/extract_quote_data
      # Runs AI extraction on the supplier's attached quote PDF
      # Synchronous — quote PDFs are small (1-5 pages), Haiku is fast (~1-2s)
      def extract_quote_data
        doc = @supplier.warehouse_document
        unless doc&.storage_blob
          return render json: { success: false, error: "No document attached" }, status: :unprocessable_entity
        end

        result = QuoteParsingService.new.extract!(doc)
        render json: { success: true, data: result }
      rescue StandardError => e
        Rails.logger.error "[CustomQuotes#extract_quote_data] Failed for supplier #{@supplier.id}: #{e.message}"
        render json: { success: false, error: "Extraction failed: #{e.message}" }, status: :unprocessable_entity
      end

      # GET /api/v1/custom_quote_suppliers/:id/document_preview_url
      # Returns a presigned URL for viewing the attached quote document inline
      def document_preview_url
        doc = @supplier.warehouse_document
        unless doc&.storage_blob
          return render json: { success: false, error: "No document attached" }, status: :not_found
        end

        url = doc.storage_blob.presigned_url(expires_in: 1.hour.to_i, disposition: :inline)
        render json: {
          success: true,
          url: url,
          filename: doc.original_filename || doc.ui_name,
          contentType: doc.storage_blob.content_type
        }
      end

      # POST /api/v1/custom_quote_suppliers/:id/confirm_upload
      def confirm_upload
        key = params[:key]
        filename = params[:filename]
        content_type = params[:content_type] || "application/octet-stream"

        unless key.present? && filename.present?
          return render_error("Key and filename required", status: :bad_request)
        end

        begin
          provider = DocumentProviders::S3Compatible.for_tenant(current_tenant)

          content = provider.download_file(key)

          blob = StorageBlob.find_or_create_for_content!(
            content,
            filename: filename,
            content_type: content_type
          )
          blob.increment_reference!

          begin
            provider.delete_file(key)
          rescue StandardError => e
            Rails.logger.warn "[CustomQuotes] Failed to delete temp file #{key}: #{e.message}"
          end

          job = @supplier.custom_quote_line.custom_quote.job

          # Look up "Quote Returns" warehouse folder for filing
          quote_returns_folder = WarehouseFolder
            .joins(:warehouse_type)
            .where(warehouse_types: { code: "job" })
            .find_by(display_name: "Quote Returns")

          doc = WarehouseDocumentCreator.create!(
            filename: filename,
            source_type: "job",
            storage_blob: blob,
            linkable: job,
            warehouse_folder_id: quote_returns_folder&.id,
            metadata: { supplier_name: @supplier.supplier&.name, supplier_id: @supplier.supplier_id },
            user: current_user
          )

          @supplier.update!(warehouse_document: doc)

          render json: {
            success: true,
            warehouseDocumentId: doc.id,
            filename: filename
          }
        rescue DocumentProviders::NotFoundError
          render_error("File not found in storage. Upload may have failed.", status: :not_found)
        rescue DocumentProviders::NotConnectedError => e
          render_error("Storage not configured: #{e.message}", status: :service_unavailable)
        rescue => e
          Rails.logger.error "[CustomQuotesController#confirm_upload] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
          render_error("Failed to confirm upload: #{e.message}", status: :unprocessable_entity)
        end
      end

      private

      # ═══════════════════════════════════════════════════════════════════════════
      # Finders
      # ═══════════════════════════════════════════════════════════════════════════

      def set_template
        @template = CustomQuoteTemplate.find(params[:id])
      end

      def set_custom_quote
        @custom_quote = CustomQuote.find(params[:id])
      end

      def set_line
        @line = CustomQuoteLine.find(params[:id])
      end

      def set_supplier
        @supplier = CustomQuoteSupplier.find(params[:id])
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Strong params
      # ═══════════════════════════════════════════════════════════════════════════

      def template_params
        params.permit(:name, :description, :is_active, :position, :po_template_pack_id)
      end

      def quote_params
        params.permit(:name, :status)
      end

      def line_params
        params.permit(:name, :quote_level, :tender_description, :po_description,
                       :rfq_instructions, :position, :budget_amount, document_type_ids: [])
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # JSON serializers
      # ═══════════════════════════════════════════════════════════════════════════

      def template_json(template)
        {
          id: template.id,
          name: template.name,
          description: template.description,
          isActive: template.is_active,
          position: template.position,
          poTemplatePackId: template.po_template_pack_id,
          lineCount: template.line_count,
          createdBy: template.created_by&.name,
          createdAt: template.created_at,
          updatedAt: template.updated_at
        }
      end

      def quote_summary_json(quote)
        {
          id: quote.id,
          name: quote.name,
          status: quote.status,
          templateId: quote.custom_quote_template_id,
          templateName: quote.custom_quote_template&.name,
          totalQuoted: quote.total_quoted&.to_f,
          totalAllocated: quote.total_allocated&.to_f,
          variance: quote.variance,
          lineCount: quote.lines.count,
          createdBy: quote.created_by&.name,
          createdAt: quote.created_at
        }
      end

      def quote_tree_json(quote)
        {
          id: quote.id,
          jobId: quote.job_id,
          name: quote.name,
          status: quote.status,
          templateId: quote.custom_quote_template_id,
          templateName: quote.custom_quote_template&.name,
          totalQuoted: quote.total_quoted&.to_f,
          totalAllocated: quote.total_allocated&.to_f,
          variance: quote.variance,
          createdBy: quote.created_by&.name,
          tree: quote.as_tree
        }
      end

      def allocation_json(allocation)
        {
          id: allocation.id,
          lineId: allocation.custom_quote_line_id,
          lineName: allocation.custom_quote_line.name,
          allocatedAmount: allocation.allocated_amount&.to_f,
          notes: allocation.notes,
          purchaseOrderId: allocation.purchase_order_id
        }
      end

      def clone_template_lines(source, target)
        # Map old IDs to new IDs for parent references
        id_map = {}

        # First pass: root lines
        source.lines.where(parent_id: nil).order(:position).each do |src_line|
          new_line = src_line.dup
          new_line.custom_quote_template = target
          new_line.parent_id = nil
          new_line.save!
          id_map[src_line.id] = new_line.id
        end

        # Second pass: child lines
        source.lines.where.not(parent_id: nil).order(:position).each do |src_line|
          new_line = src_line.dup
          new_line.custom_quote_template = target
          new_line.parent_id = id_map[src_line.parent_id]
          new_line.save!
          id_map[src_line.id] = new_line.id
        end
      end
    end
  end
end
