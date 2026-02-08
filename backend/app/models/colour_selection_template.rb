# frozen_string_literal: true

class ColourSelectionTemplate < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :job_type, optional: true

  validates :name, presence: true

  scope :active, -> { where(is_active: true) }
  scope :default_templates, -> { where(is_default: true) }

  # Get template for a specific job type, falling back to default
  def self.for_job_type(job_type_id)
    template = where(job_type_id: job_type_id, is_active: true).first
    template || default_templates.active.first
  end

  # Get categories as an array of hashes
  def category_list
    categories || []
  end

  # Get all items across all categories
  def all_items
    category_list.flat_map { |category| category["items"] || [] }
  end
end
