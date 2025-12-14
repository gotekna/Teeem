class Email < ApplicationRecord
  belongs_to :job, optional: true
  belongs_to :user, optional: true

  validates :from_email, presence: true
  validates :message_id, uniqueness: true, allow_nil: true

  # Serialize JSON fields
  serialize :to_emails, coder: JSON
  serialize :cc_emails, coder: JSON
  serialize :bcc_emails, coder: JSON
  serialize :references, coder: JSON

  scope :recent, ->(limit = 50) { order(received_at: :desc).limit(limit) }
  scope :for_job, ->(job_id) { where(job_id: job_id).order(received_at: :desc) }
  scope :unassigned, -> { where(job_id: nil).order(received_at: :desc) }
  scope :with_attachments, -> { where(has_attachments: true) }

  def formatted_received_at
    return nil unless received_at

    if received_at.today?
      received_at.strftime("%I:%M %p")
    elsif received_at.year == Time.current.year
      received_at.strftime("%b %d at %I:%M %p")
    else
      received_at.strftime("%b %d, %Y at %I:%M %p")
    end
  end

  def short_subject
    return "No Subject" if subject.blank?
    subject.length > 100 ? "#{subject[0..97]}..." : subject
  end

  def as_json(options = {})
    super(options.merge(
      include: {
        job: {},
        user: {}
      },
      methods: [ :formatted_received_at, :short_subject ]
    ))
  end
end
