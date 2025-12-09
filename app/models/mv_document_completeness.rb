# Read-only model for mv_document_completeness materialized view
# Shows document counts by company and financial year with verification status
class MvDocumentCompleteness < ApplicationRecord
  self.table_name = "mv_document_completeness"

  # Read-only - prevent accidental writes
  def readonly?
    true
  end

  # Associations for convenience
  belongs_to :corporate_company, foreign_key: "company_id", optional: true

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_company_code, ->(code) { where(company_code: code) }
  scope :for_financial_year, ->(year) { where(financial_year: year) }
  scope :for_type, ->(type) { where(document_type: type) }
  scope :for_category, ->(category) { where(document_category: category) }
  scope :for_entity_type, ->(entity_type) { where(entity_type: entity_type) }
  scope :pending_verification, -> { where(ai_verification_status: [ nil, "pending" ]) }
  scope :verified, -> { where(ai_verification_status: "verified") }
  scope :needs_review, -> { where(ai_verification_status: [ "mismatch", "needs_review" ]) }

  # Summary by company
  def self.company_summary(company_id)
    for_company(company_id)
      .group(:financial_year)
      .select(
        "financial_year",
        "SUM(document_count) as total_documents",
        "SUM(verified_count) as total_verified",
        "SUM(pending_count) as total_pending",
        "SUM(needs_review_count) as total_needs_review"
      )
      .order(:financial_year)
  end

  # Summary by financial year (across all companies)
  def self.fy_summary(financial_year)
    for_financial_year(financial_year)
      .group(:company_code, :company_name)
      .select(
        "company_code",
        "company_name",
        "SUM(document_count) as total_documents",
        "SUM(verified_count) as total_verified",
        "SUM(pending_count) as total_pending"
      )
      .order(:company_code)
  end

  # Class method to refresh the view
  def self.refresh!(concurrently: false)
    # Note: No unique index, so CONCURRENTLY not supported
    connection.execute("REFRESH MATERIALIZED VIEW mv_document_completeness")
  end

  # Check when view was last refreshed
  def self.last_refreshed_at
    first&.refreshed_at
  end
end
