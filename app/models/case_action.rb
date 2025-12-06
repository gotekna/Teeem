# CaseAction model - individual investigation actions/queries
# Each action represents a specific search or analysis operation
class CaseAction < ApplicationRecord
  # ============================================
  # ASSOCIATIONS
  # ============================================

  belongs_to :case_record, foreign_key: :case_id, class_name: "CaseRecord"
  belongs_to :created_by, class_name: "User", optional: true

  # ============================================
  # VALIDATIONS
  # ============================================

  validates :action_type, presence: true, inclusion: {
    in: %w[
      document_search
      email_search
      timeline_build
      financial_analysis
      invoice_reconciliation
      document_completeness
      resource_audit
      entity_analysis
      inconsistency_check
      summary_report
      full_analysis
    ]
  }
  validates :status, inclusion: { in: %w[pending running completed failed] }

  # ============================================
  # CALLBACKS
  # ============================================

  after_update :calculate_execution_time, if: :saved_change_to_completed_at?

  # ============================================
  # SCOPES
  # ============================================

  scope :pending, -> { where(status: "pending") }
  scope :running, -> { where(status: "running") }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :by_type, ->(type) { where(action_type: type) }
  scope :recent_first, -> { order(created_at: :desc) }
  scope :with_results, -> { where.not(results: {}) }

  # ============================================
  # CONSTANTS
  # ============================================

  ACTION_TYPES = {
    "document_search" => {
      name: "Document Search",
      description: "Search documents across related entities",
      icon: "file-search",
      data_sources: [ "mv_document_summary", "company_documents" ]
    },
    "email_search" => {
      name: "Email Search",
      description: "Full-text search across email warehouse",
      icon: "mail-search",
      data_sources: [ "email_warehouse" ]
    },
    "timeline_build" => {
      name: "Build Timeline",
      description: "Auto-generate chronological timeline from all sources",
      icon: "calendar-clock",
      data_sources: [ "email_warehouse", "company_documents", "financial_transactions" ]
    },
    "financial_analysis" => {
      name: "Financial Analysis",
      description: "Analyze financial patterns and anomalies",
      icon: "chart-line",
      data_sources: [ "mv_financial_summary", "mv_job_summary" ]
    },
    "invoice_reconciliation" => {
      name: "Invoice Reconciliation",
      description: "Find unmatched POs and invoice variances",
      icon: "receipt",
      data_sources: [ "mv_invoice_po_reconciliation" ]
    },
    "document_completeness" => {
      name: "Document Completeness",
      description: "Identify missing required documents",
      icon: "clipboard-check",
      data_sources: [ "mv_document_completeness", "mv_job_document_status" ]
    },
    "resource_audit" => {
      name: "Resource Audit",
      description: "Analyze time entries and labor costs",
      icon: "users",
      data_sources: [ "mv_resource_utilization", "mv_task_metrics" ]
    },
    "entity_analysis" => {
      name: "Entity Analysis",
      description: "Deep dive on a person or company",
      icon: "user-search",
      data_sources: [ "contacts", "companies", "contact_relationships" ]
    },
    "inconsistency_check" => {
      name: "Inconsistency Check",
      description: "AI analysis to find contradictions and issues",
      icon: "alert-triangle",
      data_sources: [ "all" ]
    },
    "summary_report" => {
      name: "Summary Report",
      description: "Generate executive summary of findings",
      icon: "file-text",
      data_sources: [ "case_actions", "case_documents", "case_emails" ]
    },
    "full_analysis" => {
      name: "Full Case Analysis",
      description: "Import emails from warehouse, extract entities, build timeline, extract Q&A, find document links",
      icon: "sparkles",
      data_sources: [ "email_warehouse", "contacts", "companies", "case_emails", "case_timeline_events", "case_email_qas" ]
    }
  }.freeze

  # ============================================
  # INSTANCE METHODS
  # ============================================

  def action_config
    ACTION_TYPES[action_type] || {}
  end

  def action_name
    action_config[:name] || action_type.titleize
  end

  def action_description
    action_config[:description]
  end

  def action_icon
    action_config[:icon] || "search"
  end

  def data_sources
    action_config[:data_sources] || []
  end

  # Mark as running
  def start!
    update!(status: "running", started_at: Time.current, error_message: nil)
  end

  # Mark as completed with results
  def complete!(results:, ai_analysis: nil, inconsistencies: [], result_count: nil)
    update!(
      status: "completed",
      completed_at: Time.current,
      results: results,
      ai_analysis: ai_analysis,
      inconsistencies: inconsistencies,
      result_count: result_count || calculate_result_count(results)
    )
  end

  # Mark as failed
  def fail!(error_message)
    update!(
      status: "failed",
      completed_at: Time.current,
      error_message: error_message
    )
  end

  def completed?
    status == "completed"
  end

  def failed?
    status == "failed"
  end

  def running?
    status == "running"
  end

  def pending?
    status == "pending"
  end

  def has_inconsistencies?
    inconsistencies.present? && inconsistencies.any?
  end

  def execution_duration
    return nil unless started_at && completed_at
    completed_at - started_at
  end

  def formatted_execution_time
    return nil unless execution_time_ms
    if execution_time_ms < 1000
      "#{execution_time_ms}ms"
    else
      "#{(execution_time_ms / 1000.0).round(2)}s"
    end
  end

  private

  def calculate_execution_time
    return unless started_at && completed_at
    update_column(:execution_time_ms, ((completed_at - started_at) * 1000).to_i)
  end

  def calculate_result_count(results)
    return 0 if results.blank?
    return results.length if results.is_a?(Array)
    return results["count"] if results["count"]
    return results["items"]&.length if results["items"]
    0
  end
end
