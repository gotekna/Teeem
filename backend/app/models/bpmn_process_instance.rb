class BpmnProcessInstance < ApplicationRecord
  # Associations
  belongs_to :bpmn_process
  belongs_to :workflow_instance, optional: true
  belongs_to :subject, polymorphic: true
  has_many :bpmn_tokens, dependent: :destroy

  # Constants
  STATUSES = %w[active completed cancelled error suspended].freeze

  # Validations
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "error") }
  scope :for_subject, ->(subject) { where(subject: subject) }

  # Callbacks
  after_create :log_instance_started

  # Instance methods
  def active?
    status == "active"
  end

  def completed?
    status == "completed"
  end

  def cancelled?
    status == "cancelled"
  end

  def error?
    status == "error"
  end

  def suspended?
    status == "suspended"
  end

  def complete!
    update!(status: "completed", completed_at: Time.current)
    log_instance_completed
  end

  def cancel!(reason = nil)
    update!(status: "cancelled", completed_at: Time.current, error_message: reason)
    bpmn_tokens.where(status: "active").update_all(status: "completed", completed_at: Time.current)
    log_instance_cancelled(reason)
  end

  def fail!(error_msg)
    update!(status: "error", error_message: error_msg)
    log_instance_failed(error_msg)
  end

  def suspend!
    update!(status: "suspended")
  end

  def resume!
    return unless suspended?

    update!(status: "active")
    # Re-process any waiting tokens
    bpmn_tokens.where(status: "waiting").find_each do |token|
      Bpmn::EngineService.advance_token(token)
    end
  end

  # Variable management
  def get_variable(key)
    variables&.dig(key.to_s)
  end

  def set_variable(key, value)
    self.variables = (variables || {}).merge(key.to_s => value)
    save!
  end

  def set_variables(hash)
    self.variables = (variables || {}).merge(hash.stringify_keys)
    save!
  end

  # Token helpers
  def active_tokens
    bpmn_tokens.where(status: "active")
  end

  def waiting_tokens
    bpmn_tokens.where(status: "waiting")
  end

  def current_nodes
    active_tokens.includes(:current_node).map(&:current_node)
  end

  # Progress tracking
  def progress_percentage
    total_nodes = bpmn_process.bpmn_nodes.count
    return 0 if total_nodes.zero?

    visited_nodes = bpmn_tokens.distinct.count(:current_node_id)
    ((visited_nodes.to_f / total_nodes) * 100).round
  end

  # Subject display
  def subject_display_name
    subject.try(:display_name) ||
      subject.try(:name) ||
      subject.try(:title) ||
      "#{subject_type} ##{subject_id}"
  end

  private

  def log_instance_started
    Rails.logger.info("BPMN Process Instance ##{id} started for #{subject_type}##{subject_id}")
  end

  def log_instance_completed
    Rails.logger.info("BPMN Process Instance ##{id} completed")
  end

  def log_instance_cancelled(reason)
    Rails.logger.info("BPMN Process Instance ##{id} cancelled: #{reason}")
  end

  def log_instance_failed(error_msg)
    Rails.logger.error("BPMN Process Instance ##{id} failed: #{error_msg}")
  end
end
