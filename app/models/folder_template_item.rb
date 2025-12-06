class FolderTemplateItem < ApplicationRecord
  belongs_to :folder_template
  belongs_to :parent, class_name: "FolderTemplateItem", optional: true
  has_many :children, class_name: "FolderTemplateItem", foreign_key: :parent_id, dependent: :destroy

  validates :name, presence: true
  validates :level, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :order, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :root_items, -> { where(parent_id: nil) }
  scope :ordered, -> { order(:order) }

  # Get the full path of this folder
  def full_path
    path_parts = [ name ]
    current = parent
    while current
      path_parts.unshift(current.name)
      current = current.parent
    end
    path_parts.join("/")
  end

  # Return this item and its children as nested JSON
  def as_nested_json
    {
      id: id,
      name: name,
      level: level,
      order: order,
      description: description,
      parent_id: parent_id,
      children: children.ordered.map(&:as_nested_json)
    }
  end

  # Resolve variables in folder name
  def resolve_variables(data = {})
    resolved_name = name.dup

    # Replace {variable_name} with actual values from data hash
    resolved_name.gsub!(/\{(\w+)\}/) do |match|
      variable_name = $1
      data[variable_name.to_sym] || data[variable_name] || match
    end

    resolved_name
  end
end
