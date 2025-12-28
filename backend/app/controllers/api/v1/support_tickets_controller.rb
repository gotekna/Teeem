# frozen_string_literal: true

module Api
  module V1
    # Support Tickets Controller
    # Manages support tickets (SmTask with is_ticket=true)
    #
    # Tickets are SmTasks with ticket-specific fields:
    # - is_ticket: true
    # - ticket_priority: urgent, high, medium, low
    # - ticket_category: bug, feature_request, question, onboarding, billing, other
    # - SLA tracking fields
    # - customer_visible: whether customer can see in portal
    #
    # Endpoints:
    # - GET    /api/v1/support_tickets          - List all tickets
    # - GET    /api/v1/support_tickets/:id      - Show ticket details
    # - POST   /api/v1/support_tickets          - Create new ticket
    # - PATCH  /api/v1/support_tickets/:id      - Update ticket
    # - DELETE /api/v1/support_tickets/:id      - Delete ticket
    # - POST   /api/v1/support_tickets/:id/respond - Record first response
    # - GET    /api/v1/support_tickets/dashboard - Get ticket dashboard metrics
    #
    class SupportTicketsController < ApplicationController
      before_action :set_ticket, only: [:show, :update, :destroy, :respond]

      # GET /api/v1/support_tickets
      def index
        tickets = SmTask.tickets
          .includes(:saas_customer, :assigned_user, :job)
          .order(created_at: :desc)

        # Filters
        tickets = tickets.where(saas_customer_id: params[:customer_id]) if params[:customer_id].present?
        tickets = tickets.where(ticket_priority: params[:priority]) if params[:priority].present?
        tickets = tickets.where(ticket_category: params[:category]) if params[:category].present?
        tickets = tickets.where(status: params[:status]) if params[:status].present?
        tickets = tickets.where(assigned_user_id: params[:assigned_to]) if params[:assigned_to].present?

        # SLA filters
        case params[:sla_status]
        when "breached"
          tickets = tickets.sla_breached
        when "at_risk"
          tickets = tickets.sla_at_risk
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i
        total = tickets.count
        tickets = tickets.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          data: tickets.map { |t| ticket_json(t) },
          meta: {
            total: total,
            page: page,
            per_page: per_page,
            total_pages: (total.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/support_tickets/:id
      def show
        render json: {
          success: true,
          data: ticket_json(@ticket, full: true)
        }
      end

      # POST /api/v1/support_tickets
      def create
        @ticket = SmTask.new(ticket_params)
        @ticket.is_ticket = true
        @ticket.submitted_via_portal = params[:submitted_via_portal] || false

        # Set defaults
        @ticket.status ||= "not_started"
        @ticket.start_date ||= Date.current
        @ticket.end_date ||= Date.current + 7.days
        @ticket.duration_days ||= 1
        @ticket.sequence_order ||= 1
        @ticket.task_number ||= SmTask.maximum(:task_number).to_i + 1

        if @ticket.save
          # Set SLA deadlines based on priority
          @ticket.set_sla_deadlines! if @ticket.ticket_priority.present?

          render json: { success: true, data: ticket_json(@ticket, full: true) }, status: :created
        else
          render json: { success: false, error: @ticket.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/support_tickets/:id
      def update
        old_priority = @ticket.ticket_priority

        if @ticket.update(ticket_params)
          # Recalculate SLA if priority changed
          if @ticket.ticket_priority != old_priority && @ticket.ticket_priority.present?
            @ticket.set_sla_deadlines!
          end

          render json: { success: true, data: ticket_json(@ticket, full: true) }
        else
          render json: { success: false, error: @ticket.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/support_tickets/:id
      def destroy
        @ticket.destroy
        render json: { success: true, message: "Ticket deleted" }
      end

      # POST /api/v1/support_tickets/:id/respond
      # Records first response time for SLA tracking
      def respond
        @ticket.record_first_response!
        render json: {
          success: true,
          data: ticket_json(@ticket, full: true),
          message: "First response recorded"
        }
      end

      # GET /api/v1/support_tickets/dashboard
      def dashboard
        tickets = SmTask.tickets

        render json: {
          success: true,
          data: {
            total_open: tickets.active.count,
            total_today: tickets.where("created_at >= ?", Date.current.beginning_of_day).count,
            by_priority: {
              urgent: tickets.active.by_ticket_priority("urgent").count,
              high: tickets.active.by_ticket_priority("high").count,
              medium: tickets.active.by_ticket_priority("medium").count,
              low: tickets.active.by_ticket_priority("low").count
            },
            by_category: tickets.active.group(:ticket_category).count,
            by_status: tickets.group(:status).count,
            sla_breached: tickets.sla_breached.count,
            sla_at_risk: tickets.sla_at_risk.count,
            avg_resolution_time: calculate_avg_resolution_time,
            recent_tickets: tickets.order(created_at: :desc).limit(5).map { |t| ticket_json(t) }
          }
        }
      end

      # GET /api/v1/support_tickets/for_customer/:customer_id
      # Customer portal endpoint - returns only customer-visible tickets
      def for_customer
        customer = Contact.find(params[:customer_id])
        tickets = customer.support_tickets
          .customer_visible
          .order(created_at: :desc)

        render json: {
          success: true,
          data: tickets.map { |t| portal_ticket_json(t) }
        }
      end

      private

      def set_ticket
        @ticket = SmTask.tickets.find(params[:id])
      end

      def ticket_params
        params.permit(
          :name, :description,
          :saas_customer_id, :job_id, :assigned_user_id,
          :ticket_priority, :ticket_category,
          :customer_visible, :status,
          :start_date, :end_date, :duration_days
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
          customer_visible: ticket.customer_visible,
          submitted_via_portal: ticket.submitted_via_portal,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          customer: ticket.saas_customer ? {
            id: ticket.saas_customer.id,
            name: ticket.saas_customer.display_name
          } : nil,
          assigned_to: ticket.assigned_user ? {
            id: ticket.assigned_user.id,
            name: ticket.assigned_user.display_name
          } : nil,
          sla_status: ticket.sla_status
        }

        if full
          data[:ticket_summary] = ticket.ticket_summary
          data[:job] = ticket.job ? { id: ticket.job.id, name: ticket.job.name } : nil
          data[:comments_count] = ticket.comments.count
          data[:time_entries_count] = ticket.time_entries.count
          data[:attachments_count] = ticket.sm_task_attachments.count
        end

        data
      end

      def portal_ticket_json(ticket)
        {
          id: ticket.id,
          task_number: ticket.task_number,
          name: ticket.name,
          description: ticket.description,
          status: ticket.status,
          ticket_priority: ticket.ticket_priority,
          ticket_category: ticket.ticket_category,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          sla_status: ticket.sla_status,
          comments: ticket.comments.where(customer_visible: true).map do |c|
            {
              id: c.id,
              content: c.content,
              created_at: c.created_at,
              author: c.user&.display_name
            }
          end
        }
      end

      def calculate_avg_resolution_time
        completed = SmTask.tickets.completed
          .where.not(completed_at: nil)
          .where("created_at >= ?", 30.days.ago)

        return nil if completed.empty?

        total_hours = completed.sum do |t|
          ((t.completed_at - t.created_at) / 1.hour).round(1)
        end

        (total_hours / completed.count).round(1)
      end
    end
  end
end
