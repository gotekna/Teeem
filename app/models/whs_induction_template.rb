class WHSInductionTemplate < ApplicationRecord
  # Associations
  has_many :whs_inductions

  # Constants
  INDUCTION_TYPES = %w[company_wide site_specific project_specific visitor].freeze

  # Validations
  validates :name, presence: true
  validates :induction_type, presence: true, inclusion: { in: INDUCTION_TYPES }
  validates :version, presence: true, numericality: { greater_than: 0 }
  validates :min_passing_score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, if: :has_quiz?

  # Scopes
  scope :active, -> { where(active: true) }
  scope :inactive, -> { where(active: false) }
  scope :by_type, ->(type) { where(induction_type: type) }
  scope :with_quiz, -> { where(has_quiz: true) }
  scope :latest_versions, -> { order(version: :desc) }

  # Helper methods
  def section_count
    content_sections&.length || 0
  end

  def has_video_content?
    return false unless content_sections.present?

    content_sections.any? { |section| section['video_url'].present? }
  end

  def total_quiz_questions
    return 0 unless has_quiz? && content_sections.present?

    content_sections.sum { |section| section.dig('quiz_questions')&.length || 0 }
  end

  def never_expires?
    expiry_months.nil?
  end

  def deactivate!
    update!(active: false)
  end

  def activate!
    update!(active: true)
  end

  def create_new_version
    new_template = dup
    new_template.version += 0.1
    new_template.content_sections = content_sections.deep_dup if content_sections.present?
    new_template
  end

  def duplicate
    new_template = dup
    new_template.name = "#{name} (Copy)"
    new_template.version = 1.0
    new_template.content_sections = content_sections.deep_dup if content_sections.present?
    new_template
  end
end
