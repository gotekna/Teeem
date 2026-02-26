class BpmnTimerJob < ApplicationJob
  # FRC (Feb 2026): Critical queue so BPMN workflows aren't blocked behind
  # long-running Xero/attachment jobs on default queue (single-thread worker).
  queue_as :critical

  def perform(token_id)
    token = BpmnToken.find_by(id: token_id)

    unless token
      Rails.logger.warn("BpmnTimerJob: Token ##{token_id} not found")
      return
    end

    unless token.waiting?
      Rails.logger.info("BpmnTimerJob: Token ##{token_id} is not waiting (status: #{token.status})")
      return
    end

    Rails.logger.info("BpmnTimerJob: Timer fired for token ##{token_id}")

    # Reactivate and advance
    token.update!(status: "active")
    Bpmn::EngineService.advance_token(token)
  end
end
