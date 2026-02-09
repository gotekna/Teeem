# frozen_string_literal: true

class SpecificationTemplate < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable

  belongs_to :job_type, optional: true

  validates :name, presence: true

  scope :active, -> { where(is_active: true) }
  scope :default_templates, -> { where(is_default: true) }

  # Get template for a specific job type, falling back to default
  def self.for_job_type(job_type_id)
    template = where(job_type_id: job_type_id, is_active: true).first
    template || default_templates.active.first
  end

  # Get sections as an array of hashes
  def section_list
    sections || []
  end

  # Get all items across all sections
  def all_items
    section_list.flat_map { |section| section["items"] || [] }
  end
end
