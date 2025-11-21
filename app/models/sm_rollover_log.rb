# frozen_string_literal: true

# SmRolloverLog - Audit trail for rollover operations
#
# See GANTT_ARCHITECTURE_PLAN.md Section 2.3
#
class SmRolloverLog < ApplicationRecord
  belongs_to :task, class_name: 'SmTask'
  belongs_to :construction

  validates :rollover_batch_id, presence: true
  validates :rollover_timestamp, presence: true

  scope :for_batch, ->(batch_id) { where(rollover_batch_id: batch_id) }
  scope :for_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :recent, -> { order(rollover_timestamp: :desc) }
end
