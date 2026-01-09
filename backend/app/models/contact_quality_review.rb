class ContactQualityReview < ApplicationRecord
  belongs_to :contact
  belongs_to :suggested_company, class_name: "Contact", optional: true
  belongs_to :reviewed_by, class_name: "User", optional: true

  ISSUE_TYPES = %w[
    misclassified_person
    misclassified_company
    abn_mismatch
    needs_company_link
    multiple_xero_links
    admin_email_pattern
  ].freeze

  STATUSES = %w[pending approved rejected skipped].freeze

  RECOMMENDED_ACTIONS = %w[
    convert_to_company
    convert_to_person
    link_to_existing_company
    create_new_company_and_link
    no_action
  ].freeze

  validates :issue_type, inclusion: { in: ISSUE_TYPES }
  validates :status, inclusion: { in: STATUSES }
  validates :recommended_action, inclusion: { in: RECOMMENDED_ACTIONS }
  validates :contact_id, uniqueness: { scope: :issue_type, message: "already has a review for this issue type" }

  scope :pending, -> { where(status: "pending") }
  scope :approved, -> { where(status: "approved") }
  scope :rejected, -> { where(status: "rejected") }
  scope :by_issue_type, ->(type) { where(issue_type: type) }
  scope :high_confidence, -> { where("confidence_score >= ?", 80) }
  scope :low_confidence, -> { where("confidence_score < ?", 50) }

  # Human-readable labels for issue types
  ISSUE_TYPE_LABELS = {
    "misclassified_person" => "Person should be Company",
    "misclassified_company" => "Company should be Person",
    "abn_mismatch" => "ABN Entity Type Mismatch",
    "needs_company_link" => "Person needs Company Link",
    "multiple_xero_links" => "Multiple Xero Links",
    "admin_email_pattern" => "Business Email Pattern"
  }.freeze

  # Human-readable labels for recommended actions
  RECOMMENDED_ACTION_LABELS = {
    "convert_to_company" => "Convert to Company",
    "convert_to_person" => "Convert to Person",
    "link_to_existing_company" => "Link to Existing Company",
    "create_new_company_and_link" => "Create Company & Link",
    "no_action" => "No Action Required"
  }.freeze

  def issue_type_label
    ISSUE_TYPE_LABELS[issue_type] || issue_type.humanize
  end

  def recommended_action_label
    RECOMMENDED_ACTION_LABELS[recommended_action] || recommended_action.humanize
  end

  def high_confidence?
    confidence_score.to_i >= 80
  end

  def reviewed?
    %w[approved rejected skipped].include?(status)
  end

  def approve!(user, notes: nil)
    update!(
      status: "approved",
      reviewed_by: user,
      reviewed_at: Time.current,
      review_notes: notes
    )
  end

  def reject!(user, notes: nil)
    update!(
      status: "rejected",
      reviewed_by: user,
      reviewed_at: Time.current,
      review_notes: notes
    )
  end

  def skip!(user, notes: nil)
    update!(
      status: "skipped",
      reviewed_by: user,
      reviewed_at: Time.current,
      review_notes: notes
    )
  end
end
