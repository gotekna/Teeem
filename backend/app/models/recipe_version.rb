# RecipeVersion - track price history snapshots for recipes
#
# SSoT: Versions capture the state of a recipe at a point in time,
# enabling price tracking and audit trails.
#
class RecipeVersion < ApplicationRecord
  # Associations
  belongs_to :recipe
  belongs_to :created_by, class_name: 'User', optional: true

  # Validations
  validates :version_number, presence: true,
            uniqueness: { scope: :recipe_id }
  validates :total_amount, presence: true

  # Scopes
  scope :ordered, -> { order(version_number: :desc) }
  scope :recent, -> { order(created_at: :desc).limit(10) }

  # JSON representation
  def as_json(options = {})
    super(options).merge(
      created_by_name: created_by&.full_name,
      item_count: snapshot_data&.size || 0
    )
  end

  # Restore recipe to this version's state
  def restore!
    return unless snapshot_data.present?

    recipe.transaction do
      # Clear existing items
      recipe.recipe_items.destroy_all

      # Recreate items from snapshot
      snapshot_data.each do |item_data|
        recipe.recipe_items.create!(
          description: item_data['description'],
          pricebook_item_id: item_data['pricebook_item_id'],
          unit_of_measure: item_data['unit_of_measure'],
          cost_type: item_data['cost_type'],
          base_quantity: item_data['base_quantity'],
          quantity_formula: item_data['quantity_formula'],
          uses_formula: item_data['uses_formula'],
          unit_price_override: item_data['unit_price'],
          use_pricebook_price: false, # Use snapshot price, not current pricebook
          sequence_order: item_data['sequence_order']
        )
      end

      recipe.recalculate!
    end
  end
end
