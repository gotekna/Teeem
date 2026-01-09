class EmailCaseProposal < ApplicationRecord
  # Associations
  belongs_to :email_warehouse, class_name: "EmailWarehouse"
  belongs_to :case_record, class_name: "CaseRecord", optional: true
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :approved_by, class_name: "User", optional: true

  # Validations
  validates :status, presence: true, inclusion: { in: %w[pending approved rejected error] }
  validates :email_warehouse_id, presence: true

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :approved, -> { where(status: "approved") }
  scope :rejected, -> { where(status: "rejected") }
  scope :recent, -> { order(created_at: :desc) }
  scope :for_user, ->(user) { where(created_by: user) }

  # Extracted data accessors

  def case_title
    extracted_data["case_title"]
  end

  def case_type
    extracted_data["case_type"]
  end

  def description
    extracted_data["description"]
  end

  def priority
    extracted_data["priority"] || "normal"
  end

  def urgency
    extracted_data["urgency"] || "normal"
  end

  def involved_parties
    extracted_data["involved_parties"] || []
  end

  def primary_party
    involved_parties.find { |p| p["is_primary"] }
  end

  def related_jobs
    extracted_data["related_jobs"] || []
  end

  def related_companies
    extracted_data["related_companies"] || []
  end

  def key_dates
    extracted_data["key_dates"] || []
  end

  def document_requests
    extracted_data["document_requests"] || []
  end

  def confidence_score_value
    extracted_data["confidence_score"] || read_attribute(:confidence_score) || 0.0
  end

  def missing_info
    extracted_data["missing_info"] || []
  end

  def has_missing_info?
    missing_info.any?
  end

  # Confidence helpers
  def high_confidence?
    confidence_score_value >= 0.8
  end

  def medium_confidence?
    confidence_score_value >= 0.5 && confidence_score_value < 0.8
  end

  def low_confidence?
    confidence_score_value < 0.5
  end

  # Status helpers
  def pending?
    status == "pending"
  end

  def approved?
    status == "approved"
  end

  def rejected?
    status == "rejected"
  end

  def error?
    status == "error"
  end

  # Actions
  def mark_approved!(by_user:, case_record:)
    update!(
      status: "approved",
      approved_by: by_user,
      approved_at: Time.current,
      case_record: case_record
    )
  end

  def mark_rejected!(reason:)
    update!(
      status: "rejected",
      rejection_reason: reason
    )

    # Mark email as actioned (rejected) so it won't create another proposal
    email_warehouse.update!(
      match_type: "case_rejected",
      matched_at: Time.current
    )
  end

  def mark_error!(error_msg:)
    update!(
      status: "error",
      error_message: error_msg
    )
  end

  # For JSON responses
  def as_json(options = {})
    super(options.merge(
      include: {
        email_warehouse: {
          methods: [ :display_from, :preview_body ]
        },
        created_by: {},
        approved_by: {},
        case_record: {}
      },
      methods: [
        :case_title,
        :case_type,
        :description,
        :priority,
        :urgency,
        :involved_parties,
        :primary_party,
        :related_jobs,
        :related_companies,
        :key_dates,
        :document_requests,
        :confidence_score_value,
        :missing_info,
        :has_missing_info?,
        :high_confidence?,
        :medium_confidence?,
        :low_confidence?
      ]
    ))
  end
end
