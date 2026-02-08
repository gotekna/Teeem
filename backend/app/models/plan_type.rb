# Standard drawing types - unique by name
# e.g., PERSPECTIVE, SITE PLAN, SLAB PLAN, KIT CABINETRY
#
# Many-to-many relationship with PlanCategory:
# - One plan type can belong to multiple categories
# - PERSPECTIVE can be in Contract Drawings, Construction Drawings, Certification Drawings
class PlanType < ApplicationRecord
  acts_as_tenant :tenant

  has_many :plan_category_plan_types, dependent: :destroy
  has_many :plan_categories, through: :plan_category_plan_types
  has_many :job_plans, dependent: :restrict_with_error

  validates :name, presence: true, uniqueness: { scope: :tenant_id }
  validates :code, presence: true, uniqueness: { scope: :tenant_id }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order, :code) }

  # SSoT: SystemSetting table (configured via Admin > System > Plans)
  SETTING_KEY_SHORT = "plan_default_short_name_template".freeze
  SETTING_KEY_LONG = "plan_default_long_name_template".freeze

  # Get global default template from SystemSetting (SSoT)
  def self.default_short_template
    SystemSetting.get(SETTING_KEY_SHORT) || raise("Missing SystemSetting: #{SETTING_KEY_SHORT}")
  end

  def self.default_long_template
    SystemSetting.get(SETTING_KEY_LONG) || raise("Missing SystemSetting: #{SETTING_KEY_LONG}")
  end

  # Set global default templates
  def self.set_default_short_template(template)
    SystemSetting.set(SETTING_KEY_SHORT, template, description: "Default short name template for plan types")
  end

  def self.set_default_long_template(template)
    SystemSetting.set(SETTING_KEY_LONG, template, description: "Default long name template for plan types (SharePoint filename)")
  end

  # Full display name: "02 - SITE PLAN"
  def display_name
    "#{code} - #{name}"
  end

  # Get category names as comma-separated string
  def category_names
    plan_categories.pluck(:name).join(", ")
  end

  # Resolve short name template for SharePoint filenames
  # Priority: plan_type custom > global default > fallback
  # options: code, name, variant, job_code, etc.
  def resolve_short_name(options = {})
    template = short_name_template.presence || self.class.default_short_template
    resolve_template(template, options)
  end

  # Resolve long name template for Display names (shown in tables/lists)
  # Priority: plan_type custom > global default > fallback
  # options: code, name, variant, job_code, rev, date, etc.
  def resolve_long_name(options = {})
    template = long_name_template.presence || self.class.default_long_template
    resolve_template(template, options)
  end

  # Check if using custom template or global default
  def using_custom_short_template?
    short_name_template.present?
  end

  def using_custom_long_template?
    long_name_template.present?
  end

  # Preview short name with example values
  def short_name_preview
    resolve_short_name(
      code: code,
      name: name,
      description: notes.presence || "#{name} Drawing",
      category: plan_categories.first&.name || "Contract Drawings",
      category_code: plan_categories.first&.code || "ConD",
      variant: "a",
      job_code: "EB2401",
      job_name: "05 Wategors",
      job_address: "Lot 5 Wategois Street Claamvale",
      lot_number: "5",
      street_name: "Wategois Street",
      suburb: "Claamvale",
      project_name: "Wategors Estate"
    )
  end

  # Preview long name with example values
  def long_name_preview
    resolve_long_name(
      job_code: "EB2401",
      job_name: "05 Wategors",
      job_address: "Lot 5 Wategois Street Claamvale",
      lot_number: "5",
      street_name: "Wategois Street",
      suburb: "Claamvale",
      project_name: "Wategors Estate",
      code: code,
      name: name,
      description: notes.presence || "#{name} Drawing",
      category: plan_categories.first&.name || "Contract Drawings",
      category_code: plan_categories.first&.code || "ConD",
      rev: "A",
      date: Date.today.strftime("%Y%m%d"),
      variant: "a"
    )
  end

  private

  # Generic template resolver - replaces {Placeholder} with values
  # Supported placeholders:
  # - Job: {JobCode}, {JobName}, {JobAddress}, {LotNumber}, {StreetName}, {Suburb}, {ProjectName}
  # - Plan type: {Code}, {Name}, {Description}, {Category}, {CategoryCode}
  # - Revision: {Rev}, {Date}, {Variant}
  def resolve_template(template, values)
    return "" if template.blank?

    result = template.dup
    # Job placeholders
    result = result.gsub("{JobCode}", values[:job_code]&.to_s || "")
    result = result.gsub("{JobName}", values[:job_name]&.to_s || "")
    result = result.gsub("{JobAddress}", values[:job_address]&.to_s || "")
    result = result.gsub("{LotNumber}", values[:lot_number]&.to_s || "")
    result = result.gsub("{StreetName}", values[:street_name]&.to_s || "")
    result = result.gsub("{Suburb}", values[:suburb]&.to_s || "")
    result = result.gsub("{ProjectName}", values[:project_name]&.to_s || "")
    # Plan type placeholders
    result = result.gsub("{Code}", values[:code]&.to_s || code.to_s)
    result = result.gsub("{Name}", values[:name]&.to_s || name.to_s)
    result = result.gsub("{Description}", values[:description]&.to_s || "")
    result = result.gsub("{Category}", values[:category]&.to_s || "")
    result = result.gsub("{CategoryCode}", values[:category_code]&.to_s || "")
    # Revision placeholders
    result = result.gsub("{Rev}", values[:rev]&.to_s || "")
    result = result.gsub("{Date}", values[:date]&.to_s || "")
    result = result.gsub("{Variant}", values[:variant]&.to_s || "")
    result.strip
  end
end
