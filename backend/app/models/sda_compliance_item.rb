class SdaComplianceItem < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :certificate_blob, class_name: "StorageBlob", optional: true

  CATEGORIES = %w[fire_safety accessibility electrical plumbing structural general].freeze

  ITEM_TYPES = %w[
    smoke_alarm fire_extinguisher sprinkler_system emergency_light exit_sign fire_blanket
    ceiling_hoist ramp handrail adjustable_bench door_automation intercom duress_alarm
    rcd_switch hot_water_tempering backflow_valve pest_control pool_fence termite_inspection
  ].freeze

  STATUSES = %w[compliant due_soon overdue non_compliant not_applicable].freeze

  validates :category, presence: true, inclusion: { in: CATEGORIES }
  validates :item_type, presence: true, inclusion: { in: ITEM_TYPES }
  validates :item_name, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :due_soon, -> { where(status: "due_soon") }
  scope :overdue, -> { where(status: "overdue") }
  scope :by_category, ->(cat) { where(category: cat) }
  scope :fire_safety, -> { by_category("fire_safety") }

  def due_soon?(days: 30)
    return false unless next_service_date
    next_service_date <= days.days.from_now && next_service_date >= Date.current
  end

  def overdue?
    return false unless next_service_date
    next_service_date < Date.current
  end

  def update_status!
    new_status = if next_service_date.nil?
                   status
                 elsif next_service_date < Date.current
                   "overdue"
                 elsif next_service_date <= 30.days.from_now
                   "due_soon"
                 else
                   "compliant"
                 end
    update!(status: new_status) if new_status != status
  end
end
