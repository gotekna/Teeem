class Meeting < ApplicationRecord
  # Associations
  belongs_to :job, optional: true
  alias_method :construction, :job  # Backwards compatibility
  belongs_to :created_by, class_name: "User"
  belongs_to :meeting_type
  has_many :meeting_participants, dependent: :destroy
  has_many :meeting_agenda_items, -> { order(:sequence_order) }, dependent: :destroy
  has_many :users, through: :meeting_participants
  has_many :contacts, through: :meeting_participants

  # Validations
  validates :title, presence: true
  validates :start_time, presence: true
  validates :end_time, presence: true
  validates :status, presence: true, inclusion: {
    in: %w[scheduled in_progress completed cancelled]
  }
  validate :end_time_after_start_time
  validate :must_have_at_least_one_participant, on: :update

  # Scopes
  scope :upcoming, -> { where("start_time > ?", Time.current).order(:start_time) }
  scope :past, -> { where("start_time <= ?", Time.current).order(start_time: :desc) }
  scope :for_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :for_user, ->(user_id) {
    joins(:meeting_participants).where(meeting_participants: { user_id: user_id })
  }

  # Callbacks
  before_save :ensure_timezone_consistency

  # Status state machine helper methods
  def can_start?
    status == "scheduled" && start_time <= Time.current
  end

  def can_complete?
    status == "in_progress"
  end

  def start!
    update(status: "in_progress") if can_start?
  end

  def complete!
    update(status: "completed") if can_complete?
  end

  def cancel!
    update(status: "cancelled") unless completed?
  end

  def completed?
    status == "completed"
  end

  def cancelled?
    status == "cancelled"
  end

  # Helper methods
  def duration_minutes
    return nil unless start_time && end_time
    ((end_time - start_time) / 60).to_i
  end

  def organizer
    meeting_participants.find_by(is_organizer: true)
  end

  def required_participants
    meeting_participants.where(is_required: true)
  end

  def optional_participants
    meeting_participants.where(is_required: false)
  end

  private

  def end_time_after_start_time
    return if end_time.blank? || start_time.blank?

    if end_time <= start_time
      errors.add(:end_time, "must be after start time")
    end
  end

  def must_have_at_least_one_participant
    return unless persisted?  # Skip for new records

    if meeting_participants.empty?
      errors.add(:base, "Meeting must have at least one participant")
    end
  end

  # Following B03.002: Timezone handling - use CorporateCompanySetting.timezone
  def ensure_timezone_consistency
    return unless CorporateCompanySetting.instance

    # Ensure times are in the company timezone
    timezone = CorporateCompanySetting.instance.timezone
    self.start_time = start_time.in_time_zone(timezone) if start_time_changed?
    self.end_time = end_time.in_time_zone(timezone) if end_time_changed?
  end
end
