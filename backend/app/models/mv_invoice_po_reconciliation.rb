# Read-only model for mv_invoice_po_reconciliation materialized view
# Shows reconciliation status between purchase orders and supplier invoices
class MvInvoicePoReconciliation < ApplicationRecord
  self.table_name = "mv_invoice_po_reconciliation"
  self.primary_key = "purchase_order_id"

  # Read-only - prevent accidental writes
  def readonly?
    true
  end

  # Associations for convenience
  belongs_to :purchase_order, foreign_key: "purchase_order_id", optional: true
  belongs_to :job, optional: true
  belongs_to :supplier, class_name: "Contact", foreign_key: "supplier_id", optional: true

  # Scopes by reconciliation status
  scope :matched, -> { where(reconciliation_status: "matched") }
  scope :no_invoices, -> { where(reconciliation_status: "no_invoices") }
  scope :under_invoiced, -> { where(reconciliation_status: "under_invoiced") }
  scope :over_invoiced, -> { where(reconciliation_status: "over_invoiced") }
  scope :needs_attention, -> { where(reconciliation_status: %w[under_invoiced over_invoiced]) }

  # Scopes by PO status
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :for_supplier, ->(supplier_id) { where(supplier_id: supplier_id) }
  scope :active, -> { where.not(po_status: %w[cancelled paid]) }
  scope :with_documents, -> { where("po_document_count > 0") }
  scope :without_documents, -> { where(po_document_count: 0) }

  # Summary statistics
  def self.status_summary
    group(:reconciliation_status)
      .select("reconciliation_status, COUNT(*) as count, SUM(po_total) as total_value")
      .order(:reconciliation_status)
  end

  def self.job_summary(job_id)
    for_job(job_id).status_summary
  end

  # Variance analysis
  def self.total_variance
    sum(:variance)
  end

  def self.over_invoiced_total
    over_invoiced.sum("invoiced_total - po_total")
  end

  def self.under_invoiced_total
    under_invoiced.sum("po_total - invoiced_total")
  end

  # Instance helpers
  def matched?
    reconciliation_status == "matched"
  end

  def needs_attention?
    %w[under_invoiced over_invoiced].include?(reconciliation_status)
  end

  def has_invoices?
    invoice_count.to_i > 0
  end

  def variance_percent
    return 0 if po_total.nil? || po_total.zero?
    ((variance.to_f / po_total) * 100).round(1)
  end

  # Class method to refresh the view (supports CONCURRENTLY due to unique index)
  def self.refresh!(concurrently: true)
    if concurrently
      connection.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_invoice_po_reconciliation")
    else
      connection.execute("REFRESH MATERIALIZED VIEW mv_invoice_po_reconciliation")
    end
  end

  # Check when view was last refreshed
  def self.last_refreshed_at
    first&.refreshed_at
  end
end
