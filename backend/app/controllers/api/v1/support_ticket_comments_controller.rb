# frozen_string_literal: true

module Api
  module V1
    # Controller for creating comments on support tickets
    # POST /api/v1/support_tickets/:support_ticket_id/comments
    class SupportTicketCommentsController < ApplicationController
      before_action :set_ticket

      # POST /api/v1/support_tickets/:support_ticket_id/comments
      def create
        @comment = @ticket.comments.build(
          body: params[:body],
          author: current_user
        )

        if @comment.save
          # Record first response for SLA if this is the first internal response
          if @ticket.sla_first_response_at.blank? && !@ticket.submitted_via_portal
            @ticket.record_first_response!
          end

          render json: {
            success: true,
            data: {
              id: @comment.id,
              body: @comment.body,
              created_at: @comment.created_at,
              author_name: @comment.author&.name
            }
          }, status: :created
        else
          render json: {
            success: false,
            error: @comment.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      private

      def set_ticket
        @ticket = SmTask.tickets.find(params[:support_ticket_id])
      end
    end
  end
end
