class RainLog < ApplicationRecord
  # Associations
  belongs_to :job
  belongs_to :created_by_user, class_name: "User", optional: true

  # Enums
  enum :severity, {
    light: "light",
    moderate: "moderate",
    heavy: "heavy"
  }, prefix: true

  enum :source, {
    automatic: "automatic",
    manual: "manual"
  }, prefix: true

  # Validations
  validates :date, presence: true
  validates :rainfall_mm, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :hours_affected, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :source, presence: true
  validates :notes, presence: true, if: :source_manual?
  validate :date_cannot_be_in_future

  # Scopes
  scope :recent, -> { order(date: :desc) }
  scope :automatic, -> { where(source: "automatic") }
  scope :manual, -> { where(source: "manual") }
  scope :by_date_range, ->(start_date, end_date) { where(date: start_date..end_date) }

  # Class methods
  def self.calculate_severity(rainfall_mm)
    return nil if rainfall_mm.nil? || rainfall_mm.zero?

    if rainfall_mm < 5
      "light"
    elsif rainfall_mm < 15
      "moderate"
    else
      "heavy"
    end
  end

  # Instance methods
  def auto_calculate_severity!
    return unless rainfall_mm

    calculated = self.class.calculate_severity(rainfall_mm)
    update_column(:severity, calculated) if calculated
  end

  private

  def date_cannot_be_in_future
    if date.present? && date > Date.current
      errors.add(:date, "can't be in the future")
    end
  end
end
