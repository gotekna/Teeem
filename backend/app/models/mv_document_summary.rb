# Read-only model for mv_document_summary materialized view
# This view pre-computes document metrics by company/type/status
class MvDocumentSummary < ApplicationRecord
  self.table_name = "mv_document_summary"

  # Read-only - prevent accidental writes
  def readonly?
    true
  end

  # Associations for convenience
  belongs_to :corporate_company, foreign_key: "company_id", optional: true

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_company_code, ->(code) { where(company_code: code) }
  scope :for_year, ->(year) { where(document_year: year) }
  scope :for_type, ->(type) { where(document_type: type) }
  scope :pending_verification, -> { where(ai_verification_status: [ nil, "pending" ]) }
  scope :verified, -> { where(ai_verification_status: "verified") }
  scope :needs_review, -> { where(ai_verification_status: [ "mismatch", "needs_review" ]) }

  # Aggregations
  def self.total_documents
    sum(:document_count)
  end

  def self.total_verified
    sum(:verified_count)
  end

  def self.total_pending
    sum(:pending_count)
  end

  def self.verification_rate
    total = total_documents
    return 0 if total.zero?
    (total_verified.to_f / total * 100).round(1)
  end

  # Class method to refresh the view
  def self.refresh!(concurrently: true)
    if concurrently
      connection.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_document_summary")
    else
      connection.execute("REFRESH MATERIALIZED VIEW mv_document_summary")
    end
  end

  # Check when view was last refreshed
  def self.last_refreshed_at
    first&.refreshed_at
  end
end
