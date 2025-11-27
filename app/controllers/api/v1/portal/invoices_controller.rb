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
            pending: invoices.where(status: 'pending').map { |inv| invoice_json(inv) },
            synced: invoices.where(status: 'synced').map { |inv| invoice_json(inv) },
            paid: invoices.where(status: 'paid').map { |inv| invoice_json(inv) },
            failed: invoices.where(status: 'failed').map { |inv| invoice_json(inv) },
            all_invoices: invoices.map { |inv| invoice_json(inv) },
            summary: {
              total_pending_amount: invoices.where(status: 'pending').sum(:amount),
              total_synced_amount: invoices.where(status: 'synced').sum(:amount),
              total_paid_amount: invoices.where(status: 'paid').sum(:amount),
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
                  name: invoice.purchase_order.construction.job_name,
                  address: invoice.purchase_order.construction.street_address
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

        # POST /api/v1/portal/invoices
        # Create a new invoice for a purchase order
        def create
          purchase_order = current_contact.purchase_orders.find(params[:purchase_order_id])

          # Validate job is completed
          unless purchase_order.completed_at.present?
            render json: { success: false, error: 'Cannot invoice incomplete jobs' }, status: :unprocessable_entity
            return
          end

          # Check for existing invoice
          if purchase_order.subcontractor_invoices.any?
            render json: { success: false, error: 'Purchase order already has an invoice' }, status: :unprocessable_entity
            return
          end

          # Validate amount
          amount = params[:amount].to_f
          if amount <= 0
            render json: { success: false, error: 'Invoice amount must be greater than zero' }, status: :unprocessable_entity
            return
          end

          if amount > purchase_order.total
            render json: { success: false, error: "Invoice amount cannot exceed PO total of $#{purchase_order.total}" }, status: :unprocessable_entity
            return
          end

          # Create invoice
          invoice = purchase_order.subcontractor_invoices.build(
            contact: current_contact,
            amount: amount,
            status: 'pending'
          )

          # Link to accounting integration if available
          accounting_integration = current_contact.accounting_integrations.active.first
          invoice.accounting_integration = accounting_integration if accounting_integration

          if invoice.save
            # Trigger async sync if accounting connected
            # TODO: Enqueue AccountingSyncJob.perform_later(invoice.id)

            render json: {
              success: true,
              message: 'Invoice created successfully',
              data: invoice_json(invoice),
              will_auto_sync: accounting_integration.present?
            }, status: :created
          else
            render json: {
              success: false,
              error: 'Failed to create invoice',
              errors: invoice.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/portal/invoices/:id
        # Update an invoice (only allowed if status is pending)
        def update
          invoice = current_contact.subcontractor_invoices.find(params[:id])

          unless invoice.pending?
            render json: { success: false, error: 'Can only update pending invoices' }, status: :unprocessable_entity
            return
          end

          if invoice.update(invoice_params)
            render json: {
              success: true,
              message: 'Invoice updated successfully',
              data: invoice_json(invoice)
            }
          else
            render json: {
              success: false,
              error: 'Failed to update invoice',
              errors: invoice.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/portal/invoices/:id
        # Delete an invoice (only allowed if status is pending or failed)
        def destroy
          invoice = current_contact.subcontractor_invoices.find(params[:id])

          unless invoice.pending? || invoice.failed?
            render json: { success: false, error: 'Can only delete pending or failed invoices' }, status: :unprocessable_entity
            return
          end

          if invoice.destroy
            render json: {
              success: true,
              message: 'Invoice deleted successfully'
            }
          else
            render json: {
              success: false,
              error: 'Failed to delete invoice'
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/portal/invoices/:id/retry_sync
        # Retry syncing a failed invoice
        def retry_sync
          invoice = current_contact.subcontractor_invoices.find(params[:id])

          unless invoice.failed?
            render json: { success: false, error: 'Can only retry failed invoices' }, status: :unprocessable_entity
            return
          end

          unless invoice.accounting_integration&.active?
            render json: { success: false, error: 'No active accounting integration found' }, status: :unprocessable_entity
            return
          end

          # Reset status to pending
          invoice.update(status: 'pending', error_message: nil)

          # TODO: Enqueue AccountingSyncJob.perform_later(invoice.id)

          render json: {
            success: true,
            message: 'Invoice sync retry queued',
            data: invoice_json(invoice)
          }
        end

        # GET /api/v1/portal/invoices/stats
        # Get invoice statistics for dashboard
        def stats
          invoices = current_contact.subcontractor_invoices

          data = {
            total_invoiced: invoices.sum(:amount),
            total_paid: invoices.where(status: 'paid').sum(:amount),
            total_outstanding: invoices.where(status: %w[pending synced]).sum(:amount),
            invoices_count: invoices.count,
            paid_invoices_count: invoices.where(status: 'paid').count,
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
            construction_name: invoice.purchase_order.construction.job_name,
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
      end
    end
  end
end
