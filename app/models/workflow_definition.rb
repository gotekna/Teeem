class WorkflowDefinition < ApplicationRecord
  # Associations
  has_many :workflow_instances, dependent: :destroy

  # Validations
  validates :name, presence: true
  validates :workflow_type, presence: true
  validates :config, presence: true

  # Scopes
  scope :active, -> { where(active: true) }

  # Workflow types
  TYPES = %w[
    purchase_order_approval
    job_approval
    estimate_review
    quote_approval
    contract_approval
    document_approval
    change_order_approval
    invoice_approval
  ].freeze

  # Status constants
  STATUSES = %w[pending in_progress approved rejected completed cancelled].freeze

  # Config structure example:
  # {
  #   steps: [
  #     {
  #       name: "supervisor_review",
  #       label: "Supervisor Review",
  #       assignee_type: "role", # or "user"
  #       assignee_value: "supervisor",
  #       actions: ["approve", "reject", "request_changes"],
  #       required: true
  #     },
  #     {
  #       name: "admin_approval",
  #       label: "Admin Approval",
  #       assignee_type: "role",
  #       assignee_value: "admin",
  #       actions: ["approve", "reject"],
  #       required: true
  #     }
  #   ],
  #   notifications: {
  #     on_start: true,
  #     on_step_complete: true,
  #     on_completion: true
  #   }
  # }

  def steps
    config["steps"] || []
  end

  def step_at(index)
    steps[index]
  end

  def step_by_name(name)
    steps.find { |step| step["name"] == name }
  end
end
