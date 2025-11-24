module Api
  module V1
    module Portal
      class JobsController < BaseController
        before_action :require_subcontractor

        # GET /api/v1/portal/jobs
        # List all active jobs for the logged-in subcontractor
        def index
          purchase_orders = current_contact.purchase_orders
                                          .includes(:construction, :quote_response, :subcontractor_invoices)
                                          .order(created_at: :desc)

          # Filter by status if provided
          if params[:status].present?
            purchase_orders = purchase_orders.where(status: params[:status])
          end

          # Categorize jobs
          data = {
            upcoming: purchase_orders.where(status: 'approved').where('arrived_at IS NULL').map { |po| job_json(po) },
            in_progress: purchase_orders.where(status: 'approved').where('arrived_at IS NOT NULL AND completed_at IS NULL').map { |po| job_json(po) },
            completed: purchase_orders.where(status: 'approved').where('completed_at IS NOT NULL').map { |po| job_json(po) },
            all_jobs: purchase_orders.map { |po| job_json(po) }
          }

          render json: { success: true, data: data }
        end

        # GET /api/v1/portal/jobs/:id
        # View a specific job with full details
        def show
          purchase_order = current_contact.purchase_orders.find(params[:id])

          render json: {
            success: true,
            data: job_json(purchase_order).merge(
              quote_response: purchase_order.quote_response ? {
                id: purchase_order.quote_response.id,
                price: purchase_order.quote_response.price,
                timeframe: purchase_order.quote_response.timeframe,
                notes: purchase_order.quote_response.notes,
                submitted_at: purchase_order.quote_response.submitted_at
              } : nil,
              invoices: purchase_order.subcontractor_invoices.map { |inv| invoice_json(inv) },
              kudos_events: purchase_order.kudos_events.map { |event| kudos_event_json(event) }
            )
          }
        end

        # POST /api/v1/portal/jobs/:id/mark_arrival
        # Mark arrival on site
        def mark_arrival
          purchase_order = current_contact.purchase_orders.find(params[:id])

          if purchase_order.arrived_at.present?
            render json: { success: false, error: 'Arrival already recorded' }, status: :unprocessable_entity
            return
          end

          arrival_time = params[:arrival_time].present? ? Time.zone.parse(params[:arrival_time]) : Time.current

          if purchase_order.mark_arrived!(arrival_time)
            render json: {
              success: true,
              message: 'Arrival recorded successfully',
              data: job_json(purchase_order),
              kudos_awarded: calculate_arrival_kudos(purchase_order)
            }
          else
            render json: {
              success: false,
              error: 'Failed to record arrival',
              errors: purchase_order.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/portal/jobs/:id/mark_complete
        # Mark job as completed
        def mark_complete
          purchase_order = current_contact.purchase_orders.find(params[:id])

          if purchase_order.completed_at.present?
            render json: { success: false, error: 'Completion already recorded' }, status: :unprocessable_entity
            return
          end

          unless purchase_order.arrived_at.present?
            render json: { success: false, error: 'Cannot mark complete before arrival' }, status: :unprocessable_entity
            return
          end

          completion_time = params[:completion_time].present? ? Time.zone.parse(params[:completion_time]) : Time.current

          if purchase_order.mark_completed!(completion_time)
            render json: {
              success: true,
              message: 'Job marked as complete',
              data: job_json(purchase_order),
              kudos_awarded: calculate_completion_kudos(purchase_order)
            }
          else
            render json: {
              success: false,
              error: 'Failed to mark complete',
              errors: purchase_order.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/portal/jobs/:id/photos
        # Upload site photos (placeholder for future file upload implementation)
        def upload_photos
          purchase_order = current_contact.purchase_orders.find(params[:id])

          # TODO: Implement file upload handling with ActiveStorage or similar
          # For now, just acknowledge the request

          render json: {
            success: true,
            message: 'Photo upload endpoint (to be implemented with file storage)',
            data: {
              job_id: purchase_order.id,
              note: 'File upload implementation pending'
            }
          }
        end

        # POST /api/v1/portal/jobs/:id/issues
        # Report issues or problems with a job
        def report_issue
          purchase_order = current_contact.purchase_orders.find(params[:id])

          issue_details = {
            reported_at: Time.current,
            reported_by: current_portal_user.display_name,
            issue_type: params[:issue_type],
            description: params[:description],
            severity: params[:severity] || 'medium'
          }

          # Store in metadata for now (could be expanded to separate issues table)
          metadata = purchase_order.metadata || {}
          metadata['issues'] ||= []
          metadata['issues'] << issue_details

          if purchase_order.update(metadata: metadata)
            # TODO: Send notification to builder
            render json: {
              success: true,
              message: 'Issue reported successfully',
              data: issue_details
            }
          else
            render json: {
              success: false,
              error: 'Failed to report issue',
              errors: purchase_order.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        private

        def job_json(purchase_order)
          {
            id: purchase_order.id,
            po_number: purchase_order.po_number,
            status: purchase_order.status,
            total: purchase_order.total,
            notes: purchase_order.notes,
            arrived_at: purchase_order.arrived_at,
            completed_at: purchase_order.completed_at,
            created_at: purchase_order.created_at,
            construction: {
              id: purchase_order.construction.id,
              name: purchase_order.construction.job_name,
              address: purchase_order.construction.street_address,
              city: purchase_order.construction.city,
              state: purchase_order.construction.state,
              postcode: purchase_order.construction.postcode
            },
            builder: {
              name: purchase_order.construction.business_name || 'Builder'
            },
            is_arrived: purchase_order.arrived_at.present?,
            is_completed: purchase_order.completed_at.present?,
            days_on_site: purchase_order.arrived_at ? ((purchase_order.completed_at || Time.current) - purchase_order.arrived_at) / 1.day : nil,
            invoice_status: invoice_status_for_po(purchase_order)
          }
        end

        def invoice_json(invoice)
          {
            id: invoice.id,
            amount: invoice.amount,
            status: invoice.status,
            external_invoice_id: invoice.external_invoice_id,
            synced_at: invoice.synced_at,
            paid_at: invoice.paid_at,
            created_at: invoice.created_at
          }
        end

        def kudos_event_json(event)
          {
            id: event.id,
            event_type: event.event_type,
            points_awarded: event.points_awarded,
            expected_time: event.expected_time,
            actual_time: event.actual_time,
            created_at: event.created_at
          }
        end

        def invoice_status_for_po(purchase_order)
          invoices = purchase_order.subcontractor_invoices
          return 'not_invoiced' if invoices.empty?
          return 'paid' if invoices.any?(&:paid?)
          return 'synced' if invoices.any?(&:synced?)
          'pending'
        end

        def calculate_arrival_kudos(purchase_order)
          event = purchase_order.kudos_events.where(event_type: 'arrival').last
          event&.points_awarded || 0
        end

        def calculate_completion_kudos(purchase_order)
          event = purchase_order.kudos_events.where(event_type: 'completion').last
          event&.points_awarded || 0
        end
      end
    end
  end
end
