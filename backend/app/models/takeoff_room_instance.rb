# frozen_string_literal: true

# TakeoffRoomInstance - An applied template instance (e.g., "Bathroom 1")
#
# When a user selects a template (e.g., "Bathroom") and applies it,
# a room instance is created with pre-built slots copied from the template steps.
# Each slot represents one measurement to be taken (e.g., "Floor Area", "Wall Tiles").
#
# Belongs to EITHER a JobPlan OR a DocumentInbox (one must be set).
#
class TakeoffRoomInstance < ApplicationRecord
  acts_as_tenant(:tenant)

  # Associations
  belongs_to :tenant
  belongs_to :takeoff_template
  belongs_to :job, optional: true
  belongs_to :job_plan, optional: true
  belongs_to :document_inbox, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  has_many :slots, class_name: "TakeoffRoomSlot", dependent: :destroy

  # Validations
  validates :name, presence: true
  validates :status, presence: true, inclusion: { in: %w[in_progress complete] }
  validate :must_belong_to_plan_or_docsort

  # Scopes
  scope :ordered, -> { order(:display_order) }
  scope :for_job_plan, ->(plan) { where(job_plan: plan) }
  scope :for_document_inbox, ->(item) { where(document_inbox: item) }
  scope :in_progress, -> { where(status: "in_progress") }
  scope :complete, -> { where(status: "complete") }

  # Callbacks
  after_create :create_slots_from_template
  before_validation :set_default_order, on: :create

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # Count of filled vs total slots
  def progress
    total = slots.count
    filled = slots.where(is_filled: true).count
    { filled: filled, total: total }
  end

  # Check if all slots are filled
  def all_filled?
    slots.count > 0 && slots.where(is_filled: false).count == 0
  end

  # Total estimated cost from filled slots with pricebook items
  def total_cost
    slots.where(is_filled: true)
         .where.not(pricebook_item_id: nil)
         .includes(:pricebook_item)
         .sum { |slot| (slot.quantity || 0) * (slot.pricebook_item&.current_price || 0) }
  end

  # Generate a PO from filled slots with pricebook items
  def generate_purchase_order!(job:, tenant:)
    priced_slots = slots.where(is_filled: true)
                        .where.not(pricebook_item_id: nil)
                        .includes(:pricebook_item, :measurement)

    raise "No priced slots to generate PO from" if priced_slots.empty?

    ActiveRecord::Base.transaction do
      # Group by supplier
      grouped = priced_slots.group_by { |s| s.pricebook_item&.preferred_supplier_id }
      created_pos = []

      grouped.each do |supplier_id, group_slots|
        supplier = supplier_id ? Contact.find_by(id: supplier_id) : nil

        po = PurchaseOrder.create!(
          job: job,
          tenant: tenant,
          supplier: supplier,
          status: "draft",
          order_date: Date.current,
          source: "pdf_takeoff",
          notes: "Generated from Room Takeoff - #{name} (#{takeoff_template.name})"
        )

        group_slots.each do |slot|
          po.line_items.create!(
            pricebook_item: slot.pricebook_item,
            description: slot.pricebook_item&.name || slot.label,
            quantity: slot.quantity || 0,
            unit: slot.measurement&.unit || "ea",
            unit_price: slot.pricebook_item&.current_price || 0,
            total_price: (slot.quantity || 0) * (slot.pricebook_item&.current_price || 0),
            notes: "Room: #{name}, Slot: #{slot.label}"
          )

          # Mark measurement as synced
          slot.measurement&.update!(synced_to_po_id: po.id)
        end

        created_pos << po
      end

      created_pos
    end
  end

  # For API responses
  def as_json(options = {})
    prog = progress
    super(options.merge(
      only: [:id, :name, :status, :display_order, :notes, :created_at],
      methods: []
    )).merge(
      template_name: takeoff_template.name,
      template_category: takeoff_template.category,
      filled: prog[:filled],
      total: prog[:total],
      total_cost: total_cost.round(2),
      slots: slots.order(:step_index).map(&:as_json)
    )
  end

  private

  def must_belong_to_plan_or_docsort
    if job_plan_id.blank? && document_inbox_id.blank?
      errors.add(:base, "Must belong to either a job plan or a docsort item")
    end
    if job_plan_id.present? && document_inbox_id.present?
      errors.add(:base, "Cannot belong to both a job plan and a docsort item")
    end
  end

  def set_default_order
    return if display_order.present? && display_order > 0

    scope = if job_plan_id
              self.class.where(job_plan_id: job_plan_id)
            else
              self.class.where(document_inbox_id: document_inbox_id)
            end
    max_order = scope.maximum(:display_order) || -1
    self.display_order = max_order + 1
  end

  # Copy template steps into pre-built slots
  def create_slots_from_template
    takeoff_template.steps.each_with_index do |step, idx|
      slots.create!(
        step_index: idx,
        label: step["label"],
        measurement_type: step["type"],
        color: step["color"],
        prompt: step["prompt"],
        pricebook_item_id: step["pricebook_item_id"]
      )
    end
  end
end
