class WorkflowInstance < ApplicationRecord
  # Associations
  belongs_to :workflow_definition
  belongs_to :subject, polymorphic: true
  has_many :workflow_steps, dependent: :destroy

  # Validations
  validates :status, presence: true, inclusion: { in: WorkflowDefinition::STATUSES }

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :in_progress, -> { where(status: "in_progress") }
  scope :completed, -> { where(status: "completed") }
  scope :active, -> { where(status: [ "pending", "in_progress" ]) }

  # Callbacks
  after_create :initialize_first_step

  # Client/recipient information accessors
  def client_name
    metadata&.dig("client_name")
  end

  def client_name=(value)
    self.metadata = (metadata || {}).merge("client_name" => value)
  end

  def client_address
    metadata&.dig("client_address")
  end

  def client_address=(value)
    self.metadata = (metadata || {}).merge("client_address" => value)
  end

  def client_email
    metadata&.dig("client_email")
  end

  def client_email=(value)
    self.metadata = (metadata || {}).merge("client_email" => value)
  end

  def client_phone
    metadata&.dig("client_phone")
  end

  def client_phone=(value)
    self.metadata = (metadata || {}).merge("client_phone" => value)
  end

  # Document attachments (stored as array of URLs/paths in metadata)
  def attachments
    metadata&.dig("attachments") || []
  end

  def add_attachment(url:, filename:, content_type: nil)
    attachment = {
      url: url,
      filename: filename,
      content_type: content_type,
      uploaded_at: Time.current.iso8601
    }
    current_attachments = attachments
    self.metadata = (metadata || {}).merge("attachments" => current_attachments + [ attachment ])
    save
  end

  def remove_attachment(url)
    current_attachments = attachments.reject { |a| a["url"] == url }
    self.metadata = (metadata || {}).merge("attachments" => current_attachments)
    save
  end

  # Financial information accessors
  def amount
    metadata&.dig("amount")
  end

  def amount=(value)
    self.metadata = (metadata || {}).merge("amount" => value)
  end

  def currency
    metadata&.dig("currency") || "AUD"
  end

  def currency=(value)
    self.metadata = (metadata || {}).merge("currency" => value)
  end

  def payment_terms
    metadata&.dig("payment_terms")
  end

  def payment_terms=(value)
    self.metadata = (metadata || {}).merge("payment_terms" => value)
  end

  # Project details accessors
  def project_name
    metadata&.dig("project_name")
  end

  def project_name=(value)
    self.metadata = (metadata || {}).merge("project_name" => value)
  end

  def project_reference
    metadata&.dig("project_reference")
  end

  def project_reference=(value)
    self.metadata = (metadata || {}).merge("project_reference" => value)
  end

  def site_address
    metadata&.dig("site_address")
  end

  def site_address=(value)
    self.metadata = (metadata || {}).merge("site_address" => value)
  end

  def due_date
    metadata&.dig("due_date")
  end

  def due_date=(value)
    self.metadata = (metadata || {}).merge("due_date" => value)
  end

  def priority
    metadata&.dig("priority") || "normal"
  end

  def priority=(value)
    self.metadata = (metadata || {}).merge("priority" => value)
  end

  # Scope information accessors
  def scope_summary
    metadata&.dig("scope_summary")
  end

  def scope_summary=(value)
    self.metadata = (metadata || {}).merge("scope_summary" => value)
  end

  def special_requirements
    metadata&.dig("special_requirements")
  end

  def special_requirements=(value)
    self.metadata = (metadata || {}).merge("special_requirements" => value)
  end

  # Reference information accessors
  def external_reference
    metadata&.dig("external_reference")
  end

  def external_reference=(value)
    self.metadata = (metadata || {}).merge("external_reference" => value)
  end

  def onedrive_folder_url
    metadata&.dig("onedrive_folder_url")
  end

  def onedrive_folder_url=(value)
    self.metadata = (metadata || {}).merge("onedrive_folder_url" => value)
  end

  def current_step_record
    workflow_steps.find_by(step_name: current_step)
  end

  def all_steps_config
    workflow_definition.steps
  end

  def current_step_config
    workflow_definition.step_by_name(current_step)
  end

  def next_step_config
    steps = all_steps_config
    current_index = steps.index { |s| s["name"] == current_step }
    return nil if current_index.nil? || current_index >= steps.length - 1

    steps[current_index + 1]
  end

  def can_advance?
    current_step_record&.status == "completed" && next_step_config.present?
  end

  def advance!
    return false unless can_advance?

    next_step = next_step_config
    update!(current_step: next_step["name"])
    create_step(next_step)
    true
  end

  def complete!
    return false unless current_step_record&.status == "completed" && !next_step_config

    update!(status: "completed", completed_at: Time.current)
    true
  end

  def reject!(reason: nil)
    update!(
      status: "rejected",
      completed_at: Time.current,
      metadata: (metadata || {}).merge(rejection_reason: reason)
    )
  end

  def cancel!(reason: nil)
    update!(
      status: "cancelled",
      completed_at: Time.current,
      metadata: (metadata || {}).merge(cancellation_reason: reason)
    )
  end

  private

  def initialize_first_step
    return if current_step.present?

    first_step = workflow_definition.steps.first
    return unless first_step

    update!(
      status: "in_progress",
      current_step: first_step["name"],
      started_at: Time.current
    )
    create_step(first_step)
  end

  def create_step(step_config)
    workflow_steps.create!(
      step_name: step_config["name"],
      status: "pending",
      data: step_config,
      started_at: Time.current
    )
  end
end
