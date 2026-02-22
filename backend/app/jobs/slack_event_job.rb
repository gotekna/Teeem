# frozen_string_literal: true

# SlackEventJob - Process Slack events asynchronously (Phase 3)
#
# Slack expects a response within 3 seconds for events.
# This job processes the event in the background.
#
class SlackEventJob < ApplicationJob
  queue_as :default

  def perform(event:)
    SlackIntegrationService.handle_event(event)
  rescue StandardError => e
    Rails.logger.error "[SlackEventJob] Error: #{e.message}"
  end
end
