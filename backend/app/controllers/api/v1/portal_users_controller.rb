# frozen_string_literal: true

module Api
  module V1
    class PortalUsersController < ApplicationController
      # GET /api/v1/portal/users
      # Admin endpoint to list all portal users with stats
      def index
        portal_users = PortalUser.includes(:contact, :subcontractor_account, :quote_responses)
                                 .order(created_at: :desc)

        # Apply filters
        if params[:status].present?
          case params[:status]
          when "active"
            portal_users = portal_users.active
          when "inactive"
            portal_users = portal_users.inactive
          when "locked"
            portal_users = portal_users.locked
          end
        end

        if params[:portal_type].present?
          portal_users = portal_users.where(portal_type: params[:portal_type])
        end

        render json: {
          success: true,
          users: portal_users.map { |user| portal_user_to_json(user) }
        }
      end

      # GET /api/v1/portal/users/:id
      def show
        portal_user = PortalUser.includes(:contact, :subcontractor_account).find(params[:id])

        render json: {
          success: true,
          user: portal_user_to_json(portal_user)
        }
      end

      private

      def portal_user_to_json(user)
        contact = user.contact
        subcontractor = user.subcontractor_account

        # Get stats
        quote_count = user.quote_responses.count
        jobs_count = contact&.purchase_orders&.count || 0
        kudos_score = subcontractor&.kudos_total || 0
        kudos_rank = calculate_kudos_rank(kudos_score)

        {
          id: user.id,
          contact_id: user.contact_id,
          contact_name: contact&.display_name || user.email,
          company_name: contact&.company&.name || contact&.company_name || "",
          email: user.email,
          status: determine_status(user),
          last_login: user.last_login_at,
          created_at: user.created_at,
          jobs_assigned: jobs_count,
          quotes_submitted: quote_count,
          kudos_score: kudos_score,
          kudos_rank: kudos_rank,
          portal_type: user.portal_type,
          active: user.active,
          locked: user.locked?
        }
      end

      def determine_status(user)
        return "suspended" if !user.active || user.locked?
        return "pending" if user.last_login_at.nil?
        "active"
      end

      def calculate_kudos_rank(score)
        return nil if score.zero?

        # Get rank among all subcontractors
        higher_count = SubcontractorAccount.where("kudos_total > ?", score).count
        higher_count + 1
      end
    end
  end
end
