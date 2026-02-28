module Api
  module V1
    module Portal
      class InvoicesController < BaseController
        before_action :require_subcontractor

        # GET /api/v1/portal/invoices
        # List all invoices for the logged-in subcontractor
        def index
          invoices = current_contact.subcontractor_invoices
                                    .includes(:purchase_order, :accounting_integration)
                                    .order(created_at: :desc)

          # Filter by status if provided
          if params[:status].present?
            invoices = invoices.where(status: params[:status])
          end

          # Categorize invoices
          data = {
            pending: invoices.where(status: "pending").map { |inv| invoice_json(inv) },
            synced: invoices.where(status: "synced").map { |inv| invoice_json(inv) },
            paid: invoices.where(status: "paid").map { |inv| invoice_json(inv) },
            failed: invoices.where(status: "failed").map { |inv| invoice_json(inv) },
            all_invoices: invoices.map { |inv| invoice_json(inv) },
            summary: {
              total_pending_amount: invoices.where(status: "pending").sum(:amount),
              total_synced_amount: invoices.where(status: "synced").sum(:amount),
              total_paid_amount: invoices.where(status: "paid").sum(:amount),
              invoices_count: invoices.count
            }
          }

          render json: { success: true, data: data }
        end

        # GET /api/v1/portal/invoices/:id
        # View a specific invoice
        def show
          invoice = current_contact.subcontractor_invoices.find(params[:id])

          render json: {
            success: true,
            data: invoice_json(invoice).merge(
              purchase_order: {
                id: invoice.purchase_order.id,
                po_number: invoice.purchase_order.po_number,
                total: invoice.purchase_order.total,
                construction: {
                  name: invoice.purchase_order.job.job_name,
                  address: invoice.purchase_order.job.street_address
                }
              },
              accounting_integration: invoice.accounting_integration ? {
                id: invoice.accounting_integration.id,
                system_type: invoice.accounting_integration.system_type,
                organization_id: invoice.accounting_integration.organization_id,
                sync_status: invoice.accounting_integration.sync_status
              } : nil
            )
          }
        end

        # GET /api/v1/portal/invoices/search_purchase_orders?q=...
        # Search subcontractor's POs by PO number or job name
        def search_purchase_orders
          pos = current_contact.purchase_orders
                               .includes(:job)
                               .where.not(status: "cancelled")
                               .order(created_at: :desc)
                               .limit(20)

          if params[:q].present?
            q = "%#{params[:q]}%"
            pos = pos.joins(:job).where(
              "purchase_orders.purchase_order_number ILIKE :q OR jobs.name ILIKE :q",
              q: q
            )
          end

          data = pos.map do |po|
            already_invoiced = SubcontractorInvoice.already_invoiced_for_po(po.id)
            remaining = (po.total || 0) - already_invoiced

            {
              id: po.id,
              po_number: po.purchase_order_number,
              job_name: po.job&.name,
              job_code: po.job&.job_code,
              total: po.total,
              already_invoiced: already_invoiced,
              remaining_amount: remaining,
              payment_terms_days: parse_payment_terms(current_contact.payment_terms),
              status: po.status
            }
          end

          render json: { success: true, data: data }
        end

        # POST /api/v1/portal/invoices
        # Create a new invoice for a purchase order
        def create
          purchase_order = current_contact.purchase_orders.find(params[:purchase_order_id])

          # Validate amount
          amount = params[:amount].to_f
          if amount <= 0
            render_error("Invoice amount must be greater than zero", status: :unprocessable_entity)
            return
          end

          # Check against remaining PO balance (allows multiple partial invoices)
          already_invoiced = SubcontractorInvoice.already_invoiced_for_po(purchase_order.id)
          remaining = (purchase_order.total || 0) - already_invoiced

          if amount > remaining
            render_error("Invoice amount cannot exceed remaining PO balance of $#{'%.2f' % remaining}", status: :unprocessable_entity)
            return
          end

          completion_pct = (params[:completion_percentage] || 100).to_i
          unless completion_pct.between?(1, 100)
            render_error("Completion percentage must be between 1 and 100", status: :unprocessable_entity)
            return
          end

          ActiveRecord::Base.transaction do
            # Handle invoice file upload (optional)
            blob = nil
            if params[:invoice_file].present?
              uploaded = params[:invoice_file]
              blob = StorageBlob.find_or_create_for_content!(
                uploaded.read,
                filename: uploaded.original_filename,
                content_type: uploaded.content_type
              )
            end

            # Create SM task if partial completion
            sm_task = nil
            if completion_pct < 100 && params[:remaining_work_description].present?
              sm_task = create_remaining_work_task(
                purchase_order,
                params[:remaining_work_description],
                completion_pct
              )
            end

            # Create invoice
            invoice = purchase_order.subcontractor_invoices.build(
              contact: current_contact,
              amount: amount,
              status: "pending",
              completion_percentage: completion_pct,
              remaining_work_description: params[:remaining_work_description],
              invoice_file_blob: blob,
              sm_task: sm_task
            )

            # Link to accounting integration if available
            accounting_integration = current_contact.accounting_integrations&.active&.first
            invoice.accounting_integration = accounting_integration if accounting_integration

            if invoice.save
              payment_terms = parse_payment_terms(current_contact.payment_terms)
              estimated_due = Time.current + payment_terms.days

              render json: {
                success: true,
                message: "Invoice created successfully",
                data: invoice_json(invoice).merge(
                  payment_terms_days: payment_terms,
                  estimated_due_date: estimated_due.strftime("%Y-%m-%d"),
                  sm_task_created: sm_task.present?
                ),
                will_auto_sync: accounting_integration.present?
              }, status: :created
            else
              render json: {
                success: false,
                error: "Failed to create invoice",
                errors: invoice.errors.full_messages
              }, status: :unprocessable_entity
            end
          end
        end

        # PATCH /api/v1/portal/invoices/:id
        # Update an invoice (only allowed if status is pending)
        def update
          invoice = current_contact.subcontractor_invoices.find(params[:id])

          unless invoice.pending?
            render_error("Can only update pending invoices", status: :unprocessable_entity)
            return
          end

          if invoice.update(invoice_params)
            render json: {
              success: true,
              message: "Invoice updated successfully",
              data: invoice_json(invoice)
            }
          else
            render json: {
              success: false,
              error: "Failed to update invoice",
              errors: invoice.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/portal/invoices/:id
        # Delete an invoice (only allowed if status is pending or failed)
        def destroy
          invoice = current_contact.subcontractor_invoices.find(params[:id])

          unless invoice.pending? || invoice.failed?
            render_error("Can only delete pending or failed invoices", status: :unprocessable_entity)
            return
          end

          if invoice.destroy
            render json: {
              success: true,
              message: "Invoice deleted successfully"
            }
          else
            render json: {
              success: false,
              error: "Failed to delete invoice"
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/portal/invoices/:id/retry_sync
        # Retry syncing a failed invoice
        def retry_sync
          invoice = current_contact.subcontractor_invoices.find(params[:id])

          unless invoice.failed?
            render_error("Can only retry failed invoices", status: :unprocessable_entity)
            return
          end

          unless invoice.accounting_integration&.active?
            render_error("No active accounting integration found", status: :unprocessable_entity)
            return
          end

          # Reset status to pending
          invoice.update(status: "pending", error_message: nil)

          # TODO: Enqueue AccountingSyncJob.perform_later(invoice.id)

          render json: {
            success: true,
            message: "Invoice sync retry queued",
            data: invoice_json(invoice)
          }
        end

        # GET /api/v1/portal/invoices/stats
        # Get invoice statistics for dashboard
        def stats
          invoices = current_contact.subcontractor_invoices

          data = {
            total_invoiced: invoices.sum(:amount),
            total_paid: invoices.where(status: "paid").sum(:amount),
            total_outstanding: invoices.where(status: %w[pending synced]).sum(:amount),
            invoices_count: invoices.count,
            paid_invoices_count: invoices.where(status: "paid").count,
            outstanding_invoices_count: invoices.where(status: %w[pending synced]).count,
            average_payment_time_days: calculate_average_payment_time,
            recent_invoices: invoices.order(created_at: :desc).limit(5).map { |inv| invoice_json(inv) }
          }

          render json: { success: true, data: data }
        end

        private

        def invoice_params
          params.require(:invoice).permit(:amount)
        end

        def invoice_json(invoice)
          {
            id: invoice.id,
            amount: invoice.amount,
            status: invoice.status,
            external_invoice_id: invoice.external_invoice_id,
            synced_at: invoice.synced_at,
            paid_at: invoice.paid_at,
            error_message: invoice.error_message,
            created_at: invoice.created_at,
            purchase_order_id: invoice.purchase_order_id,
            po_number: invoice.purchase_order.po_number,
            construction_name: invoice.purchase_order.job&.name,
            completion_percentage: invoice.completion_percentage,
            days_outstanding: invoice.paid_at ? nil : (Time.current - invoice.created_at).to_i / 1.day,
            can_edit: invoice.pending?,
            can_delete: invoice.pending? || invoice.failed?,
            can_retry: invoice.failed?
          }
        end

        def calculate_average_payment_time
          paid_invoices = current_contact.subcontractor_invoices.where.not(paid_at: nil)
          return 0 if paid_invoices.empty?

          total_days = paid_invoices.sum do |invoice|
            (invoice.paid_at - invoice.created_at).to_i / 1.day
          end

          (total_days.to_f / paid_invoices.count).round(1)
        end

        # Parse payment terms string (e.g., "30 days", "Net 30") into integer days
        def parse_payment_terms(terms_string)
          return 30 unless terms_string.present?

          match = terms_string.match(/(\d+)/)
          match ? match[1].to_i : 30
        end

        # Create an SmTask for the job's supervisor to follow up on remaining work
        def create_remaining_work_task(purchase_order, description, completion_pct)
          job = purchase_order.job
          return nil unless job

          # Find next available task number for this job
          max_task_number = SmTask.where(job_id: job.id).maximum(:task_number) || 0
          next_task_number = max_task_number + 1

          # Find the next available sequence order
          max_sequence = SmTask.where(job_id: job.id).maximum(:sequence_order) || 0
          next_sequence = max_sequence + 1

          task = SmTask.new(
            job: job,
            task_number: next_task_number,
            name: "Complete remaining work - #{purchase_order.purchase_order_number}",
            description: "#{completion_pct}% complete. Remaining work: #{description}\n\nSubmitted via subcontractor portal invoice.",
            sequence_order: next_sequence,
            start_date: Date.current,
            end_date: Date.current + 7.days,
            duration_days: 7,
            status: "not_started",
            require_photo: true,
            submitted_via_portal: true,
            supplier_id: current_contact.id,
            assigned_user_id: job.supervisor_id,
            source_type: "portal"
          )

          # Set tenant if available
          task.tenant_id = job.tenant_id if job.respond_to?(:tenant_id)

          task.save!
          task
        end
      end
    end
  end
end
