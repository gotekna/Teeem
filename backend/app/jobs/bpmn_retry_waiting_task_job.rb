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

    # ⚠️ DO NOT CHANGE TOKEN STATUS - Leave as "waiting" (2026-02-26)
    # ════════════════════════════════════════════════════════════════
    # Why: BpmnTokenAdvanceJob (called by task_instance.complete!) checks
    #      token.waiting? and returns early if false. Setting token to "active"
    #      here breaks that guard, causing the advance job to skip the token.
    #      BpmnServiceTaskJob (initial execution) does NOT change status either.
    # ❌ WRONG: token.update!(status: "active")  → advance job skips
    # ✅ CORRECT: Leave as "waiting" → advance job finds it and advances
    # ════════════════════════════════════════════════════════════════

    # Re-execute the service task (token stays "waiting" throughout)
    Bpmn::ServiceTaskExecutor.execute(token)
  rescue Bpmn::Tasks::PermanentError => e
    # Non-transient error - don't retry (ServiceTaskExecutor already failed the process)
    Rails.logger.error "BpmnRetryWaitingTaskJob: Permanent failure for token #{token_id}: #{e.message}"
  rescue StandardError => e
    Rails.logger.error "BpmnRetryWaitingTaskJob: Error retrying token #{token_id}: #{e.message}"
    raise # Let the job retry mechanism handle it
  end
end
