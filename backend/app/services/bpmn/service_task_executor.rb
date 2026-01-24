module Bpmn
  class ServiceTaskExecutor
    # SSoT: Task type → handler class mapping
    # Jan 2026: "sync_to_sharepoint" now maps to SyncToStorageTask (provider-agnostic)
    TASK_HANDLERS = {
      "send_email" => "Bpmn::Tasks::SendEmailTask",
      "generate_document" => "Bpmn::Tasks::GenerateDocumentTask",
      "update_record" => "Bpmn::Tasks::UpdateRecordTask",
      "create_xero_invoice" => "Bpmn::Tasks::CreateXeroInvoiceTask",
      "sync_to_storage" => "Bpmn::Tasks::SyncToStorageTask",
      "sync_to_sharepoint" => "Bpmn::Tasks::SyncToStorageTask", # Legacy alias for backwards compatibility
      "send_notification" => "Bpmn::Tasks::SendNotificationTask",
      "call_webhook" => "Bpmn::Tasks::CallWebhookTask",
      "set_variable" => "Bpmn::Tasks::SetVariableTask",
      "create_esign_request" => "Bpmn::Tasks::CreateESignRequestTask",
      "wait_for_signatures" => "Bpmn::Tasks::WaitForSignaturesTask",
      "generate_and_send_for_signing" => "Bpmn::Tasks::GenerateAndSendForSigningTask",
      "attach_sharepoint_file" => "Bpmn::Tasks::AttachSharepointFileTask"
    }.freeze

    def self.execute(token)
      new(token).execute
    end

    def initialize(token)
      @token = token
      @node = token.current_node
      @instance = token.bpmn_process_instance
      @config = @node.config || {}
    end

    def execute
      task_type = @config["task_type"]

      Rails.logger.info("BPMN: Executing service task '#{@node.display_name}' (type: #{task_type})")

      handler_class = TASK_HANDLERS[task_type]
      raise TaskError, "Unknown service task type: #{task_type}" unless handler_class

      task_instance = create_task_instance

      begin
        handler = handler_class.constantize.new(@token, @config)
        result = handler.execute

        task_instance.complete!(result)
        Rails.logger.info("BPMN: Service task '#{@node.display_name}' completed successfully")
      rescue Bpmn::Tasks::WaitForSignaturesTask::WaitingError => e
        # Special handling for wait tasks - pause the token and schedule retry
        task_instance.update!(status: "waiting", result: { message: e.message })
        @token.update!(status: "waiting")

        retry_interval = @config["retry_interval_minutes"] || 60
        Rails.logger.info("BPMN: Task '#{@node.display_name}' waiting, will retry in #{retry_interval} minutes")

        # Schedule a retry job (SolidQueue)
        BpmnRetryWaitingTaskJob.set(wait: retry_interval.minutes).perform_later(@token.id)
      rescue StandardError => e
        task_instance.fail!(e.message)
        Rails.logger.error("BPMN: Service task '#{@node.display_name}' failed: #{e.message}")

        max_retries = @config["max_retries"] || 3
        if task_instance.retry_count < max_retries
          Rails.logger.info("BPMN: Will retry (attempt #{task_instance.retry_count + 1}/#{max_retries})")
          raise # Re-raise to trigger job retry
        else
          Rails.logger.error("BPMN: Max retries exceeded, marking task as failed")
          @instance.fail!("Service task '#{@node.display_name}' failed after #{max_retries} attempts: #{e.message}")
        end
      end
    end

    private

    def create_task_instance
      BpmnTaskInstance.create!(
        bpmn_token: @token,
        bpmn_node: @node,
        task_type: "service_task",
        status: "in_progress",
        started_at: Time.current
      )
    end

    class TaskError < StandardError; end
  end
end
