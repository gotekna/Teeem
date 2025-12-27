# Recipe - reusable assemblies/packages (like DataBuild's recipes)
#
# SSoT: Recipes are the core estimating unit. They contain line items that can
# reference pricebook items or have standalone pricing. Quantities can be
# fixed or formula-based using quantity variables.
#
# Recipe Types:
# - materials: Only material items
# - labour: Only labour items
# - full_assembly: Complete package with materials + labour + overhead
# - subcontract: Subcontractor package
#
class Recipe < ApplicationRecord
  # Constants
  TYPES = %w[materials labour full_assembly subcontract].freeze
  STATUSES = %w[draft active archived].freeze

  # Associations
  belongs_to :recipe_category, optional: true
  belongs_to :default_supplier, class_name: 'Contact', optional: true
  has_many :recipe_items, -> { order(:sequence_order) }, dependent: :destroy
  has_many :recipe_versions, dependent: :destroy
  has_many :job_recipes, dependent: :destroy
  has_many :jobs, through: :job_recipes

  # Accept nested attributes for items (for bulk create/update)
  accepts_nested_attributes_for :recipe_items, allow_destroy: true

  # Validations
  validates :code, presence: true, uniqueness: true
  validates :name, presence: true
  validates :recipe_type, inclusion: { in: TYPES }
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :active, -> { where(status: 'active') }
  scope :draft, -> { where(status: 'draft') }
  scope :archived, -> { where(status: 'archived') }
  scope :by_type, ->(type) { where(recipe_type: type) }
  scope :search, ->(query) {
    where('name ILIKE :q OR code ILIKE :q OR description ILIKE :q', q: "%#{query}%")
  }

  # Callbacks
  before_save :update_cached_total
  after_save :create_version_if_changed

  # Calculate total from all items
  def calculate_total
    recipe_items.sum(:cached_line_total) || 0
  end

  # Recalculate all item prices and totals
  def recalculate!
    transaction do
      recipe_items.each(&:recalculate!)
      update_cached_total
      save!
    end
  end

  # Duplicate this recipe (for "Save As" functionality)
  def duplicate(new_code: nil, new_name: nil)
    new_recipe = dup
    new_recipe.code = new_code || "#{code}-COPY"
    new_recipe.name = new_name || "#{name} (Copy)"
    new_recipe.status = 'draft'
    new_recipe.version_number = 1
    new_recipe.cached_total_at = nil

    new_recipe.transaction do
      new_recipe.save!
      recipe_items.each do |item|
        new_item = item.dup
        new_item.recipe = new_recipe
        new_item.save!
      end
    end

    new_recipe
  end

  # Calculate quantities for a job using its quantity variables
  def calculate_for_job(job)
    # Get job's quantity variable values
    variable_values = job.quantity_variable_values

    recipe_items.map do |item|
      {
        item: item,
        calculated_quantity: item.calculate_quantity(variable_values),
        unit_price: item.effective_unit_price,
        line_total: item.calculate_line_total(variable_values)
      }
    end
  end

  # Calculate total with given variables and multiplier
  def calculate_with_variables(variables, multiplier = 1.0)
    recipe_items.sum do |item|
      item.calculate_line_total(variables) * multiplier
    end
  end

  # Calculate line items with given variables (for PO generation)
  def calculate_line_items(variables, multiplier = 1.0)
    recipe_items.map do |item|
      quantity = item.calculate_quantity(variables) * multiplier
      unit_price = item.effective_unit_price

      {
        description: item.description,
        quantity: quantity,
        unit_price: unit_price,
        total: quantity * unit_price,
        supplier_id: item.pricebook_item&.default_supplier_id
      }
    end
  end

  # Generate a purchase order from this recipe for a job
  def create_purchase_order_for_job(job, supplier: nil)
    supplier ||= default_supplier

    PurchaseOrder.create_from_recipe(
      job: job,
      recipe: self,
      supplier: supplier
    )
  end

  # Activate recipe (move from draft to active)
  def activate!
    update!(status: 'active')
  end

  # Archive recipe
  def archive!
    update!(status: 'archived')
  end

  # JSON representation
  def as_json(options = {})
    super(options).merge(
      category_name: recipe_category&.name,
      supplier_name: default_supplier&.display_name,
      item_count: recipe_items.size,
      total: cached_total || calculate_total
    )
  end

  private

  def update_cached_total
    self.cached_total = calculate_total
    self.cached_total_at = Time.current
  end

  def create_version_if_changed
    return unless saved_change_to_cached_total? || saved_change_to_name?

    recipe_versions.create!(
      version_number: version_number,
      total_amount: cached_total,
      snapshot_data: recipe_items.map(&:as_snapshot_json),
      change_reason: 'Price update'
    )

    increment!(:version_number)
  end
end
