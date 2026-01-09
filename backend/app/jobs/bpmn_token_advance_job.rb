class BpmnTokenAdvanceJob < ApplicationJob
  queue_as :default

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
