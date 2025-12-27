# RecipeItem - line items within a recipe
#
# SSoT: Recipe items can either reference a pricebook item (for synchronized pricing)
# or have standalone pricing. Quantities can be fixed or formula-based.
#
# Formula Syntax (using Dentaku gem):
# - Basic: floor_area * 1.1
# - Conditional: IF(roof_type == "tile", roof_area * 12, roof_area * 8)
# - Functions: ROUNDUP(floor_area / 36, 0)
# - Min/Max: MAX(bedroom_count * 2, 6)
#
class RecipeItem < ApplicationRecord
  # Constants
  COST_TYPES = %w[materials labour overhead subcontract].freeze

  # Associations
  belongs_to :recipe
  belongs_to :pricebook_item, optional: true

  # Validations
  validates :description, presence: true
  validates :cost_type, inclusion: { in: COST_TYPES }
  validates :base_quantity, presence: true, unless: :uses_formula?
  validates :quantity_formula, presence: true, if: :uses_formula?
  validate :validate_formula_syntax, if: :uses_formula?

  # Scopes
  scope :ordered, -> { order(:sequence_order) }
  scope :by_cost_type, ->(type) { where(cost_type: type) }

  # Callbacks
  before_save :sync_from_pricebook
  before_save :recalculate_cached_values

  # Get effective unit price (pricebook or override)
  def effective_unit_price
    if use_pricebook_price && pricebook_item
      pricebook_item.current_price || 0
    else
      unit_price_override || 0
    end
  end

  # Calculate quantity using formula or base quantity
  def calculate_quantity(variable_values = {})
    if uses_formula? && quantity_formula.present?
      evaluate_formula(quantity_formula, variable_values)
    else
      base_quantity || 0
    end
  end

  # Calculate line total
  def calculate_line_total(variable_values = {})
    qty = calculate_quantity(variable_values)
    price = effective_unit_price
    qty * price
  end

  # Recalculate cached values
  def recalculate!
    recalculate_cached_values
    save!
  end

  # Snapshot for version history
  def as_snapshot_json
    {
      id: id,
      description: description,
      pricebook_item_id: pricebook_item_id,
      pricebook_item_code: pricebook_item&.item_code,
      unit_of_measure: unit_of_measure,
      cost_type: cost_type,
      base_quantity: base_quantity,
      quantity_formula: quantity_formula,
      uses_formula: uses_formula,
      unit_price: effective_unit_price,
      line_total: cached_line_total,
      sequence_order: sequence_order
    }
  end

  # JSON representation
  def as_json(options = {})
    super(options).merge(
      pricebook_item_code: pricebook_item&.item_code,
      pricebook_item_name: pricebook_item&.item_name,
      effective_unit_price: effective_unit_price,
      calculated_quantity: base_quantity # Will be overridden when calculated with variables
    )
  end

  private

  def sync_from_pricebook
    return unless pricebook_item && use_pricebook_price

    # Sync description and unit if not overridden
    self.description = pricebook_item.item_name if description.blank?
    self.unit_of_measure = pricebook_item.unit_of_measure if unit_of_measure.blank?
  end

  def recalculate_cached_values
    self.cached_unit_price = effective_unit_price
    self.cached_line_total = (base_quantity || 0) * cached_unit_price
  end

  def evaluate_formula(formula, variable_values)
    return 0 if formula.blank?

    # Use Dentaku for safe formula evaluation (already in project)
    calculator = Dentaku::Calculator.new

    # Sanitize variable names (replace {var} with var)
    sanitized = formula.gsub(/\{(\w+)\}/, '\1')

    begin
      result = calculator.evaluate(sanitized, variable_values)
      result.is_a?(Numeric) ? result : 0
    rescue Dentaku::ParseError, Dentaku::UnboundVariableError => e
      Rails.logger.warn "[RecipeItem] Formula evaluation failed: #{e.message}"
      0
    end
  end

  def validate_formula_syntax
    return if quantity_formula.blank?

    calculator = Dentaku::Calculator.new
    sanitized = quantity_formula.gsub(/\{(\w+)\}/, '\1')

    # Extract variable names for validation
    variables = sanitized.scan(/\b[a-z_][a-z0-9_]*\b/i)
    test_values = variables.index_with { 1 }

    begin
      calculator.evaluate(sanitized, test_values)
    rescue Dentaku::ParseError => e
      errors.add(:quantity_formula, "has invalid syntax: #{e.message}")
    rescue Dentaku::UnboundVariableError
      # This is OK - we're just testing syntax, not all variables
    end
  end
end
