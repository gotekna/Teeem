# frozen_string_literal: true

# SmHoldLog - Audit trail for hold operations
#
# See Trinity Bible Rules 9.21 (SM Gantt - Hold Task System)
# See GANTT_ARCHITECTURE_PLAN.md Section 2.6
#
class SmHoldLog < ApplicationRecord
  EVENT_TYPES = %w[hold_started hold_released].freeze

  belongs_to :construction
  belongs_to :hold_task, class_name: 'SmTask'
  belongs_to :hold_reason, class_name: 'SmHoldReason', optional: true
  belongs_to :hold_started_by, class_name: 'User', optional: true
  belongs_to :hold_released_by, class_name: 'User', optional: true

  validates :event_type, presence: true, inclusion: { in: EVENT_TYPES }

  scope :starts, -> { where(event_type: 'hold_started') }
  scope :releases, -> { where(event_type: 'hold_released') }
  scope :for_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :recent, -> { order(created_at: :desc) }

  def hold_started?
    event_type == 'hold_started'
  end

  def hold_released?
    event_type == 'hold_released'
  end
end
