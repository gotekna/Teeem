class WhsInspectionItem < ApplicationRecord
  # Associations
  belongs_to :whs_inspection

  # Constants
  RESULTS = %w[pass fail na not_checked].freeze
  CATEGORIES = %w[site_safety equipment housekeeping traffic_management environmental other].freeze

  # Validations
  validates :item_description, presence: true
  validates :result, inclusion: { in: RESULTS }, allow_nil: true
  validates :position, numericality: { greater_than_or_equal_to: 0 }
  validate :notes_required_when_flagged
  validate :photo_required_when_flagged

  # Callbacks
  after_save :update_inspection_scores

  # Scopes
  scope :ordered, -> { order(:position) }
  scope :passed, -> { where(result: 'pass') }
  scope :failed, -> { where(result: 'fail') }
  scope :not_applicable, -> { where(result: 'na') }
  scope :not_checked, -> { where(result: 'not_checked') }
  scope :by_category, ->(category) { where(category: category) }
  scope :requiring_action, -> { where(action_required: true) }

  # Helper methods
  def passed?
    result == 'pass'
  end

  def failed?
    result == 'fail'
  end

  def not_applicable?
    result == 'na'
  end

  def checked?
    result != 'not_checked'
  end

  def has_photos?
    photo_urls.present? && photo_urls.any?
  end

  def photo_count
    photo_urls&.length || 0
  end

  private

  def notes_required_when_flagged
    if notes_required? && result == 'fail' && notes.blank?
      errors.add(:notes, 'must be provided when item fails')
    end
  end

  def photo_required_when_flagged
    if photo_required? && result == 'fail' && !has_photos?
      errors.add(:photo_urls, 'must be provided when item fails')
    end
  end

  def update_inspection_scores
    # Trigger inspection to recalculate scores
    whs_inspection.send(:calculate_compliance_score)
    whs_inspection.save if whs_inspection.changed?
  end
end
