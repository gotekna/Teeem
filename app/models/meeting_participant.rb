class MeetingParticipant < ApplicationRecord
  # Associations
  belongs_to :meeting
  belongs_to :user, optional: true
  belongs_to :contact, optional: true

  # Validations
  validates :response_status, inclusion: {
    in: %w[pending accepted declined tentative]
  }
  validate :must_have_user_or_contact
  validate :cannot_have_both_user_and_contact
  validate :only_one_organizer_per_meeting, if: :is_organizer?

  # Scopes
  scope :organizers, -> { where(is_organizer: true) }
  scope :required, -> { where(is_required: true) }
  scope :optional, -> { where(is_required: false) }
  scope :accepted, -> { where(response_status: 'accepted') }
  scope :declined, -> { where(response_status: 'declined') }
  scope :pending, -> { where(response_status: 'pending') }

  # Helper methods
  def participant_name
    user&.name || contact&.name || 'Unknown'
  end

  def participant_email
    user&.email || contact&.email
  end

  def accept!
    update(response_status: 'accepted')
  end

  def decline!
    update(response_status: 'declined')
  end

  def tentative!
    update(response_status: 'tentative')
  end

  private

  def must_have_user_or_contact
    if user_id.blank? && contact_id.blank?
      errors.add(:base, 'Must have either a user or contact')
    end
  end

  def cannot_have_both_user_and_contact
    if user_id.present? && contact_id.present?
      errors.add(:base, 'Cannot have both user and contact')
    end
  end

  def only_one_organizer_per_meeting
    return unless meeting

    existing_organizer = meeting.meeting_participants
                               .where(is_organizer: true)
                               .where.not(id: id)
                               .exists?

    if existing_organizer
      errors.add(:is_organizer, 'only one organizer allowed per meeting')
    end
  end
end
