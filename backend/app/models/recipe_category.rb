# RecipeCategory - hierarchical organization of recipes (like DataBuild's tree structure)
#
# SSoT: Recipe categories organize recipes into a familiar tree structure
# that mirrors what DataBuild users expect, while enabling modern features
# like drag-drop reordering and keyboard navigation.
#
class RecipeCategory < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable
  self.sync_key_source = :code

  # Self-referential for hierarchy
  belongs_to :parent, class_name: 'RecipeCategory', optional: true
  has_many :children, class_name: 'RecipeCategory', foreign_key: :parent_id, dependent: :nullify
  has_many :recipes, dependent: :nullify

  # Validations
  validates :code, presence: true, uniqueness: { scope: :tenant_id }
  validates :name, presence: true

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :root, -> { where(parent_id: nil) }
  scope :ordered, -> { order(:position, :name) }

  # Get all ancestors (for breadcrumb display)
  def ancestors
    result = []
    current = parent
    while current
      result.unshift(current)
      current = current.parent
    end
    result
  end

  # Get full path (for display)
  def full_path
    (ancestors.map(&:name) + [name]).join(' → ')
  end

  # Get all descendant IDs (for filtering recipes)
  def descendant_ids
    ids = [id]
    children.each do |child|
      ids.concat(child.descendant_ids)
    end
    ids
  end

  # Nested JSON for tree display
  def as_tree_json
    {
      id: id,
      code: code,
      name: name,
      position: position,
      recipe_count: recipes.count,
      children: children.active.ordered.map(&:as_tree_json)
    }
  end

  # Class method to get full tree
  def self.tree
    root.active.ordered.includes(children: { children: :children }).map(&:as_tree_json)
  end
end
