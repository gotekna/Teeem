module Api
  module V1
    class QuoteRequestsController < ApplicationController
      before_action :set_quote_request, only: [:show, :update, :destroy, :accept_quote, :close]

      # GET /api/v1/quote_requests
      # List all quote requests for the current user's company
      def index
        quote_requests = QuoteRequest.includes(:construction, :created_by, :contacts, quote_responses: :contact)
                                    .order(created_at: :desc)

        # Filter by construction if provided
        if params[:construction_id].present?
          quote_requests = quote_requests.where(construction_id: params[:construction_id])
        end

        # Filter by status if provided
        if params[:status].present?
          quote_requests = quote_requests.where(status: params[:status])
        end

        # Filter by trade category if provided
        if params[:trade_category].present?
          quote_requests = quote_requests.where(trade_category: params[:trade_category])
        end

        data = {
          quote_requests: quote_requests.map { |qr| quote_request_json(qr) },
          summary: {
            total_count: quote_requests.count,
            pending_count: quote_requests.where(status: 'pending_response').count,
            closed_count: quote_requests.where(status: 'closed').count,
            total_budget: quote_requests.sum('(budget_min + budget_max) / 2')
          }
        }

        render json: { success: true, data: data }
      end

      # GET /api/v1/quote_requests/:id
      # View a specific quote request with all responses
      def show
        data = quote_request_json(@quote_request).merge(
          responses: @quote_request.quote_responses.order(submitted_at: :desc).map do |response|
            quote_response_detail_json(response)
          end,
          response_stats: {
            total_responses: @quote_request.quote_responses.count,
            submitted_count: @quote_request.quote_responses.where(status: 'submitted').count,
            accepted_count: @quote_request.quote_responses.where(status: 'accepted').count,
            rejected_count: @quote_request.quote_responses.where(status: 'rejected').count,
            average_price: @quote_request.quote_responses.where(status: 'submitted').average(:price)&.round(2),
            lowest_price: @quote_request.quote_responses.where(status: 'submitted').minimum(:price),
            highest_price: @quote_request.quote_responses.where(status: 'submitted').maximum(:price)
          }
        )

        render json: { success: true, data: data }
      end

      # POST /api/v1/quote_requests
      # Create a new quote request
      def create
        quote_request = QuoteRequest.new(quote_request_params)
        quote_request.created_by = current_user

        if quote_request.save
          # Send to selected suppliers
          if params[:supplier_contact_ids].present?
            contact_ids = params[:supplier_contact_ids].is_a?(Array) ?
                         params[:supplier_contact_ids] :
                         params[:supplier_contact_ids].split(',').map(&:to_i)

            quote_request.send_to_suppliers!(contact_ids)

            # TODO: Enqueue QuoteRequestNotificationJob.perform_later(quote_request.id)
          end

          render json: {
            success: true,
            message: 'Quote request created successfully',
            data: quote_request_json(quote_request)
          }, status: :created
        else
          render json: {
            success: false,
            error: 'Failed to create quote request',
            errors: quote_request.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/quote_requests/:id
      # Update a quote request
      def update
        if @quote_request.closed?
          render json: { success: false, error: 'Cannot update closed quote requests' }, status: :unprocessable_entity
          return
        end

        if @quote_request.update(quote_request_params)
          # If adding new suppliers
          if params[:additional_supplier_contact_ids].present?
            contact_ids = params[:additional_supplier_contact_ids].is_a?(Array) ?
                         params[:additional_supplier_contact_ids] :
                         params[:additional_supplier_contact_ids].split(',').map(&:to_i)

            # Filter out already invited suppliers
            new_contact_ids = contact_ids - @quote_request.contacts.pluck(:id)
            @quote_request.send_to_suppliers!(new_contact_ids) if new_contact_ids.any?
          end

          render json: {
            success: true,
            message: 'Quote request updated successfully',
            data: quote_request_json(@quote_request)
          }
        else
          render json: {
            success: false,
            error: 'Failed to update quote request',
            errors: @quote_request.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/quote_requests/:id
      # Delete a quote request (only if no responses yet)
      def destroy
        if @quote_request.quote_responses.any?
          render json: { success: false, error: 'Cannot delete quote requests with responses' }, status: :unprocessable_entity
          return
        end

        if @quote_request.destroy
          render json: { success: true, message: 'Quote request deleted successfully' }
        else
          render json: { success: false, error: 'Failed to delete quote request' }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/quote_requests/:id/accept_quote
      # Accept a specific quote response
      def accept_quote
        quote_response_id = params[:quote_response_id]
        quote_response = @quote_request.quote_responses.find(quote_response_id)

        unless quote_response.submitted?
          render json: { success: false, error: 'Can only accept submitted quotes' }, status: :unprocessable_entity
          return
        end

        if @quote_request.accept_quote!(quote_response)
          render json: {
            success: true,
            message: 'Quote accepted successfully',
            data: {
              quote_request: quote_request_json(@quote_request),
              accepted_quote: quote_response_detail_json(quote_response),
              can_create_po: true
            }
          }
        else
          render json: {
            success: false,
            error: 'Failed to accept quote',
            errors: @quote_request.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/quote_requests/:id/close
      # Close a quote request without accepting any quotes
      def close
        if @quote_request.update(status: 'closed')
          # Reject all pending and submitted responses
          @quote_request.quote_responses.where(status: %w[pending submitted]).each(&:reject!)

          render json: {
            success: true,
            message: 'Quote request closed',
            data: quote_request_json(@quote_request)
          }
        else
          render json: {
            success: false,
            error: 'Failed to close quote request'
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/quote_requests/:id/convert_to_po
      # Convert accepted quote to purchase order
      def convert_to_po
        quote_request = QuoteRequest.find(params[:id])

        unless quote_request.selected_quote_response
          render json: { success: false, error: 'No quote has been accepted yet' }, status: :unprocessable_entity
          return
        end

        # Check if PO already exists
        existing_po = PurchaseOrder.find_by(quote_response: quote_request.selected_quote_response)
        if existing_po
          render json: { success: false, error: 'Purchase order already exists for this quote' }, status: :unprocessable_entity
          return
        end

        # Create purchase order from quote
        quote_response = quote_request.selected_quote_response
        purchase_order = PurchaseOrder.new(
          construction: quote_request.construction,
          contact: quote_response.contact,
          po_number: generate_po_number,
          total: quote_response.price,
          notes: "Created from quote request: #{quote_request.title}\n\nQuote notes: #{quote_response.notes}",
          status: 'pending',
          quote_response: quote_response
        )

        if purchase_order.save
          render json: {
            success: true,
            message: 'Purchase order created successfully',
            data: {
              purchase_order_id: purchase_order.id,
              po_number: purchase_order.po_number,
              total: purchase_order.total,
              contact_name: purchase_order.contact.display_name
            }
          }, status: :created
        else
          render json: {
            success: false,
            error: 'Failed to create purchase order',
            errors: purchase_order.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/quote_requests/stats
      # Get statistics for dashboard
      def stats
        data = {
          total_requests: QuoteRequest.count,
          pending_requests: QuoteRequest.where(status: 'pending_response').count,
          closed_requests: QuoteRequest.where(status: 'closed').count,
          total_responses: QuoteResponse.count,
          average_responses_per_request: (QuoteResponse.count.to_f / [QuoteRequest.count, 1].max).round(2),
          average_response_time_hours: calculate_average_response_time,
          recent_requests: QuoteRequest.order(created_at: :desc).limit(5).map { |qr| quote_request_json(qr) }
        }

        render json: { success: true, data: data }
      end

      private

      def set_quote_request
        @quote_request = QuoteRequest.find(params[:id])
      end

      def quote_request_params
        params.require(:quote_request).permit(
          :construction_id,
          :title,
          :description,
          :trade_category,
          :requested_date,
          :budget_min,
          :budget_max
        )
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
          response_count: quote_request.response_count,
          days_waiting: quote_request.days_waiting,
          created_at: quote_request.created_at,
          construction: {
            id: quote_request.construction.id,
            name: quote_request.construction.job_name,
            address: quote_request.construction.street_address
          },
          created_by: {
            id: quote_request.created_by.id,
            name: quote_request.created_by.name
          },
          invited_suppliers: quote_request.contacts.map do |contact|
            {
              id: contact.id,
              name: contact.display_name,
              company_name: contact.company_name,
              has_responded: quote_request.quote_responses.exists?(contact: contact)
            }
          end,
          selected_quote_id: quote_request.selected_quote_response_id,
          can_edit: !quote_request.closed?,
          can_delete: quote_request.quote_responses.empty?
        }
      end

      def quote_response_detail_json(response)
        {
          id: response.id,
          price: response.price,
          timeframe: response.timeframe,
          notes: response.notes,
          status: response.status,
          submitted_at: response.submitted_at,
          decision_at: response.decision_at,
          response_time_hours: response.response_time_hours,
          contact: {
            id: response.contact.id,
            name: response.contact.display_name,
            company_name: response.contact.company_name,
            kudos_score: response.contact.kudos_score
          },
          is_selected: response.id == @quote_request.selected_quote_response_id,
          can_accept: response.submitted?
        }
      end

      def generate_po_number
        # Simple PO number generation - can be customized
        last_po = PurchaseOrder.order(created_at: :desc).first
        if last_po && last_po.po_number =~ /PO-(\d+)/
          number = $1.to_i + 1
        else
          number = 1000
        end
        "PO-#{number}"
      end

      def calculate_average_response_time
        responses = QuoteResponse.where.not(submitted_at: nil)
        return 0 if responses.empty?

        total_hours = responses.sum do |response|
          response.response_time_hours || 0
        end

        (total_hours / responses.count).round(2)
      end
    end
  end
end
