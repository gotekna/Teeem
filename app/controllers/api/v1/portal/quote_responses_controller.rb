module Api
  module V1
    module Portal
      class QuoteResponsesController < BaseController
        before_action :require_subcontractor

        # POST /api/v1/portal/quote_responses
        # Submit a quote response
        def create
          quote_request = QuoteRequest.find(params[:quote_request_id])

          # Check if subcontractor is invited to this quote
          unless quote_request.contacts.include?(current_contact)
            render json: { success: false, error: 'Not authorized for this quote request' }, status: :forbidden
            return
          end

          # Check if already responded
          existing_response = quote_request.quote_responses.find_by(contact: current_contact)
          if existing_response && !existing_response.pending?
            render json: { success: false, error: 'Quote already submitted' }, status: :unprocessable_entity
            return
          end

          quote_response = if existing_response
            existing_response
          else
            quote_request.quote_responses.build(
              contact: current_contact,
              responded_by_portal_user: current_portal_user
            )
          end

          if quote_response.submit!(quote_response_params)
            render json: {
              success: true,
              message: 'Quote submitted successfully',
              data: quote_response_json(quote_response)
            }, status: :created
          else
            render json: {
              success: false,
              error: 'Failed to submit quote',
              errors: quote_response.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/portal/quote_responses/:id
        # Update a pending quote response
        def update
          quote_response = current_contact.quote_responses.find(params[:id])

          unless quote_response.pending?
            render json: { success: false, error: 'Can only update pending quotes' }, status: :unprocessable_entity
            return
          end

          if quote_response.update(quote_response_params)
            render json: {
              success: true,
              message: 'Quote updated successfully',
              data: quote_response_json(quote_response)
            }
          else
            render json: {
              success: false,
              error: 'Failed to update quote',
              errors: quote_response.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/portal/quote_responses/:id
        # View a specific quote response
        def show
          quote_response = current_contact.quote_responses.find(params[:id])

          render json: {
            success: true,
            data: quote_response_json(quote_response).merge(
              quote_request: {
                id: quote_response.quote_request.id,
                title: quote_response.quote_request.title,
                description: quote_response.quote_request.description,
                construction: {
                  name: quote_response.quote_request.construction.job_name,
                  address: quote_response.quote_request.construction.street_address
                }
              }
            )
          }
        end

        private

        def quote_response_params
          params.require(:quote_response).permit(:price, :timeframe, :notes)
        end

        def quote_response_json(response)
          {
            id: response.id,
            price: response.price,
            timeframe: response.timeframe,
            notes: response.notes,
            status: response.status,
            submitted_at: response.submitted_at,
            decision_at: response.decision_at,
            response_time_hours: response.response_time_hours
          }
        end
      end
    end
  end
end
