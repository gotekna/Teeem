class BpmnTokenAdvanceJob < ApplicationJob
  # FRC (Feb 2026): Critical queue so BPMN workflows aren't blocked behind
  # long-running Xero/attachment jobs on default queue (single-thread worker).
  queue_as :critical

  # FRC (Feb 2026): Prevent duplicate advancement for the same token.
  # Two advance jobs for the same token could double-advance through nodes.
  limits_concurrency to: 1, key: ->(token_id) { "bpmn_token_advance_#{token_id}" }

  def perform(token_id)
    token = BpmnToken.find_by(id: token_id)

    unless token
      Rails.logger.warn("BpmnTokenAdvanceJob: Token ##{token_id} not found")
      return
    end

    unless token.waiting?
      Rails.logger.info("BpmnTokenAdvanceJob: Token ##{token_id} is not waiting (status: #{token.status})")
      return
    end

    # Reactivate and advance
    token.update!(status: "active")
    Bpmn::EngineService.advance_token(token)
  end
end
