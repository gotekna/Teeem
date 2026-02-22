# frozen_string_literal: true

module Api
  module V1
    class JobQuoteController < ApplicationController
      before_action :set_job, only: [:quote_summary, :apply_template, :rfq_documents]
      before_action :set_tracker, only: [:send_rfq, :record_response, :accept]

      # GET /api/v1/jobs/:job_id/quote_summary
      # Returns QuoteTracker rows grouped by PO Task (SmScheduleMaster) with best_price flags
      def summary
        trackers = QuoteTracker.where(job_id: @job.id)
          .includes(:sm_schedule_master, :sm_task, :sm_trade, :supplier, :contact, :sent_by, :purchase_order, :quote_template)
          .order(:sm_schedule_master_id, :supplier_id)

        # Group by PO Task (sm_schedule_master_id), falling back to sm_trade_id for legacy
        grouped = trackers.group_by { |t| t.sm_schedule_master_id || "trade_#{t.sm_trade_id}" }

        tasks = grouped.map do |group_key, group_trackers|
          first = group_trackers.first
          sm_master = first.sm_schedule_master
          {
            smScheduleMasterId: first.sm_schedule_master_id,
            smTradeId: first.sm_trade_id,
            taskName: sm_master&.name || first.sm_trade&.name || "Uncategorized",
            costCentre: sm_master&.cost_centre,
            totalSuppliers: group_trackers.size,
            respondedCount: group_trackers.count { |t| t.status == 'responded' || t.status == 'accepted' },
            sentCount: group_trackers.count { |t| t.status == 'sent' },
            bestPrice: group_trackers.select(&:is_best_price).first&.price_quoted&.to_f,
            suppliers: group_trackers.map { |t| tracker_json(t) }
          }
        end

        # Calculate total estimated cost (sum of best prices per task)
        total_estimated = tasks.sum { |t| t[:bestPrice] || 0 }

        render json: {
          success: true,
          data: {
            jobId: @job.id,
            jobName: @job.name,
            totalTasks: tasks.size,
            totalEstimated: total_estimated,
            tasks: tasks
          }
        }
      end

      # POST /api/v1/jobs/:job_id/apply_quote_template
      # Applies a template, creating QuoteTracker rows
      def apply_template
        template = QuoteTemplate.find(params[:template_id])

        # Check if there are existing trackers from this template
        existing = QuoteTracker.where(job_id: @job.id, quote_template_id: template.id).count
        if existing > 0
          render json: {
            success: false,
            error: "This template has already been applied to this job (#{existing} existing rows)"
          }, status: :unprocessable_entity
          return
        end

        rows = template.apply_to_job!(@job, created_by: current_user)

        render json: {
          success: true,
          data: {
            rowsCreated: rows.size,
            templateName: template.name
          },
          message: "Applied '#{template.name}' - created #{rows.size} quote tracker rows"
        }
      end

      # POST /api/v1/quote_trackers/:id/send_rfq
      # Sends an RFQ email to the supplier and marks tracker as sent
      def send_rfq
        # If no email params provided or skip_email=true, just mark as sent (backward compat)
        if params[:skip_email] == true || params[:skip_email] == "true" || params[:account_type].blank?
          @tracker.mark_sent!(current_user)
          render json: {
            success: true,
            data: tracker_json(@tracker.reload),
            message: "Marked as sent (no email dispatched)"
          }
          return
        end

        result = RfqSendingService.send_rfq(
          tracker: @tracker,
          user: current_user,
          email_template_id: params[:email_template_id],
          document_ids: params[:document_ids],
          custom_message: params[:custom_message],
          account_type: params[:account_type],
          credential_id: params[:credential_id],
          mailbox_email: params[:mailbox_email]
        )

        if result.success?
          render json: {
            success: true,
            data: tracker_json(@tracker.reload),
            message: "RFQ sent to #{@tracker.supplier&.display_name}"
          }
        else
          render json: {
            success: false,
            error: result.error,
            data: tracker_json(@tracker.reload)
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/quote_trackers/bulk_send_rfq
      # Sends RFQ emails to multiple suppliers at once
      def bulk_send_rfq
        tracker_ids = Array(params[:tracker_ids]).map(&:to_i)
        trackers = QuoteTracker.where(id: tracker_ids, status: 'draft')

        if trackers.empty?
          render json: { success: false, error: "No draft trackers found" }, status: :unprocessable_entity
          return
        end

        # If no email params, just mark all as sent
        if params[:skip_email] == true || params[:skip_email] == "true" || params[:account_type].blank?
          trackers.each { |t| t.mark_sent!(current_user) }
          render json: {
            success: true,
            message: "#{trackers.size} trackers marked as sent",
            data: { sent: trackers.size, failed: 0 }
          }
          return
        end

        bulk_result = RfqSendingService.send_bulk(
          trackers: trackers,
          user: current_user,
          email_template_id: params[:email_template_id],
          document_ids: params[:document_ids],
          custom_message: params[:custom_message],
          account_type: params[:account_type],
          credential_id: params[:credential_id],
          mailbox_email: params[:mailbox_email]
        )

        render json: {
          success: bulk_result.all_success?,
          message: "Sent #{bulk_result.sent}/#{bulk_result.total} RFQs",
          data: {
            sent: bulk_result.sent,
            failed: bulk_result.failed,
            errors: bulk_result.results.reject(&:success?).map { |r| { trackerId: r.tracker_id, error: r.error } }
          }
        }
      end

      # POST /api/v1/quote_trackers/:id/record_response
      # Records a supplier's price response
      def record_response
        price = params[:price_quoted]
        raise "Price is required" unless price.present?

        @tracker.record_response!(
          price: price.to_f,
          timeframe: params[:timeframe],
          notes: params[:response_notes]
        )

        render json: {
          success: true,
          data: tracker_json(@tracker.reload)
        }
      end

      # POST /api/v1/quote_trackers/:id/accept
      # Accepts a quote and creates a PO
      def accept
        po = @tracker.accept_and_create_po!(current_user)

        render json: {
          success: true,
          data: {
            tracker: tracker_json(@tracker.reload),
            purchaseOrder: {
              id: po.id,
              poNumber: po.purchase_order_number,
              budget: po.budget&.to_f
            }
          },
          message: "Quote accepted. Purchase Order #{po.purchase_order_number} created."
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/jobs/:job_id/rfq_documents
      # Returns WarehouseDocuments for this job that can be attached to RFQs
      def rfq_documents
        documents = WarehouseDocument.where(
          documentable_type: 'Job',
          documentable_id: @job.id
        ).includes(:storage_blob)
         .where.not(storage_blobs: { id: nil })
         .order(:ui_name)
         .limit(50)

        render json: {
          success: true,
          data: documents.map { |doc|
            {
              id: doc.id,
              name: doc.ui_name || doc.original_filename,
              folder: doc.folder_path,
              contentType: doc.storage_blob&.content_type,
              size: doc.storage_blob&.byte_size
            }
          }
        }
      end

      # GET /api/v1/rfq_email_templates
      # Returns email templates available for RFQ composition
      def email_templates
        templates = EmailTemplate.available_to(current_user)
                                 .where(category: 'quote')
                                 .or(EmailTemplate.available_to(current_user).where(category: 'other'))
                                 .ordered

        render json: {
          success: true,
          data: templates.map { |t|
            {
              id: t.id,
              name: t.name,
              subject: t.subject,
              category: t.category,
              variables: t.variables,
              isShared: t.is_shared
            }
          }
        }
      end

      # GET /api/v1/rfq_email_accounts
      # Returns available email accounts for sending RFQs
      def email_accounts
        accounts = []

        # IMAP accounts
        ImapCredential.accessible_by(current_user).where(is_active: true).each do |cred|
          accounts << {
            id: cred.id,
            type: 'imap',
            email: cred.email_address,
            label: cred.display_name || cred.email_address
          }
        end

        # MS365 accounts
        tenant_org_ids = current_user.tenant&.organizations&.pluck(:id) || []
        MicrosoftCredential.where(organization_id: tenant_org_ids)
                           .where(credential_type: 'app')
                           .each do |cred|
          mailboxes = cred.monitored_mailboxes || []
          mailboxes.each do |mb|
            accounts << {
              id: cred.id,
              type: 'ms365',
              email: mb,
              label: mb
            }
          end
        end

        render json: { success: true, data: accounts }
      end

      # POST /api/v1/rfq_email_preview
      # Previews the composed RFQ email with template variables substituted
      def email_preview
        tracker = QuoteTracker.find(params[:tracker_id])
        job = tracker.job

        template = if params[:email_template_id].present?
                     EmailTemplate.available_to(current_user).find_by(id: params[:email_template_id])
                   end

        if template
          context = {
            job_name: job.name,
            job_number: job.job_code,
            job_address: job.address,
            trade_name: tracker.task_name,
            task_name: tracker.task_name,
            supplier_name: tracker.supplier&.display_name,
            recipient_name: tracker.contact&.name || tracker.supplier&.display_name,
            recipient_email: tracker.contact&.email || tracker.contact_email || tracker.supplier&.email,
            recipient_company: tracker.supplier&.display_name,
            sender_name: current_user.name,
            sender_email: current_user.email,
            sender_phone: current_user.phone,
            today_date: Date.current.strftime("%d %B %Y"),
            company_name: current_user.tenant&.name,
            instructions: tracker.quote_request_instructions
          }
          rendered = template.apply(context)
          subject = rendered[:subject]
          body = rendered[:body_html]
        else
          subject = "Request for Quote - #{job.name} (#{job.job_code})"
          body = "<p>Default RFQ email will be generated.</p>"
        end

        render json: {
          success: true,
          data: {
            subject: subject,
            body: body,
            recipientEmail: tracker.contact&.email || tracker.contact_email || tracker.supplier&.email,
            recipientName: tracker.contact&.name || tracker.supplier&.display_name
          }
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id] || params[:id])
      end

      def set_tracker
        @tracker = QuoteTracker.find(params[:id])
      end

      def tracker_json(tracker)
        {
          id: tracker.id,
          jobId: tracker.job_id,
          smScheduleMasterId: tracker.sm_schedule_master_id,
          smTaskId: tracker.sm_task_id,
          smTradeId: tracker.sm_trade_id,
          taskName: tracker.task_name,
          supplierId: tracker.supplier_id,
          supplierName: tracker.supplier&.display_name,
          contactId: tracker.contact_id,
          contactName: tracker.contact&.name,
          contactEmail: tracker.contact_email,
          status: tracker.status,
          requestedDate: tracker.requested_date&.iso8601,
          received: tracker.received,
          dateReceived: tracker.date_received&.iso8601,
          quoteNumber: tracker.quote_number,
          priceQuoted: tracker.price_quoted&.to_f,
          validTo: tracker.valid_to&.iso8601,
          instructions: tracker.quote_request_instructions,
          estimatingNotes: tracker.estimating_notes,
          sentAt: tracker.sent_at&.iso8601,
          sentByName: tracker.sent_by&.name,
          isBestPrice: tracker.is_best_price,
          purchaseOrderId: tracker.purchase_order_id,
          purchaseOrderNumber: tracker.purchase_order&.purchase_order_number,
          quoteTemplateId: tracker.quote_template_id,
          responseNotes: tracker.response_notes,
          timeframe: tracker.timeframe,
          createdAt: tracker.created_at&.iso8601,
          updatedAt: tracker.updated_at&.iso8601
        }
      end
    end
  end
end
