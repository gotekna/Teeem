# Read-only model for mv_job_document_status materialized view
# Shows document completeness and counts per job
class MvJobDocumentStatus < ApplicationRecord
  self.table_name = "mv_job_document_status"
  self.primary_key = "job_id"

  # Read-only - prevent accidental writes
  def readonly?
    true
  end

  # Associations
  belongs_to :job, optional: true

  # Scopes by documentation status
  scope :complete, -> { where(documentation_status: "complete") }
  scope :partial, -> { where(documentation_status: "partial") }
  scope :missing, -> { where(documentation_status: "missing") }
  scope :needs_attention, -> { where(documentation_status: %w[partial missing]) }

  # Scopes by job status
  scope :for_job_status, ->(status) { where(job_status: status) }
  scope :for_job_type, ->(type) { where(job_type: type) }
  scope :with_pos, -> { where("po_count > 0") }
  scope :with_invoices, -> { where("invoice_count > 0") }
  scope :with_emails, -> { where("email_count > 0") }

  # Summary statistics
  def self.status_summary
    group(:documentation_status)
      .select("documentation_status, COUNT(*) as job_count")
      .order(:documentation_status)
  end

  def self.totals
    select(
      "COUNT(*) as total_jobs",
      "SUM(job_document_count) as total_documents",
      "SUM(po_count) as total_pos",
      "SUM(invoice_count) as total_invoices",
      "SUM(email_count) as total_emails"
    ).first
  end

  # Instance helpers
  def has_documents?
    job_document_count.to_i > 0
  end

  def has_pos?
    po_count.to_i > 0
  end

  def has_invoices?
    invoice_count.to_i > 0
  end

  def complete?
    documentation_status == "complete"
  end

  # Class method to refresh the view (supports CONCURRENTLY due to unique index)
  def self.refresh!(concurrently: true)
    if concurrently
      connection.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_job_document_status")
    else
      connection.execute("REFRESH MATERIALIZED VIEW mv_job_document_status")
    end
  end

  def self.last_refreshed_at
    first&.refreshed_at
  end
end
