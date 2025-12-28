# frozen_string_literal: true

module Api
  module V1
    module Portal
      # Customer-facing ticket management for SaaS portal
      # Allows customers to view and submit support tickets
      class TicketsController < BaseController
        before_action :set_ticket, only: [:show, :add_comment]

        # GET /api/v1/portal/tickets
        def index
          tickets = customer_tickets
            .includes(:comments)
            .order(created_at: :desc)

          open_tickets = tickets.where.not(status: "completed")
          resolved_tickets = tickets.where(status: "completed")

          render json: {
            success: true,
            data: {
              tickets: tickets.map { |t| ticket_json(t) },
              summary: {
                total_tickets: tickets.count,
                open_tickets: open_tickets.count,
                resolved_tickets: resolved_tickets.count
              }
            }
          }
        end

        # GET /api/v1/portal/tickets/:id
        def show
          render json: {
            success: true,
            data: ticket_json(@ticket, full: true)
          }
        end

        # POST /api/v1/portal/tickets
        def create
          ticket = SmTask.new(ticket_params)
          ticket.saas_customer_id = current_contact.id
          ticket.is_ticket = true
          ticket.customer_visible = true
          ticket.submitted_via_portal = true
          ticket.status = "not_started"
          ticket.set_sla_deadlines!

          if ticket.save
            render json: {
              success: true,
              data: ticket_json(ticket)
            }, status: :created
          else
            render json: {
              success: false,
              error: ticket.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/portal/tickets/:id/add_comment
        def add_comment
          comment = @ticket.comments.build(
            body: params[:comment],
            author: nil  # Portal comments don't have an author (internal user)
          )

          if comment.save
            render json: {
              success: true,
              data: comment_json(comment, from_portal: true)
            }, status: :created
          else
            render json: {
              success: false,
              error: comment.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        private

        def set_ticket
          @ticket = customer_tickets.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Ticket not found" }, status: :not_found
        end

        def customer_tickets
          SmTask.tickets.where(saas_customer_id: current_contact.id)
            .where(customer_visible: true)
        end

        def ticket_params
          params.require(:ticket).permit(
            :name,
            :description,
            :ticket_priority,
            :ticket_category
          )
        end

        def ticket_json(ticket, full: false)
          data = {
            id: ticket.id,
            task_number: ticket.task_number,
            name: ticket.name,
            description: ticket.description,
            status: ticket.status,
            ticket_priority: ticket.ticket_priority,
            ticket_category: ticket.ticket_category,
            sla_status: ticket.sla_status,
            created_at: ticket.created_at,
            updated_at: ticket.updated_at,
            comments_count: ticket.comments.not_deleted.count
          }

          if full
            data[:comments] = ticket.comments
              .not_deleted
              .oldest_first
              .map { |c| comment_json(c) }
            data[:sla_response_due_at] = ticket.sla_response_due_at
            data[:sla_resolution_due_at] = ticket.sla_resolution_due_at
            data[:sla_first_response_at] = ticket.sla_first_response_at
          end

          data
        end

        def comment_json(comment, from_portal: false)
          {
            id: comment.id,
            comment: comment.body,
            created_at: comment.created_at,
            from_customer: comment.author.nil?,  # Portal comments have no author
            author_name: comment.author.nil? ? "You" : (comment.author&.display_name || "Support Team")
          }
        end
      end
    end
  end
end
