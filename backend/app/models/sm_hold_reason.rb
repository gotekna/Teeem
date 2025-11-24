# frozen_string_literal: true

# SmHoldReason - Configurable dropdown options for job hold reasons
#
# See Trinity Bible Rules 9.21 (SM Gantt - Hold Task System)
# See GANTT_ARCHITECTURE_PLAN.md Section 2.5
#
class SmHoldReason < ApplicationRecord
  # Associations
  has_many :sm_tasks, dependent: :nullify
  has_many :sm_hold_logs, dependent: :nullify

  # Validations
  validates :name, presence: true, uniqueness: true, length: { maximum: 100 }
  validates :color, length: { maximum: 20 }
  validates :icon, length: { maximum: 50 }
  validates :sequence_order, presence: true, numericality: { only_integer: true }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order) }
  scope :for_dropdown, -> { active.ordered.select(:id, :name, :color, :icon) }

  # Default reasons to seed
  DEFAULTS = [
    { name: 'WHS Incident', description: 'Workplace health and safety incident on site', sequence_order: 1 },
    { name: 'Weather', description: 'Adverse weather conditions preventing work', sequence_order: 2 },
    { name: 'Permit Delay', description: 'Waiting for council or building permits', sequence_order: 3 },
    { name: 'Client Request', description: 'Client requested hold on works', sequence_order: 4 },
    { name: 'Material Shortage', description: 'Critical materials unavailable', sequence_order: 5 },
    { name: 'Subcontractor Issue', description: 'Subcontractor unable to proceed', sequence_order: 6 },
    { name: 'Design Change', description: 'Awaiting design changes or approvals', sequence_order: 7 },
    { name: 'Other', description: 'Other reason (specify in release notes)', sequence_order: 8 }
  ].freeze

  # Seed default reasons
  def self.seed_defaults!
    DEFAULTS.each do |attrs|
      find_or_create_by!(name: attrs[:name]) do |reason|
        reason.description = attrs[:description]
        reason.sequence_order = attrs[:sequence_order]
      end
    end
  end
end
