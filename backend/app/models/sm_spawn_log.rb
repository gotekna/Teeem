# frozen_string_literal: true

# SmSpawnLog - Tracks task spawning history
#
# See GANTT_ARCHITECTURE_PLAN.md Section 2.4
#
class SmSpawnLog < ApplicationRecord
  SPAWN_TYPES = %w[photo scan office inspection_retry].freeze
  SPAWN_TRIGGERS = %w[parent_complete inspection_fail].freeze

  belongs_to :parent_task, class_name: 'SmTask'
  belongs_to :spawned_task, class_name: 'SmTask'
  belongs_to :spawned_by, class_name: 'User', optional: true

  validates :spawn_type, presence: true, inclusion: { in: SPAWN_TYPES }
  validates :spawn_trigger, presence: true, inclusion: { in: SPAWN_TRIGGERS }

  scope :by_type, ->(type) { where(spawn_type: type) }
  scope :recent, -> { order(spawned_at: :desc) }
end
