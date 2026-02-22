# frozen_string_literal: true

# Slack webhook controller for TEEEM AI Assistant (Phase 3)
#
# Handles:
#   - Slack Events API (app_mention, message)
#   - Slack Slash Commands (/teeem)
#   - Slack URL verification challenge
#
module Api
  module V1
    module Assistant
      class SlackController < ApplicationController
        skip_before_action :authorize_request

        # POST /api/v1/assistant/slack/events
        # Slack Events API webhook
        def events
          # Handle Slack URL verification challenge
          if params[:type] == "url_verification"
            return render json: { challenge: params[:challenge] }
          end

          # Verify request signature
          unless SlackIntegrationService.valid_signature?(request)
            Rails.logger.warn "[SlackController] Invalid signature"
            return head :forbidden
          end

          event = params[:event]
          return head :ok unless event

          # Process event asynchronously
          SlackEventJob.perform_later(event: event.to_unsafe_h)

          head :ok
        end

        # POST /api/v1/assistant/slack/command
        # Slack /teeem slash command
        def command
          unless SlackIntegrationService.valid_signature?(request)
            return head :forbidden
          end

          result = SlackIntegrationService.handle_slash_command(params)

          render json: result
        end

        # POST /api/v1/assistant/slack/interactions
        # Slack interactive components (buttons, menus)
        def interactions
          unless SlackIntegrationService.valid_signature?(request)
            return head :forbidden
          end

          payload = JSON.parse(params[:payload])
          Rails.logger.info "[SlackController] Interaction: #{payload['type']}"

          # Handle button clicks for action approvals
          case payload["type"]
          when "block_actions"
            handle_block_action(payload)
          end

          head :ok
        end

        private

        def handle_block_action(payload)
          action = payload["actions"]&.first
          return unless action

          case action["action_id"]
          when /^approve_action_(\d+)$/
            action_id = Regexp.last_match(1)
            # Route to approve via the assistant service
            Rails.logger.info "[SlackController] Approve action ##{action_id}"
          when /^reject_action_(\d+)$/
            action_id = Regexp.last_match(1)
            Rails.logger.info "[SlackController] Reject action ##{action_id}"
          end
        end
      end
    end
  end
end
