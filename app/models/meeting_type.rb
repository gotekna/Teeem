class MeetingType < ApplicationRecord
  # Validations
  validates :name, presence: true, uniqueness: true
  validates :default_duration_minutes, numericality: { greater_than: 0, allow_nil: true }
  validates :minimum_participants, numericality: { greater_than: 0, allow_nil: true }
  validates :maximum_participants, numericality: { greater_than: 0, allow_nil: true }

  validate :maximum_greater_than_minimum

  # Serialize JSON fields
  serialize :required_participant_types, coder: JSON
  serialize :optional_participant_types, coder: JSON
  serialize :default_agenda_items, coder: JSON
  serialize :required_fields, coder: JSON
  serialize :optional_fields, coder: JSON
  serialize :custom_fields, coder: JSON
  serialize :required_documents, coder: JSON
  serialize :notification_settings, coder: JSON

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :by_category, ->(category) { where(category: category) }
  scope :system_defaults, -> { where(is_system_default: true) }
  scope :custom, -> { where(is_system_default: false) }

  # Associations
  has_many :meetings, foreign_key: 'meeting_type_id', primary_key: 'id', dependent: :restrict_with_error

  # Callbacks
  before_destroy :prevent_system_default_deletion

  # Class methods
  def self.categories
    pluck(:category).compact.uniq.sort
  end

  # Instance methods
  def can_delete?
    !is_system_default && meetings.count.zero?
  end

  def participant_types_list
    (required_participant_types || []) + (optional_participant_types || [])
  end

  def all_fields_list
    (required_fields || []) + (optional_fields || [])
  end

  def to_template
    {
      id: id,
      name: name,
      description: description,
      category: category,
      icon: icon,
      color: color,
      default_duration_minutes: default_duration_minutes,
      required_participant_types: required_participant_types || [],
      optional_participant_types: optional_participant_types || [],
      minimum_participants: minimum_participants,
      maximum_participants: maximum_participants,
      default_agenda_items: default_agenda_items || [],
      required_fields: required_fields || [],
      optional_fields: optional_fields || [],
      custom_fields: custom_fields || [],
      required_documents: required_documents || [],
      notification_settings: notification_settings || {},
      is_active: is_active,
      is_system_default: is_system_default
    }
  end

  private

  def maximum_greater_than_minimum
    if minimum_participants.present? && maximum_participants.present? && maximum_participants < minimum_participants
      errors.add(:maximum_participants, 'must be greater than or equal to minimum participants')
    end
  end

  def prevent_system_default_deletion
    if is_system_default
      errors.add(:base, 'Cannot delete system default meeting type')
      throw(:abort)
    end
  end
end
