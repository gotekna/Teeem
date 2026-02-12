# frozen_string_literal: true

# ScreenShareChannel - WebRTC signaling relay via ActionCable
#
# Ephemeral relay for screen sharing signaling messages between users.
# No data is stored - all messages are transient WebRTC negotiation.
#
# Message types relayed:
# - session_request: User A wants to share with User B
# - session_accepted: User B accepted the request
# - session_declined: User B declined the request
# - sdp_offer: WebRTC SDP offer
# - sdp_answer: WebRTC SDP answer
# - ice_candidate: WebRTC ICE candidate
# - session_ended: Either user ended the session
#
# Security: Same-tenant enforced via acts_as_tenant on User model.
# The target user lookup uses User.find_by which is auto-scoped
# by acts_as_tenant, preventing cross-tenant signaling.
#
class ScreenShareChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
    Rails.logger.info "[ScreenShareChannel] User #{current_user.id} subscribed"
  end

  def unsubscribed
    Rails.logger.info "[ScreenShareChannel] User #{current_user.id} unsubscribed"
  end

  # Relay a signaling message to the target user
  # Called from frontend: subscription.perform("relay", { ... })
  def relay(data)
    target_user_id = data["targetUserId"]
    message_type = data["type"]
    session_id = data["sessionId"]
    payload = data["payload"]

    unless target_user_id.present? && message_type.present? && session_id.present?
      Rails.logger.warn "[ScreenShareChannel] Missing required fields from user #{current_user.id}"
      return
    end

    allowed_types = %w[
      session_request session_accepted session_declined
      sdp_offer sdp_answer ice_candidate session_ended
    ]

    unless allowed_types.include?(message_type)
      Rails.logger.warn "[ScreenShareChannel] Invalid message type '#{message_type}' from user #{current_user.id}"
      return
    end

    # acts_as_tenant auto-scopes this lookup to the current tenant
    # Cross-tenant users will not be found
    ActsAsTenant.with_tenant(current_user.tenant) do
      target_user = User.find_by(id: target_user_id)

      unless target_user
        Rails.logger.warn "[ScreenShareChannel] Target user #{target_user_id} not found (tenant-scoped) for user #{current_user.id}"
        return
      end

      ScreenShareChannel.broadcast_to(target_user, {
        type: message_type,
        fromUserId: current_user.id,
        fromUserName: current_user.name,
        sessionId: session_id,
        payload: payload
      })
    end
  end
end
