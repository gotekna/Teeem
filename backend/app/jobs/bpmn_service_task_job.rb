class BpmnServiceTaskJob < ApplicationJob
  # FRC (Feb 2026): Critical queue so BPMN workflows aren't blocked behind
  # long-running Xero/attachment jobs on default queue (single-thread worker).
  queue_as :critical

  # FRC (Feb 2026): Prevent duplicate execution for the same token.
  # Without this, two enqueued jobs for the same token both see token.waiting?
  # and both call ServiceTaskExecutor.execute → duplicate side effects
  # (e.g., two e-signature requests created 2 seconds apart).
  limits_concurrency to: 1, key: ->(token_id) { "bpmn_service_task_#{token_id}" }

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
