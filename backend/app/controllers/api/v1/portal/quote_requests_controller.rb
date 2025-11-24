module Api
  module V1
    module Portal
      class QuoteRequestsController < BaseController
        before_action :require_subcontractor

        # GET /api/v1/portal/quote_requests
        # List all quote requests for the logged-in subcontractor
        def index
          quote_requests = current_contact.quote_requests
                                          .includes(:construction, :created_by, quote_responses: :contact)
                                          .order(created_at: :desc)

          # Filter by status if provided
          if params[:status].present?
            quote_requests = quote_requests.where(status: params[:status])
          end

          # Separate into categories for frontend
          data = {
            pending: quote_requests_with_responses(quote_requests.pending_response),
            submitted: quote_requests_with_my_response(quote_requests, 'submitted'),
            accepted: quote_requests_with_my_response(quote_requests, 'accepted'),
            rejected: quote_requests_with_my_response(quote_requests, 'rejected')
          }

          render json: { success: true, data: data }
        end

        # GET /api/v1/portal/quote_requests/:id
        # View a specific quote request
        def show
          quote_request = current_contact.quote_requests.find(params[:id])
          my_response = quote_request.quote_responses.find_by(contact: current_contact)

          render json: {
            success: true,
            data: {
              quote_request: quote_request_json(quote_request),
              my_response: my_response ? quote_response_json(my_response) : nil,
              other_responses_count: quote_request.response_count - (my_response ? 1 : 0)
            }
          }
        end

        # POST /api/v1/portal/quote_requests/:id/reject
        # Reject a quote request (subby doesn't want to quote)
        def reject
          quote_request = current_contact.quote_requests.find(params[:id])
          my_response = quote_request.quote_responses.find_by(contact: current_contact)

          if my_response
            my_response.reject!
          else
            # Create a rejected response
            quote_request.quote_responses.create!(
              contact: current_contact,
              responded_by_portal_user: current_portal_user,
              price: 0,
              status: 'rejected'
            )
          end

          render json: {
            success: true,
            message: 'Quote request rejected'
          }
        end

        private

        def quote_requests_with_responses(quote_requests)
          quote_requests.map do |qr|
            my_response = qr.quote_responses.find_by(contact: current_contact)
            quote_request_json(qr).merge(
              my_response: my_response ? quote_response_json(my_response) : nil,
              days_waiting: qr.days_waiting
            )
          end
        end

        def quote_requests_with_my_response(quote_requests, status)
          quote_requests.joins(:quote_responses)
                       .where(quote_responses: { contact_id: current_contact.id, status: status })
                       .distinct
                       .map do |qr|
            my_response = qr.quote_responses.find_by(contact: current_contact, status: status)
            quote_request_json(qr).merge(
              my_response: quote_response_json(my_response)
            )
          end
        end

        def quote_request_json(quote_request)
          {
            id: quote_request.id,
            title: quote_request.title,
            description: quote_request.description,
            trade_category: quote_request.trade_category,
            requested_date: quote_request.requested_date,
            budget_min: quote_request.budget_min,
            budget_max: quote_request.budget_max,
            status: quote_request.status,
            created_at: quote_request.created_at,
            construction: {
              id: quote_request.construction.id,
              name: quote_request.construction.job_name,
              address: quote_request.construction.street_address
            },
            created_by: {
              name: quote_request.created_by.name
            }
          }
        end

        def quote_response_json(response)
          {
            id: response.id,
            price: response.price,
            timeframe: response.timeframe,
            notes: response.notes,
            status: response.status,
            submitted_at: response.submitted_at,
            decision_at: response.decision_at
          }
        end
      end
    end
  end
end
