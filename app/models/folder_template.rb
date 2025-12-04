class FolderTemplate < ApplicationRecord
  belongs_to :created_by, class_name: 'User', optional: true
  has_many :folder_template_items, dependent: :destroy

  validates :name, presence: true
  validates :template_type, inclusion: { in: %w[residential commercial renovation custom], allow_nil: true }

  scope :default_templates, -> { where(is_system_default: true) }
  scope :user_templates, -> { where(is_system_default: false) }
  scope :active, -> { where(is_active: true) }
  scope :visible_to_user, ->(user) {
    # For now, show all templates to all users
    # TODO: Implement role-based permissions
    all
  }
  scope :editable_by_user, ->(user) {
    # For now, users can edit their own templates only
    # TODO: Implement admin role that can edit all
    where(created_by_id: user&.id)
  }

  # Accept nested attributes for folder items
  accepts_nested_attributes_for :folder_template_items, allow_destroy: true

  # Get the folder hierarchy as nested hash
  def folder_hierarchy
    root_items = folder_template_items.where(parent_id: nil).order(:order)
    root_items.map { |item| item.as_nested_json }
  end

  # Duplicate template for a user
  def duplicate_for_user(user, new_name)
    new_template = dup
    new_template.name = new_name
    new_template.created_by = user
    new_template.is_system_default = false

    ActiveRecord::Base.transaction do
      new_template.save!

      # Copy folder structure with proper parent references
      old_to_new_id_map = {}

      folder_template_items.order(:level, :order).each do |item|
        new_item = new_template.folder_template_items.create!(
          name: item.name,
          level: item.level,
          order: item.order,
          description: item.description,
          parent_id: item.parent_id ? old_to_new_id_map[item.parent_id] : nil
        )
        old_to_new_id_map[item.id] = new_item.id
      end
    end

    new_template
  end

  # Check if user can edit this template
  def can_edit?(user)
    return false unless user
    # Admins can edit all templates including system defaults
    return true if user.admin?
    # Regular users can only edit their own non-system templates
    !is_system_default && created_by_id == user.id
  end

  # Seed default templates
  def self.seed_defaults
    return if exists?(is_system_default: true)

    create_tekna_residential_template
  end

  def self.create_tekna_residential_template
    template = create!(
      name: "Std Job Default Folders",
      template_type: "residential",
      is_system_default: true,
      is_active: true
    )

    # Load from JSON file
    json_path = Rails.root.join('..', 'docs', 'folder-templates', 'tekna-residential-template.json')
    if File.exist?(json_path)
      template_data = JSON.parse(File.read(json_path))
      create_folders_from_json(template, template_data['folders'], nil, 0)
    end

    template
  end

  private

  def self.create_folders_from_json(template, folders, parent_id, level)
    folders.each_with_index do |folder_data, index|
      item = template.folder_template_items.create!(
        name: folder_data['name'],
        level: folder_data['level'] || level,
        order: folder_data['order'] || index + 1,
        parent_id: parent_id,
        description: folder_data['description']
      )

      # Recursively create children
      if folder_data['children']&.any?
        create_folders_from_json(template, folder_data['children'], item.id, level + 1)
      end
    end
  end
end
