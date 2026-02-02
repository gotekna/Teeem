class EmailJobProposal < ApplicationRecord
  # Associations
  # SSoT: Legacy column is email_warehouse_id, but association uses synced_email
  belongs_to :synced_email, class_name: "SyncedEmail", foreign_key: :email_warehouse_id
  belongs_to :created_by_user, class_name: "User"
  belongs_to :approved_by_user, class_name: "User", optional: true
  belongs_to :job, optional: true

  # Validations
  validates :status, presence: true, inclusion: { in: %w[pending approved rejected error] }
  validates :email_warehouse_id, presence: true
  validates :created_by_user_id, presence: true
  validates :extracted_data, presence: true

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :approved, -> { where(status: "approved") }
  scope :rejected, -> { where(status: "rejected") }
  scope :recent, -> { order(created_at: :desc) }
  scope :for_user, ->(user) { where(created_by_user: user) }

  # Instance methods

  def customer_name
    extracted_data.dig("customer", "name")
  end

  def job_title
    extracted_data["job_title"]
  end

  def confidence_score
    extracted_data["confidence_score"] || 0.0
  end

  def high_confidence?
    confidence_score >= 0.8
  end

  def medium_confidence?
    confidence_score >= 0.5 && confidence_score < 0.8
  end

  def low_confidence?
    confidence_score < 0.5
  end

  def missing_info
    extracted_data["missing_info"] || []
  end

  def has_missing_info?
    missing_info.any?
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
  def mark_approved!(by_user:, job:)
    update!(
      status: "approved",
      approved_by_user: by_user,
      approved_at: Time.current,
      job: job
    )
  end

  def mark_rejected!(reason:)
    update!(
      status: "rejected",
      rejection_reason: reason
    )

    # Mark email as actioned (rejected) so it won't create another proposal
    synced_email.update!(
      match_type: "rejected",
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
        synced_email: {
          methods: [ :display_from, :preview_body ]
        },
        created_by_user: {},
        approved_by_user: {},
        job: {}
      },
      methods: [
        :customer_name,
        :job_title,
        :confidence_score,
        :high_confidence?,
        :medium_confidence?,
        :low_confidence?,
        :has_missing_info?
      ]
    ))
  end
end
