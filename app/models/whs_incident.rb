class WhsIncident < ApplicationRecord
  # Associations
  belongs_to :construction, optional: true
  belongs_to :reported_by_user, class_name: 'User'
  belongs_to :investigated_by_user, class_name: 'User', optional: true

  has_many :whs_action_items, as: :actionable, dependent: :destroy

  # Constants
  STATUSES = %w[reported under_investigation actions_required closed].freeze
  INCIDENT_CATEGORIES = %w[
    near_miss first_aid medical_treatment lti property_damage
    environmental security dangerous_occurrence
  ].freeze
  INCIDENT_TYPES = %w[
    slip_trip_fall manual_handling hit_by_object contact_with_sharp
    contact_with_hot electrical_incident fall_from_height
    plant_equipment chemical_exposure other
  ].freeze
  SEVERITY_LEVELS = %w[low medium high critical].freeze

  # Validations
  validates :incident_number, presence: true, uniqueness: true
  validates :incident_date, presence: true
  validates :report_date, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :incident_category, presence: true, inclusion: { in: INCIDENT_CATEGORIES }
  validates :severity_level, presence: true, inclusion: { in: SEVERITY_LEVELS }
  validates :what_happened, presence: true

  # Callbacks
  before_validation :generate_incident_number, on: :create
  before_validation :set_report_date, on: :create
  before_save :check_workcov_notification_requirement
  after_create :create_investigation_task

  # Scopes
  scope :reported, -> { where(status: 'reported') }
  scope :under_investigation, -> { where(status: 'under_investigation') }
  scope :actions_required, -> { where(status: 'actions_required') }
  scope :closed, -> { where(status: 'closed') }
  scope :for_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :by_category, ->(category) { where(incident_category: category) }
  scope :by_severity, ->(severity) { where(severity_level: severity) }
  scope :lti, -> { where(incident_category: 'lti') }
  scope :near_miss, -> { where(incident_category: 'near_miss') }
  scope :requiring_workcov, -> { where(workcov_notification_required: true) }
  scope :this_month, -> { where('incident_date >= ?', CompanySetting.today.beginning_of_month) }
  scope :recent, -> { order(incident_date: :desc) }

  # State machine methods
  def can_investigate?
    status == 'reported'
  end

  def can_close?
    status == 'actions_required' && all_actions_completed?
  end

  def investigate!(investigating_user)
    return false unless can_investigate?

    update!(
      status: 'under_investigation',
      investigated_by_user: investigating_user,
      investigation_date: CompanySetting.today
    )
  end

  def close!(closure_notes_text)
    return false unless can_close?

    update!(
      status: 'closed',
      closed_at: Time.current,
      closure_notes: closure_notes_text
    )
  end

  # Helper methods
  def lost_time_injury?
    incident_category == 'lti'
  end

  def near_miss?
    incident_category == 'near_miss'
  end

  def critical?
    severity_level == 'critical'
  end

  def investigated?
    investigated_by_user.present?
  end

  def closed?
    status == 'closed'
  end

  def all_actions_completed?
    whs_action_items.where.not(status: 'completed').none?
  end

  def open_actions_count
    whs_action_items.where.not(status: ['completed', 'cancelled']).count
  end

  def workcov_notified?
    workcov_notification_date.present?
  end

  def days_since_incident
    (CompanySetting.today - incident_date.to_date).to_i
  end

  def witness_count
    witnesses&.length || 0
  end

  def has_photos?
    photo_urls.present? && photo_urls.any?
  end

  def photo_count
    photo_urls&.length || 0
  end

  private

  def generate_incident_number
    return if incident_number.present?

    date_str = CompanySetting.today.strftime('%Y%m%d')
    last_incident = WhsIncident.where('incident_number LIKE ?', "INC-#{date_str}-%")
                                .order(:incident_number).last

    sequence = last_incident ? last_incident.incident_number.split('-').last.to_i + 1 : 1
    self.incident_number = "INC-#{date_str}-#{sequence.to_s.rjust(3, '0')}"
  end

  def set_report_date
    self.report_date ||= Time.current
  end

  def check_workcov_notification_requirement
    # WorkCover QLD requires notification for:
    # - Death
    # - Serious injury or illness (LTI, medical treatment)
    # - Dangerous incident

    if incident_category.in?(['lti', 'medical_treatment', 'dangerous_occurrence'])
      self.workcov_notification_required = true
      self.notifiable_incident = true if severity_level.in?(['high', 'critical'])
    end
  end

  def create_investigation_task
    # TODO: Create ProjectTask for WPHS Appointee to investigate
    # Priority based on severity:
    # - Critical: Immediate
    # - High: High
    # - Medium/Low: Medium
  end
end
