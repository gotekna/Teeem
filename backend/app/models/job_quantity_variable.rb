# JobQuantityVariable - per-job values for each quantity variable
#
# SSoT: This is where each job stores its specific house spec values.
# These values are used when calculating recipe quantities for the job.
#
class JobQuantityVariable < ApplicationRecord
  # Associations
  belongs_to :job
  belongs_to :quantity_variable
  belongs_to :updated_by, class_name: 'User', optional: true

  # Validations
  validates :quantity_variable_id, uniqueness: { scope: :job_id }
  validate :validate_value

  # Scopes
  scope :by_category, ->(cat) {
    joins(:quantity_variable).where(quantity_variables: { category: cat })
  }

  # Get typed value
  def typed_value
    quantity_variable.type_value(value)
  end

  # JSON representation
  def as_json(options = {})
    {
      id: id,
      variable_name: quantity_variable.variable_name,
      display_name: quantity_variable.display_name,
      category: quantity_variable.category,
      data_type: quantity_variable.data_type,
      unit_label: quantity_variable.unit_label,
      value: typed_value,
      select_options: quantity_variable.select_options,
      updated_at: updated_at,
      updated_by_name: updated_by&.full_name
    }
  end

  private

  def validate_value
    return if value.blank?

    unless quantity_variable.valid_value?(value)
      errors.add(:value, 'is not valid for this variable')
    end
  end
end
