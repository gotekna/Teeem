class SupervisorChecklistTemplate < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable

  RESPONSE_TYPES = %w[checkbox photo note photo_and_note].freeze

  validates :name, presence: true, uniqueness: { scope: :tenant_id }
  validates :sequence_order, presence: true
  validates :response_type, presence: true, inclusion: { in: RESPONSE_TYPES }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order) }
  scope :by_category, ->(category) { where(category: category) }

  before_validation :set_default_sequence_order, on: :create
  before_validation :set_default_response_type

  # Helper to get all unique categories
  def self.categories
    where.not(category: nil).distinct.pluck(:category).sort
  end

  private

  def set_default_sequence_order
    return if sequence_order.present?

    max_order = self.class.maximum(:sequence_order) || 0
    self.sequence_order = max_order + 1
  end

  def set_default_response_type
    self.response_type ||= "checkbox"
  end
end
