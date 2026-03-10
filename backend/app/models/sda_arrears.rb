class SdaArrears < ApplicationRecord
  self.table_name = "sda_arrears"

  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy
  belongs_to :contact, optional: true

  STATUSES = %w[current reminder_sent notice_issued breach referred resolved].freeze
  RESOLUTIONS = %w[paid_in_full payment_plan written_off eviction].freeze

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :resolution, inclusion: { in: RESOLUTIONS }, allow_nil: true
  validates :amount_overdue, presence: true, numericality: { greater_than: 0 }
  validates :days_overdue, presence: true

  scope :active, -> { where.not(status: "resolved") }
  scope :resolved, -> { where(status: "resolved") }
  scope :overdue, -> { where(status: %w[notice_issued breach referred]) }
  scope :critical, -> { where("days_overdue > ?", 14) }

  ESCALATION_ORDER = STATUSES.freeze

  def escalate!
    current_index = ESCALATION_ORDER.index(status)
    return false if current_index.nil? || current_index >= ESCALATION_ORDER.index("referred")

    next_status = ESCALATION_ORDER[current_index + 1]
    update!(status: next_status)
  end

  def next_escalation_step
    case status
    when "current" then "reminder_sent"
    when "reminder_sent" then "notice_issued"
    when "notice_issued" then "breach"
    when "breach" then "referred"
    else nil
    end
  end

  def resolve!(resolution_type)
    raise ArgumentError, "Invalid resolution: #{resolution_type}" unless resolution_type.in?(RESOLUTIONS)
    update!(
      status: "resolved",
      resolution: resolution_type,
      resolved_date: Date.current
    )
  end
end
