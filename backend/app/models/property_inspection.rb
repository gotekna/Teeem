class PropertyInspection < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy, optional: true
  belongs_to :inspector_contact, class_name: "Contact", optional: true

  # Signature and report blobs
  belongs_to :inspector_signature_blob, class_name: "StorageBlob", optional: true
  belongs_to :tenant_signature_blob, class_name: "StorageBlob", optional: true
  belongs_to :report_blob, class_name: "StorageBlob", optional: true

  has_many :inspection_rooms, -> { order(:sort_order) }, dependent: :destroy
  has_many :inspection_items, through: :inspection_rooms

  # Types and statuses
  INSPECTION_TYPES = %w[entry routine exit maintenance sda_compliance].freeze
  STATUSES = %w[scheduled in_progress completed overdue].freeze
  CONDITIONS = %w[new good fair poor damaged].freeze

  validates :inspection_type, presence: true, inclusion: { in: INSPECTION_TYPES }
  validates :scheduled_date, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :overall_condition, inclusion: { in: CONDITIONS, allow_nil: true }
  validates :inspection_number, uniqueness: { scope: :tenant_id, allow_nil: true }

  before_create :generate_inspection_number
  before_create :generate_access_token

  # Scopes
  scope :upcoming, -> { where(status: "scheduled").where("scheduled_date >= ?", Date.current).order(scheduled_date: :asc) }
  scope :overdue, -> { where(status: %w[scheduled in_progress]).where("scheduled_date < ?", Date.current) }
  scope :completed, -> { where(status: "completed") }
  scope :by_type, ->(type) { where(inspection_type: type) }
  scope :with_rooms, -> { includes(inspection_rooms: { inspection_items: :inspection_photos }) }

  def overdue?
    %w[scheduled in_progress].include?(status) && scheduled_date < Date.current
  end

  def completed?
    status == "completed"
  end

  def start!
    update!(
      status: "in_progress",
      started_at: Time.current
    )
  end

  def complete!(condition: nil)
    update!(
      status: "completed",
      completed_at: Time.current,
      completed_date: Date.current,
      overall_condition: condition || calculate_overall_condition
    )
  end

  def completion_percentage
    rooms = inspection_rooms.includes(:inspection_items)
    return 0 if rooms.empty?

    total_items = rooms.sum { |r| r.inspection_items.size }
    return 0 if total_items == 0

    checked_items = rooms.sum { |r| r.inspection_items.count { |i| i.condition.present? } }
    (checked_items.to_f / total_items * 100).round
  end

  def action_items_count
    inspection_items.where(action_required: true).count
  end

  def create_rooms_from_template!(template)
    template.rooms.each_with_index do |room_data, room_index|
      room = inspection_rooms.create!(
        tenant_id: tenant_id,
        name: room_data["name"],
        room_type: room_data["room_type"] || "other",
        sort_order: room_index
      )

      (room_data["items"] || []).each_with_index do |item_data, item_index|
        room.inspection_items.create!(
          tenant_id: tenant_id,
          name: item_data["name"],
          sort_order: item_index
        )
      end
    end
  end

  def populate_entry_conditions_from(entry_inspection)
    return unless inspection_type == "exit" && entry_inspection.present?

    inspection_rooms.includes(:inspection_items).each do |room|
      entry_room = entry_inspection.inspection_rooms.find_by(name: room.name)
      next unless entry_room

      room.inspection_items.each do |item|
        entry_item = entry_room.inspection_items.find_by(name: item.name)
        next unless entry_item

        item.update_column(:entry_condition, entry_item.condition)
      end
    end
  end

  def token_valid?
    access_token.present? && (access_token_expires_at.nil? || access_token_expires_at > Time.current)
  end

  def generate_portal_link!
    generate_access_token
    self.access_token_expires_at = 90.days.from_now
    save!
    access_token
  end

  def has_report?
    report_blob_id.present?
  end

  def signed_by_inspector?
    inspector_signature_blob_id.present?
  end

  def signed_by_tenant?
    tenant_signature_blob_id.present?
  end

  def degraded_items
    inspection_items.select(&:condition_degraded?)
  end

  private

  def generate_inspection_number
    return if inspection_number.present?

    date_part = Date.current.strftime("%Y%m%d")
    last_number = PropertyInspection
      .where(tenant_id: tenant_id)
      .where("inspection_number LIKE ?", "PI-#{date_part}-%")
      .order(inspection_number: :desc)
      .limit(1)
      .pluck(:inspection_number)
      .first

    sequence = if last_number
      last_number.split("-").last.to_i + 1
    else
      1
    end

    self.inspection_number = "PI-#{date_part}-#{sequence.to_s.rjust(3, '0')}"
  end

  def generate_access_token
    self.access_token = SecureRandom.urlsafe_base64(32)
    self.access_token_expires_at = 90.days.from_now
  end

  def calculate_overall_condition
    conditions = inspection_items.where.not(condition: nil).pluck(:condition)
    return nil if conditions.empty?

    worst_index = conditions.map { |c| CONDITIONS.index(c) }.max
    CONDITIONS[worst_index]
  end
end
