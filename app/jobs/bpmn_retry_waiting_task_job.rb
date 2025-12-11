# Job to retry a waiting BPMN task (e.g., waiting for e-signatures)
#
class BpmnRetryWaitingTaskJob < ApplicationJob
  queue_as :default

  def perform(token_id)
    token = BpmnToken.find_by(id: token_id)

    unless token
      Rails.logger.warn "BpmnRetryWaitingTaskJob: Token #{token_id} not found, skipping"
      return
    end

    unless token.status == "waiting"
      Rails.logger.info "BpmnRetryWaitingTaskJob: Token #{token_id} no longer waiting (status: #{token.status}), skipping"
      return
    end

    Rails.logger.info "BpmnRetryWaitingTaskJob: Retrying waiting task for token #{token_id}"

    # Reset token status to active so it can be re-executed
    token.update!(status: "active")

    # Re-execute the service task
    Bpmn::ServiceTaskExecutor.execute(token)
  rescue StandardError => e
    Rails.logger.error "BpmnRetryWaitingTaskJob: Error retrying token #{token_id}: #{e.message}"
    raise # Let the job retry mechanism handle it
  end
end
