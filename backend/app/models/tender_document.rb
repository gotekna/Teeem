# frozen_string_literal: true

# TenderDocument - A versioned tender for a job, created from POs grouped by tender sections.
#
# Version control flow:
#   draft → locked (POs locked) → sent → accepted | declined | revision_requested
#   When revision_requested: current becomes "superseded", POs unlocked, new version created
#
# Snapshotted data: job info, client info, line items, and totals are frozen at creation.
# This ensures the tender document is a point-in-time record that doesn't change
# when underlying POs are modified.
#
class TenderDocument < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :job
  belongs_to :created_by, class_name: "User"
  belongs_to :locked_by, class_name: "User", optional: true
  belongs_to :previous_version, class_name: "TenderDocument", optional: true
  belongs_to :pdf_generation, optional: true
  belongs_to :storage_blob, optional: true

  has_many :tender_document_items, dependent: :destroy
  has_one :next_version, class_name: "TenderDocument", foreign_key: :previous_version_id

  # Statuses
  STATUSES = %w[draft locked sent revision_requested accepted declined superseded].freeze

  # Validations
  validates :document_number, presence: true, uniqueness: { scope: :tenant_id }
  validates :version, presence: true, numericality: { greater_than: 0 }
  validates :status, inclusion: { in: STATUSES }
  validates :date_prepared, presence: true

  # Scopes
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :current_versions, -> { where.not(status: "superseded") }
  scope :latest_first, -> { order(version: :desc) }

  # Callbacks
  after_create :assign_document_number

  # === VERSION CONTROL ===

  def lock_pos!(user)
    transaction do
      job.purchase_orders.each { |po| po.lock_budget!(user) unless po.budget_locked? }
      update!(locked_at: Time.current, locked_by: user, status: "locked")
    end
  end

  def mark_sent!(user = nil)
    update!(status: "sent", sent_at: Time.current)
  end

  def mark_accepted!
    update!(status: "accepted", accepted_at: Time.current)
  end

  def mark_declined!
    update!(status: "declined", declined_at: Time.current)
  end

  def request_revision!(user, reason:)
    transaction do
      update!(status: "superseded", revision_notes: reason)
      # Unlock POs so they can be modified
      job.purchase_orders.budget_locked.each do |po|
        po.unlock_budget!(user, reason: "Tender revision: #{reason}")
      end
    end
  end

  # === QUERY HELPERS ===

  def sections_grouped
    tender_document_items
      .order(:section_sort_order, Arel.sql("COALESCE(cost_centre_name, '')"), :line_number)
      .group_by(&:tender_section_name)
  end

  # Two-level grouping: header → section → items (ordered by cost centre then line number)
  # Returns: { "Site Costs" => { "Site Preparation" => [items], "Flood" => [note_item] } }
  def sections_grouped_by_header
    items = tender_document_items.order(:header_sort_order, :section_sort_order, Arel.sql("COALESCE(cost_centre_name, '')"), :line_number)
    result = {}

    items.each do |item|
      header_name = item.tender_header_name || "Other"
      section_name = item.tender_section_name

      result[header_name] ||= {}
      result[header_name][section_name] ||= []
      result[header_name][section_name] << item
    end

    result
  end

  def section_subtotals
    tender_document_items
      .where(item_type: %w[priced provisional])
      .group(:tender_section_name)
      .sum(:total_amount)
  end

  # Header-level subtotals (sum of all priced + provisional items under each header)
  def header_subtotals
    tender_document_items
      .where(item_type: %w[priced provisional])
      .group(:tender_header_name)
      .sum(:total_amount)
  end

  def current?
    status != "superseded"
  end

  def editable?
    status == "draft"
  end

  def builder_state
    settings&.dig("builder_state")
  end

  def changelog
    settings&.dig("changelog")
  end

  def has_changelog?
    changelog.present?
  end

  def as_json(options = {})
    super(options).merge(
      "items" => tender_document_items.order(:header_sort_order, :section_sort_order, Arel.sql("COALESCE(cost_centre_name, '')"), :line_number).as_json,
      "sections_grouped" => sections_grouped.transform_values { |items| items.map(&:as_json) },
      "sections_grouped_by_header" => sections_grouped_by_header.transform_values { |sections|
        sections.transform_values { |items| items.map(&:as_json) }
      },
      "section_subtotals" => section_subtotals.transform_keys(&:to_s),
      "header_subtotals" => header_subtotals.transform_keys(&:to_s),
      "base_price" => tender_document_items.where(item_type: "included", excluded: false).count,
      "pc_total" => tender_document_items.where(item_type: "priced", excluded: false).sum(:total_amount),
      "ps_total" => tender_document_items.where(item_type: "provisional", excluded: false).sum(:total_amount),
      "created_by_name" => created_by&.name,
      "locked_by_name" => locked_by&.name,
      "company_name" => tenant&.name,
      "pdf_download_url" => pdf_generation&.download_url,
      # Tender detail snapshots
      "council" => council,
      "estate" => estate,
      "facade" => facade,
      "design_name" => design_name,
      "specification" => specification,
      "developer_approval" => developer_approval,
      "developer_contact" => developer_contact,
      "land_registration" => land_registration,
      "building_contract_type" => building_contract_type,
      "development_application" => development_application,
      "sales_centre" => sales_centre,
      "wind_classification" => wind_classification,
      "soil_classification" => soil_classification,
      "lot_address" => lot_address,
      "plan_number" => plan_number,
      "changelog" => changelog,
      "has_changelog" => has_changelog?
    )
  end

  private

  def assign_document_number
    return unless document_number&.start_with?("TD-TEMP")

    update_column(:document_number, "TD-#{id.to_s.rjust(6, '0')}")
  end
end
