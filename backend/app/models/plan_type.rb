# Standard drawing types - unique by name
# e.g., PERSPECTIVE, SITE PLAN, SLAB PLAN, KIT CABINETRY
#
# Many-to-many relationship with PlanCategory:
# - One plan type can belong to multiple categories
# - PERSPECTIVE can be in Contract Drawings, Construction Drawings, Certification Drawings
class PlanType < ApplicationRecord
  has_many :plan_category_plan_types, dependent: :destroy
  has_many :plan_categories, through: :plan_category_plan_types
  has_many :job_plans, dependent: :restrict_with_error

  validates :name, presence: true, uniqueness: true
  validates :code, presence: true, uniqueness: true

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order, :code) }

  # Hardcoded fallback templates (used if no global default set)
  FALLBACK_SHORT_TEMPLATE = "{Code}-{Name}".freeze
  FALLBACK_LONG_TEMPLATE = "{JobCode}-{Code}-{Name}-Rev{Rev}".freeze

  # SystemSetting keys for global defaults
  SETTING_KEY_SHORT = "plan_default_short_name_template".freeze
  SETTING_KEY_LONG = "plan_default_long_name_template".freeze

  # Get the effective default template (global setting or fallback)
  def self.default_short_template
    SystemSetting.get(SETTING_KEY_SHORT) || FALLBACK_SHORT_TEMPLATE
  end

  def self.default_long_template
    SystemSetting.get(SETTING_KEY_LONG) || FALLBACK_LONG_TEMPLATE
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

  # Resolve short name template with given values
  # Priority: plan_type custom > global default > fallback
  # options: code, name, variant
  def resolve_short_name(options = {})
    template = short_name_template.presence || self.class.default_short_template
    resolve_template(template, options)
  end

  # Resolve long name template with given values
  # Priority: plan_type custom > global default > fallback
  # options: job_code, code, name, rev, date, variant
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
    resolve_short_name(code: code, name: name, variant: "a")
  end

  # Preview long name with example values
  def long_name_preview
    resolve_long_name(
      job_code: "EB2401",
      code: code,
      name: name,
      rev: "A",
      date: Date.today.strftime("%Y%m%d"),
      variant: "a"
    )
  end

  private

  # Generic template resolver - replaces {Placeholder} with values
  def resolve_template(template, values)
    return "" if template.blank?

    result = template.dup
    result = result.gsub("{Code}", values[:code]&.to_s || code.to_s)
    result = result.gsub("{Name}", values[:name]&.to_s || name.to_s)
    result = result.gsub("{JobCode}", values[:job_code]&.to_s || "")
    result = result.gsub("{Rev}", values[:rev]&.to_s || "")
    result = result.gsub("{Date}", values[:date]&.to_s || "")
    result = result.gsub("{Variant}", values[:variant]&.to_s || "")
    result.strip
  end
end
