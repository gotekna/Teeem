# frozen_string_literal: true

# TemplatePackItem - Individual configuration items in a template pack
#
# Each item represents a collection of records for a specific configuration type
# (job types, job statuses, schedule master templates, etc.).
#
# The data field contains a JSON array of the serialized records.
#
class TemplatePackItem < ApplicationRecord
  belongs_to :template_pack

  # =============================================================================
  # Constants
  # =============================================================================

  # Valid item types that can be included in a template pack
  VALID_TYPES = %w[
    job_types
    job_statuses
    job_stages
    contact_types
    document_types
    sm_schedule_master_templates
    public_holidays
    warehouse_folders
  ].freeze

  # =============================================================================
  # Validations
  # =============================================================================
  validates :item_type, presence: true, inclusion: { in: VALID_TYPES }
  validates :data, presence: true

  # =============================================================================
  # Scopes
  # =============================================================================
  scope :ordered, -> { order(:position, :id) }
  scope :of_type, ->(type) { where(item_type: type) }

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # Get the number of records in this item
  def records_count
    data.is_a?(Array) ? data.length : 0
  end

  # Get the model class for this item type
  def model_class
    case item_type
    when "job_types" then JobType
    when "job_statuses" then JobStatus
    when "job_stages" then JobStage
    when "contact_types" then ContactType
    when "document_types" then DocumentType
    when "sm_schedule_master_templates" then SmScheduleMasterTemplate
    when "public_holidays" then PublicHoliday
    when "warehouse_folders" then BaseFolder
    else
      raise ArgumentError, "Unknown item type: #{item_type}"
    end
  end

  # Human-readable name for the item type
  def item_type_name
    case item_type
    when "job_types" then "Job Types"
    when "job_statuses" then "Job Statuses"
    when "job_stages" then "Job Stages"
    when "contact_types" then "Contact Types"
    when "document_types" then "Document Types"
    when "sm_schedule_master_templates" then "Schedule Master Templates"
    when "public_holidays" then "Public Holidays"
    when "warehouse_folders" then "Warehouse Folders"
    else
      item_type.humanize.titleize
    end
  end

  # Get a preview of the data (first few items)
  def preview(limit = 3)
    return [] unless data.is_a?(Array)

    data.first(limit)
  end
end
