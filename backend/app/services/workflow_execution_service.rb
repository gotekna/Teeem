class WorkflowExecutionService
  class << self
    # Start a workflow for a given subject (e.g., PurchaseOrder, Job, etc.)
    # Options:
    #   Client Information:
    #   - client_name: Name of client/recipient
    #   - client_address: Address of client/recipient
    #   - client_email: Email of client/recipient
    #   - client_phone: Phone of client/recipient
    #
    #   Financial Information:
    #   - amount: Total value/amount
    #   - currency: Currency code (default: AUD)
    #   - payment_terms: Payment terms description
    #
    #   Project Details:
    #   - project_name: Name of project
    #   - project_reference: Job/project reference number
    #   - site_address: Job site address
    #   - due_date: Date approval is needed by
    #   - priority: Priority level (urgent, normal, low)
    #
    #   Scope Information:
    #   - scope_summary: Brief description of work
    #   - special_requirements: Special requirements or conditions
    #
    #   References:
    #   - external_reference: External PO/reference numbers
    #   - onedrive_folder_url: Link to OneDrive folder
    #
    #   Attachments:
    #   - attachments: Array of attachment hashes [{url:, filename:, content_type:}]
    def start_workflow(workflow_type:, subject:, initiated_by: nil, **options)
      workflow_definition = WorkflowDefinition.active.find_by(workflow_type: workflow_type)

      raise "No active workflow found for type: #{workflow_type}" unless workflow_definition

      # Build metadata
      metadata = {
        initiated_by_id: initiated_by&.id,
        initiated_at: Time.current
      }

      # Add all optional fields if present
      optional_fields = [
        :client_name, :client_address, :client_email, :client_phone,
        :amount, :currency, :payment_terms,
        :project_name, :project_reference, :site_address, :due_date, :priority,
        :scope_summary, :special_requirements,
        :external_reference, :onedrive_folder_url,
        :attachments
      ]

      optional_fields.each do |field|
        metadata[field] = options[field] if options[field].present?
      end

      # Create workflow instance
      instance = WorkflowInstance.create!(
        workflow_definition: workflow_definition,
        subject: subject,
        status: "pending",
        started_at: Time.current,
        metadata: metadata
      )

      # Workflow instance after_create callback will initialize first step
      instance
    end

    # Get all pending workflows for a user
    def pending_for_user(user)
      WorkflowStep.includes(:workflow_instance)
                   .where(status: [ "pending", "in_progress" ])
                   .select { |step| step.can_action?(user) }
    end

    # Get workflow status for a subject
    def workflow_for_subject(subject)
      WorkflowInstance.find_by(
        subject: subject,
        status: [ "pending", "in_progress" ]
      )
    end

    # Check if subject has active workflow
    def has_active_workflow?(subject)
      WorkflowInstance.active.exists?(subject: subject)
    end
  end
end
