class SdaIncident < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy, optional: true
  belongs_to :contact, optional: true
  belongs_to :reported_by_user, class_name: "User", optional: true
  belongs_to :investigated_by_user, class_name: "User", optional: true

  INCIDENT_TYPES = %w[
    property_damage participant_safety medication_error unauthorized_restraint
    abuse_neglect injury fall missing_participant behavioral death other
  ].freeze

  SEVERITIES = %w[minor moderate serious critical].freeze

  STATUSES = %w[reported investigating resolved closed reported_to_commission].freeze

  NDIS_REPORTABLE_TYPES = %w[unauthorized_restraint abuse_neglect death injury].freeze

  validates :incident_type, presence: true, inclusion: { in: INCIDENT_TYPES }
  validates :severity, presence: true, inclusion: { in: SEVERITIES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :incident_number, uniqueness: true, allow_nil: true
  validates :incident_datetime, presence: true
  validates :description, presence: true

  before_create :generate_incident_number

  scope :open, -> { where(status: %w[reported investigating]) }
  scope :reportable, -> { where(incident_type: NDIS_REPORTABLE_TYPES).or(where(severity: %w[serious critical])) }

  def ndis_reportable?
    incident_type.in?(NDIS_REPORTABLE_TYPES) || severity.in?(%w[serious critical])
  end

  def overdue_for_reporting?
    return false unless ndis_reportable?
    return false if ndis_reported
    return false unless incident_datetime

    hours_since = (Time.current - incident_datetime) / 1.hour
    hours_since > 24
  end

  private

  def generate_incident_number
    date_part = (incident_datetime || Time.current).strftime("%Y%m%d")
    last_today = SdaIncident
      .where("incident_number LIKE ?", "SDA-INC-#{date_part}-%")
      .order(incident_number: :desc)
      .pick(:incident_number)

    seq = if last_today
            last_today.split("-").last.to_i + 1
          else
            1
          end

    self.incident_number = "SDA-INC-#{date_part}-#{seq.to_s.rjust(3, '0')}"
  end
end
