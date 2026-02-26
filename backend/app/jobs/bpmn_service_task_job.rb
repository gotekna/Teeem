class BpmnServiceTaskJob < ApplicationJob
  # FRC (Feb 2026): Critical queue so BPMN workflows aren't blocked behind
  # long-running Xero/attachment jobs on default queue (single-thread worker).
  queue_as :critical

  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(token_id)
    token = BpmnToken.find_by(id: token_id)

    unless token
      Rails.logger.warn("BpmnServiceTaskJob: Token ##{token_id} not found")
      return
    end

    unless token.waiting?
      Rails.logger.info("BpmnServiceTaskJob: Token ##{token_id} is not waiting (status: #{token.status})")
      return
    end

    Bpmn::ServiceTaskExecutor.execute(token)
  end
end
