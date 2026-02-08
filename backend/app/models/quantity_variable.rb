# QuantityVariable - master list of house spec variables (like DataBuild's quantity generator)
#
# SSoT: These are the standard variables that can be used in recipe formulas.
# Each job can have its own values for these variables.
#
# Categories:
# - dimensions: Physical measurements (floor_area, roof_area, etc.)
# - counts: Discrete counts (bedrooms, bathrooms, windows, etc.)
# - specifications: Options (roof_type, cladding, etc.)
# - computed: Calculated from other variables (wall_area = perimeter * height)
#
class QuantityVariable < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable
  self.sync_key_source = :variable_name

  # Constants
  CATEGORIES = %w[dimensions counts specifications computed].freeze
  DATA_TYPES = %w[number text select].freeze

  # Associations
  has_many :job_quantity_variables, dependent: :destroy

  # Validations
  validates :variable_name, presence: true, uniqueness: { scope: :tenant_id },
            format: { with: /\A[a-z][a-z0-9_]*\z/, message: 'must be snake_case' }
  validates :display_name, presence: true
  validates :category, presence: true, inclusion: { in: CATEGORIES }
  validates :data_type, inclusion: { in: DATA_TYPES }
  validates :formula, presence: true, if: :is_computed?
  validate :validate_min_max
  validate :validate_formula_syntax, if: :is_computed?

  # Scopes
  scope :by_category, ->(cat) { where(category: cat) }
  scope :required_for_po, -> { where(required_for_po_generation: true) }
  scope :ordered, -> { order(:category, :position, :display_name) }
  scope :system_vars, -> { where(is_system_variable: true) }
  scope :custom_vars, -> { where(is_system_variable: false) }

  # Get value for a job (typed based on data_type)
  def value_for_job(job)
    jqv = job_quantity_variables.find_by(job: job)
    return typed_default if jqv.nil?

    type_value(jqv.value)
  end

  # Get typed default value
  def typed_default
    type_value(default_value)
  end

  # Type a string value based on data_type
  def type_value(value)
    return nil if value.nil?

    case data_type
    when 'number'
      value.to_f
    when 'select', 'text'
      value.to_s
    else
      value
    end
  end

  # Validate a value against constraints
  def valid_value?(value)
    typed = type_value(value)

    case data_type
    when 'number'
      return false if min_value && typed < min_value
      return false if max_value && typed > max_value
    when 'select'
      return false if select_options.present? && !select_options.include?(typed)
    end

    true
  end

  # Calculate computed value from other variables
  def calculate(all_values)
    return type_value(all_values[variable_name]) unless is_computed?
    return nil unless formula.present?

    calculator = Dentaku::Calculator.new
    begin
      result = calculator.evaluate(formula, all_values)
      result.is_a?(Numeric) ? result : nil
    rescue Dentaku::ParseError, Dentaku::UnboundVariableError => e
      Rails.logger.warn "[QuantityVariable] Calculation failed for #{variable_name}: #{e.message}"
      nil
    end
  end

  # JSON representation
  def as_json(options = {})
    super(options).merge(
      select_options: select_options || []
    )
  end

  # Seed standard variables
  def self.seed_standard_variables!
    STANDARD_VARIABLES.each do |attrs|
      find_or_create_by!(variable_name: attrs[:variable_name]) do |v|
        v.assign_attributes(attrs.merge(is_system_variable: true))
      end
    end
  end

  # Standard variables for house construction
  STANDARD_VARIABLES = [
    # Dimensions
    { variable_name: 'floor_area', display_name: 'Floor Area', category: 'dimensions',
      data_type: 'number', unit_label: 'm²', min_value: 50, max_value: 1000, default_value: 180,
      position: 1, description: 'Total floor area of the building' },
    { variable_name: 'roof_area', display_name: 'Roof Area', category: 'dimensions',
      data_type: 'number', unit_label: 'm²', min_value: 50, max_value: 1200, default_value: 200,
      position: 2, description: 'Total roof area including overhangs' },
    { variable_name: 'wall_perimeter', display_name: 'Wall Perimeter', category: 'dimensions',
      data_type: 'number', unit_label: 'm', min_value: 20, max_value: 200, default_value: 52,
      position: 3, description: 'External wall perimeter' },
    { variable_name: 'ceiling_height', display_name: 'Ceiling Height', category: 'dimensions',
      data_type: 'number', unit_label: 'm', min_value: 2.4, max_value: 4.0, default_value: 2.7,
      position: 4, description: 'Standard ceiling height' },

    # Counts
    { variable_name: 'bedroom_count', display_name: 'Bedrooms', category: 'counts',
      data_type: 'number', unit_label: 'rooms', min_value: 1, max_value: 10, default_value: 4,
      position: 10, description: 'Number of bedrooms' },
    { variable_name: 'bathroom_count', display_name: 'Bathrooms', category: 'counts',
      data_type: 'number', unit_label: 'rooms', min_value: 1, max_value: 6, default_value: 2,
      position: 11, description: 'Number of bathrooms' },
    { variable_name: 'living_area_count', display_name: 'Living Areas', category: 'counts',
      data_type: 'number', unit_label: 'rooms', min_value: 1, max_value: 5, default_value: 2,
      position: 12, description: 'Number of living areas' },
    { variable_name: 'garage_spaces', display_name: 'Garage Spaces', category: 'counts',
      data_type: 'number', unit_label: 'spaces', min_value: 0, max_value: 4, default_value: 2,
      position: 13, description: 'Number of garage spaces' },
    { variable_name: 'window_count', display_name: 'Windows', category: 'counts',
      data_type: 'number', unit_label: 'ea', min_value: 4, max_value: 50, default_value: 12,
      position: 14, description: 'Number of windows' },
    { variable_name: 'door_count_internal', display_name: 'Internal Doors', category: 'counts',
      data_type: 'number', unit_label: 'ea', min_value: 2, max_value: 30, default_value: 8,
      position: 15, description: 'Number of internal doors' },
    { variable_name: 'door_count_external', display_name: 'External Doors', category: 'counts',
      data_type: 'number', unit_label: 'ea', min_value: 1, max_value: 10, default_value: 3,
      position: 16, description: 'Number of external doors' },
    { variable_name: 'powerpoint_count', display_name: 'Power Points', category: 'counts',
      data_type: 'number', unit_label: 'ea', min_value: 10, max_value: 100, default_value: 30,
      position: 17, description: 'Number of power points' },

    # Specifications
    { variable_name: 'roof_type', display_name: 'Roof Type', category: 'specifications',
      data_type: 'select', select_options: %w[tile colorbond concrete], default_value: 'colorbond',
      position: 20, description: 'Type of roofing material' },
    { variable_name: 'cladding_type', display_name: 'Cladding', category: 'specifications',
      data_type: 'select', select_options: %w[brick render weatherboard timber], default_value: 'brick',
      position: 21, description: 'External cladding material' },
    { variable_name: 'storeys', display_name: 'Storeys', category: 'specifications',
      data_type: 'select', select_options: %w[1 2 3], default_value: '1',
      position: 22, description: 'Number of storeys' },
    { variable_name: 'floor_type', display_name: 'Floor Type', category: 'specifications',
      data_type: 'select', select_options: %w[slab suspended stumps], default_value: 'slab',
      position: 23, description: 'Type of floor construction' },

    # Computed
    { variable_name: 'wall_area', display_name: 'Wall Area', category: 'computed',
      data_type: 'number', unit_label: 'm²', is_computed: true,
      formula: 'wall_perimeter * ceiling_height',
      position: 30, description: 'Total external wall area (calculated)' }
  ].freeze

  private

  def validate_min_max
    return unless min_value && max_value

    if min_value > max_value
      errors.add(:min_value, 'must be less than max value')
    end
  end

  def validate_formula_syntax
    return if formula.blank?

    calculator = Dentaku::Calculator.new
    # Use dummy values for all potential variables
    test_values = STANDARD_VARIABLES.to_h { |v| [v[:variable_name], 1] }

    begin
      calculator.evaluate(formula, test_values)
    rescue Dentaku::ParseError => e
      errors.add(:formula, "has invalid syntax: #{e.message}")
    rescue Dentaku::UnboundVariableError
      # This is OK during validation
    end
  end
end
