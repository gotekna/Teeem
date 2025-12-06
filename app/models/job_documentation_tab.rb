class JobDocumentationTab < ApplicationRecord
  belongs_to :job
  belongs_to :parent, class_name: "JobDocumentationTab", optional: true
  has_many :children, class_name: "JobDocumentationTab", foreign_key: :parent_id, dependent: :destroy

  validates :name, presence: true, uniqueness: { scope: [ :job_id, :parent_id ] }
  validates :sequence_order, presence: true

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order) }
  scope :root_tabs, -> { where(parent_id: nil) }

  # Returns nested structure for API
  def as_nested_json
    {
      id: id,
      name: name,
      icon: icon,
      color: color,
      description: description,
      sequence_order: sequence_order,
      is_active: is_active,
      folder_path: folder_path,
      children: children.ordered.map(&:as_nested_json)
    }
  end
end
