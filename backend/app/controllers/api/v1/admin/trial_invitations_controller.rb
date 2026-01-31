# frozen_string_literal: true

module Api
  module V1
    module Admin
      class TrialInvitationsController < ApplicationController
        before_action :require_teeem_staff!

        # GET /api/v1/admin/trial_invitations
        # List all trial invitations (most recent first)
        def index
          invitations = TrialInvitation.includes(:invited_by, :sent_from, :tenant)
                                       .order(created_at: :desc)
                                       .limit(100)

          render json: {
            success: true,
            data: invitations.map { |i| invitation_json(i) }
          }
        end

        # GET /api/v1/admin/trial_invitations/available_senders
        # Returns list of TEEEM staff users who can be selected as "Send From"
        def available_senders
          # Get TEEEM staff users (those with teeem_staff role or admin access)
          users = User.joins(:roles)
                      .where(roles: { name: ['teeem_staff', 'admin'] })
                      .distinct
                      .order(:name)
                      .pluck(:id, :name, :email)

          render json: {
            success: true,
            data: users.map { |id, name, email| { id: id, name: name, email: email } }
          }
        end

        # POST /api/v1/admin/trial_invitations
        # Create and send a new trial invitation
        def create
          invitation = TrialInvitation.new(invitation_params)
          invitation.invited_by = current_user

          if invitation.save
            # Send invitation email
            UserMailer.trial_invitation_email(invitation).deliver_later

            render json: {
              success: true,
              message: "Invitation sent to #{invitation.email}",
              data: invitation_json(invitation)
            }
          else
            render json: {
              success: false,
              error: invitation.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/admin/trial_invitations/:id/resend
        # Resend an existing invitation and extend its expiration
        def resend
          invitation = TrialInvitation.find(params[:id])

          if invitation.status == 'pending'
            # Extend expiration
            invitation.extend_expiration!(days: 7)
            UserMailer.trial_invitation_email(invitation).deliver_later

            render json: {
              success: true,
              message: "Invitation resent to #{invitation.email}"
            }
          else
            render json: {
              success: false,
              error: "Cannot resend #{invitation.status} invitation"
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/admin/trial_invitations/:id
        # Cancel a pending invitation
        def destroy
          invitation = TrialInvitation.find(params[:id])
          invitation.cancel!

          render json: {
            success: true,
            message: "Invitation cancelled"
          }
        end

        private

        def require_teeem_staff!
          return if current_user&.teeem_staff?

          render json: {
            success: false,
            error: "Unauthorized. TEEEM staff access required."
          }, status: :forbidden
        end

        def invitation_params
          params.require(:invitation).permit(:email, :name, :company_name, :personal_message, :sent_from_user_id)
        end

        def invitation_json(invitation)
          {
            id: invitation.id,
            email: invitation.email,
            name: invitation.name,
            company_name: invitation.company_name,
            status: invitation.status,
            personal_message: invitation.personal_message,
            invited_by: invitation.invited_by&.name,
            sent_from_user_id: invitation.sent_from_user_id,
            sent_from_name: invitation.sent_from&.name,
            sent_from_email: invitation.sent_from&.email,
            # Effective sender (who email appears to come from)
            sender_name: invitation.sender_name,
            sender_email: invitation.sender_email,
            created_at: invitation.created_at.iso8601,
            expires_at: invitation.expires_at.iso8601,
            accepted_at: invitation.accepted_at&.iso8601,
            tenant_name: invitation.tenant&.name,
            signup_url: invitation.signup_url
          }
        end
      end
    end
  end
end
