# frozen_string_literal: true

module Api
  module V1
    # CalendarController - API for calendar views
    #
    # Provides endpoints for:
    # - events: Task events for calendar display
    # - capacity: Resource capacity/utilization data
    # - summary: Quick stats (overdue, today, this week)
    #
    class CalendarController < ApplicationController
      # GET /api/v1/calendar/events
      # Returns tasks formatted as calendar events
      #
      # Params:
      #   start_date: Range start (required)
      #   end_date: Range end (required)
      #   user_ids[]: Filter by assigned users
      #   role_ids[]: Filter by assigned roles
      #   job_id: Filter by job
      #   statuses[]: Filter by status
      #   include_unassigned: Include unassigned tasks (default: true)
      #   view_mode: 'personal', 'team', 'resource'
      #
      def events
        service = CalendarService.new(current_organization)
        result = service.events(
          start_date: parse_date(params[:start_date]),
          end_date: parse_date(params[:end_date]),
          user_ids: params[:user_ids],
          role_ids: params[:role_ids],
          job_id: params[:job_id],
          statuses: params[:statuses],
          include_unassigned: params.fetch(:include_unassigned, true),
          view_mode: params[:view_mode] || "personal"
        )

        render json: { success: true, **result }
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :bad_request
      end

      # GET /api/v1/calendar/capacity
      # Returns resource capacity data for team/resource views
      #
      # Params:
      #   start_date: Range start (required)
      #   end_date: Range end (required)
      #   user_ids[]: Users to include
      #
      def capacity
        service = CalendarService.new(current_organization)
        result = service.capacity(
          start_date: parse_date(params[:start_date]),
          end_date: parse_date(params[:end_date]),
          user_ids: params[:user_ids]
        )

        render json: { success: true, **result }
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :bad_request
      end

      # GET /api/v1/calendar/summary
      # Returns quick stats for dashboard widgets
      #
      # Params:
      #   user_id: Filter by user (for personal view)
      #
      def summary
        service = CalendarService.new(current_organization)
        result = service.summary(user_id: params[:user_id])

        render json: { success: true, summary: result }
      end

      private

      def parse_date(date_string)
        return nil if date_string.blank?
        Date.parse(date_string)
      rescue Date::Error
        raise ArgumentError, "Invalid date format: #{date_string}"
      end
    end
  end
end
